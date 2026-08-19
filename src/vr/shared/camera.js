import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ============================================================================
   Camera direction — with full 360° orbit in flat mode
   ---------------------------------------------------------------------------
   THE ONE RULE: this class does nothing to the camera while an XR session is
   presenting. The headset owns the pose. Any competing write = judder.

   In FLAT MODE the viewer gets full orbit control:
     • Mouse left-drag (or one-finger touch) → rotate 360° horizontally and
       vertically around the scene
     • Mouse wheel / pinch → zoom in/out
     • The story can still call moveTo() to suggest a shot, which smoothly
       re-targets the orbit pivot but never fights user dragging

   In VR MODE OrbitControls is suspended entirely. The XR compositor owns
   the camera transform; nothing here touches it.
   ========================================================================== */

export class CameraDirector {
    /**
     * @param {THREE.PerspectiveCamera} camera
     * @param {THREE.WebGLRenderer}     renderer
     * @param {import('./tween.js').Tweener} tweener
     * @param {object} [opts]
     * @param {number[]} [opts.defaultPos]   initial camera world position [x,y,z]
     * @param {number[]} [opts.defaultTarget] initial look-at target [x,y,z]
     */
    constructor(camera, renderer, tweener, opts = {}) {
        this.camera   = camera;
        this.renderer = renderer;
        this.tweener  = tweener;

        const pos    = opts.defaultPos    || [0, 1.75, 5.0];
        const target = opts.defaultTarget || [0, 1.5,  0];

        this._defaultPos    = new THREE.Vector3().fromArray(pos);
        this._defaultTarget = new THREE.Vector3().fromArray(target);

        // Current "story" position / target (overridden by orbit dragging)
        this.position = this._defaultPos.clone();
        this.target   = this._defaultTarget.clone();

        // ── OrbitControls for flat-screen 360° look-around ──────────────
        this.orbit = new OrbitControls(camera, renderer.domElement);
        this.orbit.enableDamping    = true;    // smooth deceleration after drag
        this.orbit.dampingFactor    = 0.08;
        this.orbit.enableZoom       = true;
        this.orbit.zoomSpeed        = 0.6;
        this.orbit.rotateSpeed      = 0.55;
        this.orbit.minDistance      = 1.5;
        this.orbit.maxDistance      = 14;
        this.orbit.maxPolarAngle    = Math.PI * 0.82;  // don't flip upside-down
        this.orbit.minPolarAngle    = 0.05;

        // Set initial view
        camera.position.copy(this._defaultPos);
        this.orbit.target.copy(this._defaultTarget);
        this.orbit.update();
    }

    /** True only when not in a headset — the only time we may touch the camera. */
    get active() {
        return !this.renderer.xr.isPresenting;
    }

    /**
     * Story-driven camera move. In flat mode this smoothly re-targets the
     * orbit pivot while preserving any user offset, so the story still has a
     * "suggested" view even if the child has looked away. In XR it is a no-op.
     */
    async moveTo({ pos, target, seconds = 3.0 }) {
        const toPos    = new THREE.Vector3().fromArray(pos);
        const toTarget = new THREE.Vector3().fromArray(target);

        if (!this.active) {
            this.position.copy(toPos);
            this.target.copy(toTarget);
            return;
        }

        const fromPos    = this.camera.position.clone();
        const fromTarget = this.orbit.target.clone();

        // Smoothly move both camera position and orbit pivot
        await this.tweener.add(seconds, (p) => {
            if (!this.active) return;
            this.camera.position.lerpVectors(fromPos, toPos, p);
            this.orbit.target.lerpVectors(fromTarget, toTarget, p);
            this.orbit.update();
        });

        this.position.copy(toPos);
        this.target.copy(toTarget);
        this.orbit.target.copy(toTarget);
        this.orbit.update();
    }

    update(dt) {
        if (!this.active) {
            // XR is presenting — orbit controls must be completely silent
            if (this.orbit.enabled) this.orbit.enabled = false;
            return;
        }

        // Re-enable orbit controls when back in flat mode
        if (!this.orbit.enabled) this.orbit.enabled = true;

        // OrbitControls.update() applies damping; this is the ONLY thing that
        // moves the camera in flat mode (besides moveTo tweens above).
        this.orbit.update();
    }

    /** Called when an XR session ends — re-lands the flat camera on the last story shot. */
    resync() {
        this.orbit.enabled = true;
        this.camera.position.copy(this.position);
        this.orbit.target.copy(this.target);
        this.orbit.update();
    }

    dispose() {
        this.orbit.dispose();
    }
}
