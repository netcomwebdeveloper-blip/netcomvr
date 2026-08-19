import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

import { Tweener }         from '../shared/tween.js';
import { AudioManager }    from '../shared/audio.js';
import { CameraDirector }  from '../shared/camera.js';
import { whenFontsReady }  from '../shared/labels.js';
import { World }           from './world.js';
import { Story }           from './story.js';

/* ============================================================================
   Bootstrap — A Day in My Family (Concept 1)
   ---------------------------------------------------------------------------
   VR STABILITY (Photosynthesis reference pattern):
   1. local-floor reference space
   2. Camera ownership: CameraDirector / OrbitControls fully suspended in XR
   3. Frame-delta animation via Tweener
   4. Static shadow bake; adaptive quality fallback
   5. Eye-height calibration after session start
   ========================================================================== */

const CONFIG = {
    xr: {
        referenceSpace:      'local-floor',
        preferredFrameRates: [72, 90],
        foveation:           0.6,
        framebufferScale:    1.0
    },
    quality: {
        adaptive: true,
        minFps:   62
    },
    audio: {
        volume:         1.0,
        narrationTrack: null   // point to './assets/narration.mp3' when available
    }
};

/* ── Viewer spot ── where the rig is placed when entering XR */
const VIEWER_SPOT = new THREE.Vector3(0, 0, 2.5);

class App {
    constructor() {
        this.tweener        = new Tweener();
        this.elapsed        = 0;
        this.fpsSamples     = [];
        this.qualityReduced = false;
        this.started        = false;

        this.initRenderer();
        this.initScene();
        this.initManagers();
        this.boot();
    }

    /* ---------------------------------------------------------- renderer */

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true, alpha: false, powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace    = THREE.SRGBColorSpace;
        this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.08;

        this.renderer.shadowMap.enabled    = true;
        this.renderer.shadowMap.type       = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = false;

        this.renderer.xr.enabled = true;
        this.renderer.xr.setReferenceSpaceType(CONFIG.xr.referenceSpace);
        this.renderer.xr.setFramebufferScaleFactor(CONFIG.xr.framebufferScale);
        this.renderer.xr.setFoveation(CONFIG.xr.foveation);

        document.body.appendChild(this.renderer.domElement);
        this.clock = new THREE.Clock();

        window.addEventListener('resize', () => this.onResize());
    }

    initScene() {
        this.scene = new THREE.Scene();
        // No scene.background — the garden sky dome handles it

        // Rig: the XR session moves this. Camera is a child.
        // NOTHING else is parented to the rig — head-locking content causes sickness.
        this.rig = new THREE.Group();
        this.rig.name = 'rig';
        this.scene.add(this.rig);

        this.camera = new THREE.PerspectiveCamera(
            60, window.innerWidth / window.innerHeight, 0.1, 200
        );
        this.rig.add(this.camera);
    }

    initManagers() {
        this.audio = new AudioManager({ volume: CONFIG.audio.volume, voiceHint: 'en-IN' });
        this.world = new World(this.scene, this.tweener);

        // CameraDirector now uses OrbitControls for flat-screen 360° view.
        // defaultPos / defaultTarget set the opening shot.
        this.cameraDirector = new CameraDirector(
            this.camera, this.renderer, this.tweener,
            { defaultPos: [0, 1.75, 5.0], defaultTarget: [0, 1.5, 0] }
        );

        this.story = new Story({
            world:          this.world,
            cameraDirector: this.cameraDirector,
            audio:          this.audio,
            tweener:        this.tweener
        });

        this.renderer.xr.addEventListener('sessionstart', () => this.onSessionStart());
        this.renderer.xr.addEventListener('sessionend',   () => this.onSessionEnd());
    }

    async boot() {
        await whenFontsReady();

        if (CONFIG.audio.narrationTrack) {
            await this.audio.registerNarrationTrack(CONFIG.audio.narrationTrack, []);
        }

        const [family, house] = await Promise.all([
            this.world.loadModel('/assets/myfamily.glb'),
            this.world.loadModel('/assets/southindianhouse.glb')
        ]);
        this.world.build({ family, house });
        this.refreshShadows();

        // VR Entry button — visible only when a WebXR headset is available
        const slot = document.getElementById('vr-slot');
        if (slot && navigator.xr) {
            const button = VRButton.createButton(this.renderer, {
                optionalFeatures: ['local-floor', 'bounded-floor', 'layers']
            });
            button.addEventListener('click', () => this.audio.unlock());
            slot.appendChild(button);
        }

        // Tap/click interaction to bounce family
        window.addEventListener('pointerdown', (e) => {
            if (e.target.closest?.('#title-card, #completion-card, .btn-pill, .control-btn')) return;
            this.world.triggerInteraction();
            this.audio.sfx('click');
        });

        this.renderer.setAnimationLoop(() => this.render());
        this.armTitleCard();
    }

    armTitleCard() {
        const card = document.getElementById('title-card');
        const begin = (withSound) => {
            if (this.started) return;
            this.started = true;
            if (withSound) this.audio.unlock();
            card?.classList.add('is-gone');
            this.story.start();
        };

        card?.addEventListener('click', () => begin(true), { once: true });
        window.addEventListener('keydown', () => begin(true), { once: true });
        setTimeout(() => begin(false), 9000);
    }

    refreshShadows() {
        this.renderer.shadowMap.needsUpdate = true;
        setTimeout(() => { this.renderer.shadowMap.needsUpdate = true; }, 300);
    }

    /* ---------------------------------------------------------- session */

    onSessionStart() {
        this.audio.unlock();

        // Place rig at viewer spot — this is the only position/rotation write
        // that happens near a session start, and it's on the RIG, not the camera.
        this.rig.position.set(VIEWER_SPOT.x, 0, VIEWER_SPOT.z);
        this.rig.rotation.set(0, 0, 0);

        const session = this.renderer.xr.getSession();
        if (session) {
            const rates = session.supportedFrameRates || [];
            const pick  = CONFIG.xr.preferredFrameRates.find((r) => rates.includes(r));
            if (pick && session.updateTargetFrameRate) {
                session.updateTargetFrameRate(pick).catch(() => {});
            }
        }

        this.refreshShadows();
        setTimeout(() => this.calibrateEyeHeight(), 1200);

        if (this.started) this.story.restart();
        else {
            this.started = true;
            document.getElementById('title-card')?.classList.add('is-gone');
            this.story.start();
        }
    }

    onSessionEnd() {
        this.rig.position.set(0, 0, 0);
        this.rig.rotation.set(0, 0, 0);
        this.cameraDirector.resync();  // re-enables orbit controls, lands on last story shot
        this.story.restart();
    }

    calibrateEyeHeight() {
        if (!this.renderer.xr.isPresenting) return;
        const eye = this.camera.position.y;
        if (eye < 0.6) {
            console.warn('[xr] floor-relative space unavailable, applying 1.6 m offset');
            this.rig.position.y += 1.6 - eye;
        }
    }

    /* ---------------------------------------------------------- loop */

    onResize() {
        if (this.renderer.xr.isPresenting) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    monitorPerformance(dt) {
        if (!CONFIG.quality.adaptive || this.qualityReduced) return;
        if (!this.renderer.xr.isPresenting || dt <= 0) return;

        this.fpsSamples.push(1 / dt);
        if (this.fpsSamples.length < 240) return;

        const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length;
        this.fpsSamples.length = 0;

        if (avg < CONFIG.quality.minFps) {
            this.qualityReduced = true;
            console.warn(`[perf] ${avg.toFixed(1)} fps — shedding detail`);
            this.renderer.shadowMap.enabled = false;
            this.renderer.xr.setFoveation(1.0);
        }
    }

    render() {
        const dt = Math.min(this.clock.getDelta(), 0.1);
        this.elapsed += dt;

        this.tweener.update(dt);
        this.world.update(dt, this.elapsed);
        this.cameraDirector.update(dt);  // drives OrbitControls (no-op in XR)

        this.monitorPerformance(dt);
        this.renderer.render(this.scene, this.camera);
    }
}

window.app = new App();
