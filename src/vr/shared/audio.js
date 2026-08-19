/**
 * Audio Manager
 *
 * Narration has exactly one channel: starting a line always stops the previous
 * one, so two voices can never talk over each other.
 *
 * Audio graph:
 *   narration track / clips ─┐
 *                             ├─ narrationBus (1.0) ─┐
 *   sfx oscillators ──────────── sfxBus (0.7) ────────┴─ master ─ compressor ─ limiter ─ out
 *
 * The compressor makes speech carry. The limiter is a safety catch so stacked
 * SFX chimes never clip.
 *
 * ONE RECORDED FILE, MANY LINES
 * registerNarrationTrack(url, keysInOrder) loads a single mp3 containing every
 * narration line back-to-back with silence between them, and slices it
 * automatically. If the file is missing, every line falls back to browser
 * speech synthesis — nothing else breaks.
 *
 * Adapted from the Photosynthesis reference implementation.
 */

const WORDS_PER_SECOND = 2.4;   // child-friendly pacing — slightly slower than adult

/** Makeup gain lifted before the bus — recordings are usually mastered quiet. */
const CLIP_MAKEUP  = 2.4;
const TRACK_MAKEUP = 1.6;

export class AudioManager {
    constructor({ preferSpeech = true, voiceHint = 'en', volume = 1.0 } = {}) {
        this.clips     = new Map();
        this.clipNodes = new WeakMap();   // createMediaElementSource is once-per-element
        this.preferSpeech = preferSpeech;
        this.voiceHint    = voiceHint;
        this.volume       = volume;

        this.ctx          = null;
        this.master       = null;
        this.narrationBus = null;
        this.sfxBus       = null;

        this.trackBuffer   = null;   // decoded AudioBuffer for the one mp3
        this.trackManifest = null;   // { key: { start, duration } }
        this.currentSource = null;   // the AudioBufferSourceNode currently playing

        this.token       = 0;
        this.busy        = false;
        this.muted       = false;
        this.currentAudio = null;
    }

    /** Must be called from a user gesture (title card / Enter VR button). */
    unlock() {
        this.#ensureContext();
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        try { window.speechSynthesis?.getVoices(); } catch (_) {}
    }

    #ensureContext() {
        if (this.ctx) return this.ctx;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        this.ctx = new Ctx();
        this.#buildGraph();
        return this.ctx;
    }

    #buildGraph() {
        const ctx = this.ctx;

        // Safety limiter — a stacked chime landing on top of a narration line
        // cannot clip the output.
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -2;
        limiter.knee.value      = 0;
        limiter.ratio.value     = 20;
        limiter.attack.value    = 0.002;
        limiter.release.value   = 0.1;
        limiter.connect(ctx.destination);

        // Makes speech carry: evens out the line so makeup gain can lift
        // the whole thing rather than just its loudest syllable.
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -20;
        comp.knee.value      = 12;
        comp.ratio.value     = 3.5;
        comp.attack.value    = 0.006;
        comp.release.value   = 0.22;
        comp.connect(limiter);

        this.master = ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(comp);

        this.narrationBus = ctx.createGain();
        this.narrationBus.gain.value = 1.0;
        this.narrationBus.connect(this.master);

        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = 0.7;
        this.sfxBus.connect(this.master);
    }

    /** 0–1.5. Above 1 is fine; the limiter handles it. */
    setVolume(value) {
        this.volume = Math.max(0, Math.min(1.5, value));
        if (this.master && !this.muted) {
            this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
        }
    }

    /* --------------------------------------------------------- one mp3 file */

    /**
     * Loads one recording containing every narration line back-to-back and
     * slices it by detecting silences. Never throws — on any failure it logs
     * a warning and every line falls back to speech synthesis.
     *
     * @param {string}   url          e.g. './assets/narration.mp3'
     * @param {string[]} keysInOrder  must match the order lines were recorded
     * @param {object}   [opts]
     * @returns {Promise<boolean>} whether the track loaded and is in use
     */
    async registerNarrationTrack(url, keysInOrder, opts = {}) {
        const ctx = this.#ensureContext();
        if (!ctx) {
            console.warn('[audio] WebAudio unavailable, using speech synthesis');
            return false;
        }

        try {
            const res    = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
            const bytes  = await res.arrayBuffer();
            const buffer = await ctx.decodeAudioData(bytes);

            const segments = this.#detectSegments(buffer, opts);
            const n        = Math.min(segments.length, keysInOrder.length);
            const manifest = {};
            for (let i = 0; i < n; i++) manifest[keysInOrder[i]] = segments[i];

            this.trackBuffer   = buffer;
            this.trackManifest = manifest;

            if (segments.length !== keysInOrder.length) {
                console.warn(
                    `[audio] narration track: expected ${keysInOrder.length} lines, ` +
                    `detected ${segments.length}. Lines beyond the shorter count fall ` +
                    `back to speech synthesis.`
                );
            } else {
                console.log(`[audio] narration track ready — ${n} lines from ${url}`);
            }
            return true;
        } catch (err) {
            console.warn('[audio] narration track unavailable, using speech synthesis fallback:', err);
            this.trackBuffer   = null;
            this.trackManifest = null;
            return false;
        }
    }

    /** Console helper: prints what was detected, for tuning the recording. */
    describeNarrationTrack() {
        if (!this.trackManifest) { console.log('[audio] no narration track loaded'); return; }
        for (const [key, seg] of Object.entries(this.trackManifest)) {
            console.log(`  ${key.padEnd(16)} ${seg.start.toFixed(2)}s  +${seg.duration.toFixed(2)}s`);
        }
    }

    /**
     * Silence-based segmentation. Mixes all channels down, computes RMS over
     * 20 ms frames, and splits wherever the gap between spoken frames exceeds
     * minSilenceSeconds. Runs once at load.
     */
    #detectSegments(buffer, {
        threshold          = 0.025,
        minSilenceSeconds  = 0.35,
        minSegmentSeconds  = 0.15,
        padSeconds         = 0.06
    } = {}) {
        const sr       = buffer.sampleRate;
        const channels = [];
        for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));

        const frameSeconds = 0.02;
        const frameLen     = Math.max(1, Math.round(sr * frameSeconds));
        const frameCount   = Math.ceil(buffer.length / frameLen);
        const rms          = new Float32Array(frameCount);

        for (let f = 0; f < frameCount; f++) {
            const start = f * frameLen;
            const end   = Math.min(buffer.length, start + frameLen);
            let sum = 0;
            for (let i = start; i < end; i++) {
                let s = 0;
                for (const ch of channels) s += ch[i];
                s /= channels.length;
                sum += s * s;
            }
            rms[f] = end > start ? Math.sqrt(sum / (end - start)) : 0;
        }

        const minSilenceFrames = Math.round(minSilenceSeconds / frameSeconds);
        const runs = [];
        let segStart = -1, lastActive = -1;

        for (let f = 0; f < frameCount; f++) {
            if (rms[f] > threshold) {
                if (segStart === -1) segStart = f;
                lastActive = f;
            } else if (segStart !== -1 && (f - lastActive) > minSilenceFrames) {
                runs.push([segStart, lastActive]);
                segStart = -1;
            }
        }
        if (segStart !== -1) runs.push([segStart, lastActive]);

        const out = [];
        for (const [a, b] of runs) {
            const start    = Math.max(0, a * frameSeconds - padSeconds);
            const end      = Math.min(buffer.duration, (b + 1) * frameSeconds + padSeconds);
            const duration = end - start;
            if (duration >= minSegmentSeconds) out.push({ start, duration });
        }
        return out;
    }

    /** Manually register a separate mp3 for one line, instead of the shared track. */
    registerClip(key, url) {
        const audio = new Audio(url);
        audio.preload     = 'auto';
        audio.crossOrigin = 'anonymous';
        audio.volume      = 1.0;
        this.clips.set(key, audio);
    }

    setMuted(muted) {
        this.muted = muted;
        if (this.master) this.master.gain.value = muted ? 0 : this.volume;
        if (muted) this.stop();
    }

    stop() {
        this.token++;
        this.busy = false;
        if (this.currentSource) {
            try { this.currentSource.stop(); } catch (_) {}
            this.currentSource = null;
        }
        if (this.currentAudio) {
            try { this.currentAudio.pause(); this.currentAudio.currentTime = 0; } catch (_) {}
            this.currentAudio = null;
        }
        try { window.speechSynthesis?.cancel(); } catch (_) {}
    }

    /**
     * Speaks a line and resolves when it finishes. Tries, in order: the shared
     * recording, a manually registered clip, browser speech, or a timed
     * silence — whichever is available for this key.
     * @returns {Promise<boolean>} false if superseded by a newer line.
     */
    async narrate(key, text) {
        this.stop();
        const mine = ++this.token;
        this.busy  = true;

        const fallbackSeconds = Math.max(2.5, (String(text).split(/\s+/).length) / WORDS_PER_SECOND);

        if (this.muted) {
            await this.#sleep(fallbackSeconds * 1000);
        } else if (this.trackManifest?.[key]) {
            await this.#playFromTrack(this.trackManifest[key]);
        } else if (this.clips.has(key)) {
            await this.#playClip(this.clips.get(key), fallbackSeconds);
        } else if (this.preferSpeech && window.speechSynthesis) {
            await this.#speak(text, fallbackSeconds);
        } else {
            await this.#sleep(fallbackSeconds * 1000);
        }

        if (mine !== this.token) return false;
        this.busy = false;
        return true;
    }

    /** Waits until whatever is currently speaking has finished. */
    async idle() {
        while (this.busy) await this.#sleep(120);
    }

    /** Plays one slice of the shared recording through the narration bus. */
    #playFromTrack(seg) {
        return new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                clearTimeout(guard);
                resolve();
            };

            const src   = this.ctx.createBufferSource();
            src.buffer  = this.trackBuffer;
            const boost = this.ctx.createGain();
            boost.gain.value = TRACK_MAKEUP;
            src.connect(boost).connect(this.narrationBus);
            src.onended = finish;

            this.currentSource = src;
            try {
                src.start(0, seg.start, seg.duration);
            } catch (_) {
                finish();
            }
            const guard = setTimeout(finish, seg.duration * 1000 + 800);
        });
    }

    /** Routes an <audio> element into the narration bus so it gets the chain. */
    #route(audio) {
        if (!this.ctx || !this.narrationBus) return;
        if (this.clipNodes.has(audio))       return;
        try {
            const src   = this.ctx.createMediaElementSource(audio);
            const boost = this.ctx.createGain();
            boost.gain.value = CLIP_MAKEUP;
            src.connect(boost).connect(this.narrationBus);
            this.clipNodes.set(audio, boost);
        } catch (_) {
            // Cross-origin or already routed: still plays, just at element level.
        }
    }

    #playClip(audio, fallbackSeconds) {
        return new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                audio.removeEventListener('ended', finish);
                clearTimeout(guard);
                resolve();
            };
            audio.addEventListener('ended', finish);
            this.currentAudio = audio;
            this.#route(audio);
            try {
                audio.currentTime = 0;
                audio.volume      = 1.0;
                const p = audio.play();
                if (p?.catch) p.catch(() => finish());
            } catch (_) {
                finish();
            }
            const known = Number.isFinite(audio.duration) && audio.duration > 0
                ? audio.duration : fallbackSeconds;
            const guard = setTimeout(finish, known * 1000 + 1500);
        });
    }

    #pickVoice(voices) {
        if (!voices || voices.length === 0) return null;

        const priorityKeywords = [
            'ravi', 'heera', 'kavya', 'deepa', 'priya', 'veena', 'neerja', 'prabhat',
            'tamil', 'telugu', 'kannada', 'malayalam', 'india', 'indian'
        ];

        // 1. Prioritize Indian English voices (en-IN, en_IN, ta-IN, etc.)
        const indianVoices = voices.filter((v) => {
            const lang = (v.lang || '').toLowerCase();
            const name = (v.name || '').toLowerCase();
            return lang.includes('en-in') || lang.includes('en_in') || lang.includes('ta') || lang.includes('te') ||
                   priorityKeywords.some((k) => name.includes(k));
        });

        if (indianVoices.length > 0) {
            const preferred = indianVoices.find((v) => {
                const name = (v.name || '').toLowerCase();
                return priorityKeywords.some((k) => name.includes(k)) || name.includes('natural') || name.includes('online');
            });
            return preferred || indianVoices[0];
        }

        // 2. Fallback to voiceHint match
        if (this.voiceHint) {
            const hintMatch = voices.find((v) => (v.lang || '').toLowerCase().startsWith(this.voiceHint.toLowerCase()));
            if (hintMatch) return hintMatch;
        }

        // 3. Fallback to any English voice
        return voices.find((v) => (v.lang || '').toLowerCase().startsWith('en')) || voices[0] || null;
    }

    #speak(text, fallbackSeconds) {
        return new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                clearTimeout(guard);
                resolve();
            };
            try {
                const utterance  = new SpeechSynthesisUtterance(text);
                utterance.lang   = 'en-IN'; // Indian English
                utterance.rate   = 0.86;   // child-friendly clear pacing
                utterance.pitch  = 1.05;   // warm, friendly tone
                utterance.volume = 1.0;

                const voices = window.speechSynthesis?.getVoices() || [];
                const match  = this.#pickVoice(voices);
                if (match) utterance.voice = match;

                utterance.onend  = finish;
                utterance.onerror = finish;
                window.speechSynthesis.speak(utterance);
            } catch (_) {
                finish();
            }
            const guard = setTimeout(finish, fallbackSeconds * 1000 + 4000);
        });
    }

    #sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    /* ------------------------------------------------------------- effects */

    sfx(name) {
        if (!this.ctx || this.muted || !this.sfxBus) return;

        const presets = {
            chime:    { freqs: [523, 659, 784, 1047],  dur: 0.90, type: 'sine',     gain: 0.42 },
            click:    { freqs: [660],                   dur: 0.09, type: 'square',   gain: 0.30 },
            rise:     { freqs: [330, 440, 554, 659],    dur: 0.70, type: 'sine',     gain: 0.38 },
            sparkle:  { freqs: [880, 1320, 1760],       dur: 0.55, type: 'sine',     gain: 0.35 },
            warm:     { freqs: [261, 329, 392],         dur: 0.60, type: 'sine',     gain: 0.40 },
            complete: { freqs: [392, 523, 659, 784],    dur: 1.20, type: 'sine',     gain: 0.45 },
            heart:    { freqs: [440, 554],              dur: 0.40, type: 'sine',     gain: 0.38 }
        };

        const preset = presets[name] || presets.chime;
        const now    = this.ctx.currentTime;

        preset.freqs.forEach((freq, i) => {
            const osc   = this.ctx.createOscillator();
            const gain  = this.ctx.createGain();
            const start = now + i * (preset.dur / preset.freqs.length) * 0.6;

            osc.type = preset.type;
            osc.frequency.setValueAtTime(freq, start);
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(preset.gain, start + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + preset.dur);

            osc.connect(gain).connect(this.sfxBus);
            osc.start(start);
            osc.stop(start + preset.dur + 0.05);
        });
    }
}
