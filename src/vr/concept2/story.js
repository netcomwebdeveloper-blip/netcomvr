import { Ease } from '../shared/tween.js';

/* ============================================================================
   Story — Every Family Is Special (Concept 2)
   ---------------------------------------------------------------------------
   5 beats: Meet Family A → Family B → Family C → Similarities → Celebrate
   + Aha: "Every Family Is Special"
   + Completion with return to menu

   Same Photosynthesis story architecture:
   • generation token for safe restart
   • async beat sequencing
   • single narration channel
   • frame-driven holds via tweener
   ========================================================================== */

const CAMERA_SHOTS = {
    wide:     { pos: [0, 1.75, 5.5], target: [0, 1.5, 0] },
    familyA:  { pos: [0, 1.45, 2.5], target: [0, 1.25, -1.0] }, // zoomed in close-up for Tamil family
    familyB:  { pos: [0, 1.45, 2.5], target: [0, 1.25, -1.0] }, // zoomed in close-up for Gujarathi family
    familyC:  { pos: [0, 1.45, 2.5], target: [0, 1.25, -1.0] }, // zoomed in close-up for Punjabi family
    together: { pos: [0, 2.10, 7.2], target: [0, 1.5, 0] },
    aha:      { pos: [0, 2.00, 5.8], target: [0, 2.2, -1.0] },
};

export class Story {
    constructor({ world, cameraDirector, audio, tweener }) {
        this.world  = world;
        this.camera = cameraDirector;
        this.audio  = audio;
        this.tweener = tweener;

        this.generation = 0;
        this.running    = false;

        this._completionEl = null;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.run(++this.generation).catch((err) => console.error('[story c2]', err));
    }

    stop() {
        this.running = false;
        this.generation++;
        this.audio.stop();
    }

    restart() {
        this.stop();
        this._hideCompletion();
        setTimeout(() => this.start(), 500);
    }

    async run(generation) {
        const alive = () => this.running && this.generation === generation;

        const beat = async (name, fn) => {
            if (!alive()) return false;
            console.log(`[story c2] ${name}`);
            try {
                await fn();
            } catch (err) {
                console.error(`[story c2] beat "${name}" failed, continuing:`, err);
            }
            return alive();
        };

        do {
            await this.reset();

            /* Welcome -------------------------------------------------- */
            if (!await beat('welcome', async () => {
                await this.camera.moveTo({ ...CAMERA_SHOTS.wide, seconds: 0.01 });
                await this.hold(0.6);
                this.world.say('Families all around the world!');
                await this.audio.narrate('c2-welcome', 'Families all around the world!');
                await this.hold(0.5);
                this.world.say('Let us meet some families today.');
                await this.audio.narrate('c2-intro', 'Let us meet some families today.');
                await this.hold(0.8);
            })) break;

            /* Beat 1 — Tamil Family ------------------------------------ */
            if (!await beat('1 tamil family', async () => {
                this.camera.moveTo({ ...CAMERA_SHOTS.familyA, seconds: 2.2 });
                await this.world.showFamily('A');
                this.world.say('Here is a Tamil family.');
                await this.audio.narrate('c2-tamil', 'Here is a Tamil family.');
                await this.hold(0.6);
                this.world.say('They wake up, get ready and begin their day.');
                await this.audio.narrate('c2-tamil-day', 'They wake up, get ready and begin their day.');
                await this.hold(1.5);
            })) break;

            /* Beat 2 — Gujarathi Family -------------------------------- */
            if (!await beat('2 gujarathi family', async () => {
                this.camera.moveTo({ ...CAMERA_SHOTS.familyB, seconds: 2.2 });
                await this.world.showFamily('B');
                this.world.say('Now meet a Gujarathi family.');
                await this.audio.narrate('c2-gujarati', 'Now meet a Gujarathi family.');
                await this.hold(0.6);
                this.world.say('Their day and traditions have their own special charm.');
                await this.audio.narrate('c2-gujarati-day', 'Their day and traditions have their own special charm.');
                await this.hold(1.5);
            })) break;

            /* Beat 3 — Punjabi Family ---------------------------------- */
            if (!await beat('3 punjabi family', async () => {
                this.camera.moveTo({ ...CAMERA_SHOTS.familyC, seconds: 2.2 });
                await this.world.showFamily('C');
                this.world.say('Here is a Punjabi family.');
                await this.audio.narrate('c2-punjabi', 'Here is a Punjabi family.');
                await this.hold(0.6);
                this.world.say('Their home and routine are full of joy too.');
                await this.audio.narrate('c2-punjabi-day', 'Their home and routine are full of joy too.');
                await this.hold(1.5);
            })) break;

            /* Beat 4 — What Is Similar? -------------------------------- */
            if (!await beat('4 similarities', async () => {
                this.camera.moveTo({ ...CAMERA_SHOTS.together, seconds: 3.5 });
                await this.world.showAllFamilies();
                this.world.showAha(true);
                this.audio.sfx('rise');
                await this.hold(0.6);
                this.world.say('Look closely. Their lives are different…');
                await this.audio.narrate('c2-different', 'Look closely. Their lives are different…');
                await this.hold(1.0);
                this.world.say('But families have many things in common.');
                await this.audio.narrate('c2-common', 'But families have many things in common.');
                this.audio.sfx('warm');
                await this.hold(2.0);
                this.world.showAha(false);
            })) break;

            /* Beat 5 — Celebrate Differences --------------------------- */
            if (!await beat('5 celebrate', async () => {
                this.world.say('Every family has its own way of living.');
                await this.audio.narrate('c2-own-way', 'Every family has its own way of living.');
                await this.hold(0.8);
                this.world.say('Families may be different.');
                await this.audio.narrate('c2-different2', 'Families may be different.');
                await this.hold(0.6);
                this.audio.sfx('sparkle');
                this.world.say('Every family is special!');
                await this.audio.narrate('c2-special', 'Every family is special!');
                await this.hold(1.5);
            })) break;

            /* Aha Moment ----------------------------------------------- */
            if (!await beat('aha', async () => {
                this.camera.moveTo({ ...CAMERA_SHOTS.aha, seconds: 3.0 });
                this.world.say('');
                this.world.showFinalMessage(true);
                this.audio.sfx('complete');
                await this.audio.narrate('c2-aha', 'Families may live differently. Every family is special.');
                await this.hold(3.0);
                this.world.showFinalMessage(false);
            })) break;

            /* Completion ----------------------------------------------- */
            if (!await beat('completion', async () => {
                this.world.say('');
                this.audio.sfx('sparkle');
                this._showCompletion();
                await this.hold(6.0);
                this._hideCompletion();
                await this.hold(1.0);
            })) break;

            if (!await beat('pause before replay', () => this.hold(2.0))) break;
        } while (alive());

        if (this.generation === generation) this.running = false;
    }

    async reset() {
        this.world.say('');
        this.world.showAha(false);
        this.world.showFinalMessage(false);
        this._hideCompletion();
    }

    hold(seconds) {
        return this.tweener.add(seconds, () => {}, Ease.linear);
    }

    _showCompletion() {
        if (!this._completionEl) {
            const div = document.createElement('div');
            div.id = 'c2-completion';
            Object.assign(div.style, {
                position: 'fixed', inset: '0', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(10,20,50,0.80)', backdropFilter: 'blur(10px)',
                zIndex: '50', textAlign: 'center', padding: '30px',
                fontFamily: '"Baloo 2", "Segoe UI Rounded", system-ui, sans-serif',
                animation: 'c2FadeIn 0.7s ease'
            });
            div.innerHTML = `
                <style>@keyframes c2FadeIn { from { opacity:0; transform:scale(0.92) } to { opacity:1; transform:scale(1) } }</style>
                <div style="font-size:clamp(3rem,8vw,5rem); margin-bottom:16px;">🌟</div>
                <h2 style="color:#ffffff; font-size:clamp(1.8rem,5vw,3rem); margin:0 0 10px; text-shadow:0 3px 14px rgba(0,0,0,.5);">WELL DONE!</h2>
                <p style="color:#a8c8e8; font-size:clamp(1rem,2.5vw,1.6rem); font-weight:700; margin:0 0 28px;">You discovered</p>
                <p style="color:#ffe082; font-size:clamp(1.2rem,3vw,2rem); font-weight:800; margin:0 0 10px;">❤️ Every Family Is Special</p>
                <p style="color:#b8c8e8; font-size:clamp(0.9rem,2vw,1.2rem); font-weight:600; margin:0 0 28px;">Families may live differently.<br>Every family is special.</p>
                <button id="c2-back" style="padding:14px 32px; border:0; border-radius:999px; background:#4a7abf;
                    color:white; font:800 1.1rem 'Baloo 2',sans-serif; cursor:pointer; box-shadow:0 8px 22px rgba(0,0,0,.3);">
                    ← Back to Lessons
                </button>
            `;
            document.body.appendChild(div);
            this._completionEl = div;
            document.getElementById('c2-back')?.addEventListener('click', () => {
                window.location.href = '/';
            });
        }
        this._completionEl.style.display = 'flex';
    }

    _hideCompletion() {
        if (this._completionEl) this._completionEl.style.display = 'none';
    }
}
