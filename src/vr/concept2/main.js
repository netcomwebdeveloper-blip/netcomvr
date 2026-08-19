import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

import { Tweener }         from '../shared/tween.js';
import { AudioManager }    from '../shared/audio.js';
import { CameraDirector }  from '../shared/camera.js';
import { whenFontsReady }  from '../shared/labels.js';
import { World }           from './world.js';
import { Story }           from './story.js';

/* ============================================================================
   Bootstrap — Every Family Is Special (Concept 2)
   ---------------------------------------------------------------------------
   Identical VR stability and orbit-control approach as Concept 1.
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
        narrationTrack: null
    }
};

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

        this.rig = new THREE.Group();
        this.rig.name = 'rig';
        this.scene.add(this.rig);

        this.camera = new THREE.PerspectiveCamera(
            60, window.innerWidth / window.innerHeight, 0.1, 200
        );
        this.rig.add(this.camera);
    }

    initManagers() {
        this.audio = new AudioManager({ volume: CONFIG.audio.volume });
        this.world = new World(this.scene, this.tweener);

        // Wider initial view for Concept 2 (shows wider garden with three families)
        this.cameraDirector = new CameraDirector(
            this.camera, this.renderer, this.tweener,
            { defaultPos: [0, 1.75, 5.5], defaultTarget: [0, 1.5, 0] }
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

        this.world.build();
        this.refreshShadows();

        const slot = document.getElementById('vr-slot');
        if (slot && navigator.xr) {
            const button = VRButton.createButton(this.renderer, {
                optionalFeatures: ['local-floor', 'bounded-floor', 'layers']
            });
            button.addEventListener('click', () => this.audio.unlock());
            slot.appendChild(button);
        }

        this.renderer.setAnimationLoop(() => this.render());
        this.armTitleCard();
        this._buildVRInfoBanner();
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

    _buildVRInfoBanner() {
        const hasXR = !!navigator.xr;
        const banner = document.createElement('div');
        banner.id = 'vr-info-banner';

        Object.assign(banner.style, {
            position:       'fixed',
            bottom:         hasXR ? '64px' : '16px',
            left:           '50%',
            transform:      'translateX(-50%)',
            zIndex:         '12',
            padding:        '9px 18px',
            borderRadius:   '999px',
            background:     'rgba(10,20,40,0.80)',
            backdropFilter: 'blur(8px)',
            color:          '#a8c4e8',
            font:           '600 13px "Baloo 2", system-ui',
            whiteSpace:     'nowrap',
            pointerEvents:  'none',
            opacity:        '0',
            transition:     'opacity 0.6s ease',
            textAlign:      'center'
        });

        if (hasXR) {
            banner.textContent = '🖱️ Drag to look around  ·  🥽 Enter VR for full immersion';
        } else {
            banner.textContent = '🖱️ Drag to look around 360°  ·  🥽 VR requires a WebXR headset';
        }

        document.body.appendChild(banner);
        setTimeout(() => { banner.style.opacity = '1'; }, 1200);
        setTimeout(() => { banner.style.opacity = '0'; }, 8500);
    }

    refreshShadows() {
        this.renderer.shadowMap.needsUpdate = true;
        setTimeout(() => { this.renderer.shadowMap.needsUpdate = true; }, 300);
    }

    onSessionStart() {
        this.audio.unlock();
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
        this.cameraDirector.resync();
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
        this.cameraDirector.update(dt);

        this.monitorPerformance(dt);
        this.renderer.render(this.scene, this.camera);
    }
}

window.app = new App();
