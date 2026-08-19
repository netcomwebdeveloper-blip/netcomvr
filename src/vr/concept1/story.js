import { Ease } from '../shared/tween.js';

/* ============================================================================
   Story — A Day in My Family (Concept 1)
   ---------------------------------------------------------------------------
   5 beats + aha + completion, following the Photosynthesis story pattern:
     • generation token prevents two stories running at once
     • every beat is named and individually wrapped so one failure cannot
       silently kill the rest
     • narration has a single channel — lines never overlap
     • frame-driven timing (tweener) keeps sync with the XR compositor

   Beat structure:
     Welcome → Morning → Everyone busy → Evening → Dinner/bedtime → Aha → Done
   ========================================================================== */

const CAMERA_SHOTS = {
    wide:      { pos: [0,  1.75, 5.0], target: [0,  1.5,  0]   },
    morning:   { pos: [-0.5, 1.75, 4.2], target: [-1, 1.4, -2] },
    busy:      { pos: [0.4, 1.75, 4.0], target: [0,  1.4, -1.5]},
    evening:   { pos: [0.8, 1.75, 4.5], target: [1,  1.4, -2.0]},
    dinner:    { pos: [0,   1.75, 4.2], target: [0,  1.3, -2.0]},
    aha:       { pos: [0,   2.0,  5.5], target: [0,  2.2, -2.0]},
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
        this.run(++this.generation).catch((err) => console.error('[story]', err));
    }

    stop() {
        this.running = false;
        this.generation++;
        this.audio.stop();
    }

    /** Restarts cleanly — used when entering or leaving the headset. */
    restart() {
        this.stop();
        this._hideCompletion();
        setTimeout(() => this.start(), 500);
    }

    async run(generation) {
        const alive = () => this.running && this.generation === generation;

        const beat = async (name, fn) => {
            if (!alive()) return false;
            console.log(`[story c1] ${name}`);
            try {
                await fn();
            } catch (err) {
                console.error(`[story c1] beat "${name}" failed, continuing:`, err);
            }
            return alive();
        };

        do {
            await this.reset();

            /* Welcome -------------------------------------------------- */
            if (!await beat('welcome', async () => {
                await this.camera.moveTo({ ...CAMERA_SHOTS.wide, seconds: 0.01 });
                await this.hold(0.6);
                this.world.say('Good morning! Meet our family.');
                await this.audio.narrate('welcome', 'Good morning! Meet our family.');
                await this.hold(0.5);
                this.world.say('A family spends time together every day.');
                await this.audio.narrate('together', 'A family spends time together every day.');
                await this.hold(0.8);
            })) break;

            /* Beat 1 — Meet Our Family ---------------------------------- */
            if (!await beat('1 meet family', async () => {
                this.camera.moveTo({ ...CAMERA_SHOTS.morning, seconds: 3.0 });
                await this.hold(1.0);
                this.world.say('This is our family at home!');
                await this.audio.narrate('meet-family', 'This is our family at home!');
                await this.hold(1.5);
            })) break;

            /* Beat 2 — Morning Time ------------------------------------ */
            if (!await beat('2 morning', async () => {
                await this.world.setTimeOfDay('morning', this.tweener);
                this.camera.moveTo({ ...CAMERA_SHOTS.morning, seconds: 2.5 });
                this.world.say('It is morning. Everyone is getting ready for the day.');
                await this.audio.narrate('morning', 'It is morning. Everyone is getting ready for the day.');
                await this.hold(1.0);
                this.world.say('We wake up, get ready and have breakfast.');
                await this.audio.narrate('breakfast', 'We wake up, get ready and have breakfast.');
                await this.hold(1.5);
            })) break;

            /* Beat 3 — Everyone Has Something To Do -------------------- */
            if (!await beat('3 busy', async () => {
                await this.world.setTimeOfDay('afternoon', this.tweener);
                this.camera.moveTo({ ...CAMERA_SHOTS.busy, seconds: 3.0 });
                // Bring child forward as a VR close-up (object moves, not camera)
                this.world.bringForward('child', -0.5, this.tweener);
                this.world.say('Everyone has something to do.');
                await this.audio.narrate('everyone-busy', 'Everyone has something to do.');
                await this.hold(0.8);
                this.world.say('We learn, work and help at home.');
                await this.audio.narrate('learn-work-help', 'We learn, work and help at home.');
                await this.hold(1.2);
                this.world.sendBack('child', -1.5, this.tweener);
                await this.hold(0.5);
            })) break;

            /* Beat 4 — Afternoon and Evening --------------------------- */
            if (!await beat('4 evening', async () => {
                await this.world.setTimeOfDay('evening', this.tweener);
                this.camera.moveTo({ ...CAMERA_SHOTS.evening, seconds: 3.0 });
                this.world.say('Now it is evening.');
                await this.audio.narrate('evening', 'Now it is evening.');
                await this.hold(0.8);
                this.world.say('Family members spend time together, talk and play.');
                await this.audio.narrate('family-time', 'Family members spend time together, talk and play.');
                await this.hold(1.5);
            })) break;

            /* Beat 5 — Dinner and Bedtime ------------------------------ */
            if (!await beat('5 dinner bedtime', async () => {
                await this.world.setTimeOfDay('night', this.tweener);
                this.camera.moveTo({ ...CAMERA_SHOTS.dinner, seconds: 3.5 });
                this.world.say('At the end of the day, the family eats together and gets ready to rest.');
                await this.audio.narrate('dinner-bedtime', 'At the end of the day, the family eats together and gets ready to rest.');
                await this.hold(1.8);
            })) break;

            /* Aha Moment ----------------------------------------------- */
            if (!await beat('aha', async () => {
                this.camera.moveTo({ ...CAMERA_SHOTS.aha, seconds: 3.0 });
                this.world.showAha(true);
                this.audio.sfx('rise');
                this.world.say('Every family has a routine.');
                await this.audio.narrate('aha-routine', 'Every family has a routine.');
                await this.hold(0.8);
                this.world.say('We wake, eat, work, learn, play and rest.');
                await this.audio.narrate('aha-list', 'We wake, eat, work, learn, play and rest.');
                await this.hold(0.8);
                this.audio.sfx('complete');
                this.world.say('Families spend time together and help one another.');
                await this.audio.narrate('aha-final', 'Families spend time together and help one another.');
                await this.hold(2.0);
                this.world.showAha(false);
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
        this._hideCompletion();
        await this.world.setTimeOfDay('morning', this.tweener);
    }

    /** Frame-driven wait, so it stays in step with the XR presentation clock. */
    hold(seconds) {
        return this.tweener.add(seconds, () => {}, Ease.linear);
    }

    _showCompletion() {
        if (!this._completionEl) {
            const div = document.createElement('div');
            div.id = 'c1-completion';
            Object.assign(div.style, {
                position: 'fixed', inset: '0', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(10,40,20,0.78)', backdropFilter: 'blur(10px)',
                zIndex: '50', textAlign: 'center', padding: '30px',
                fontFamily: '"Baloo 2", "Segoe UI Rounded", system-ui, sans-serif',
                animation: 'c1FadeIn 0.7s ease'
            });
            div.innerHTML = `
                <style>@keyframes c1FadeIn { from { opacity:0; transform:scale(0.92) } to { opacity:1; transform:scale(1) } }</style>
                <div style="font-size:clamp(3rem,8vw,5rem); margin-bottom:16px;">🌟</div>
                <h2 style="color:#ffffff; font-size:clamp(1.8rem,5vw,3rem); margin:0 0 10px; text-shadow:0 3px 14px rgba(0,0,0,.5);">WELL DONE!</h2>
                <p style="color:#a8d8b0; font-size:clamp(1rem,2.5vw,1.6rem); font-weight:700; margin:0 0 28px;">You discovered</p>
                <p style="color:#ffdd99; font-size:clamp(1.2rem,3vw,2rem); font-weight:800; margin:0 0 32px;">A Day in My Family</p>
                <button id="c1-back" style="padding:14px 32px; border:0; border-radius:999px; background:#3fbf7a;
                    color:white; font:800 1.1rem 'Baloo 2',sans-serif; cursor:pointer; box-shadow:0 8px 22px rgba(0,0,0,.3);">
                    ← Back to Lessons
                </button>
            `;
            document.body.appendChild(div);
            this._completionEl = div;
            document.getElementById('c1-back')?.addEventListener('click', () => {
                window.location.href = '/';
            });
        }
        this._completionEl.style.display = 'flex';
    }

    _hideCompletion() {
        if (this._completionEl) this._completionEl.style.display = 'none';
    }
}
