import * as THREE from 'three';

/**
 * Canvas-based 3D text labels for VR scenes.
 *
 * Each label is a plane mesh with a canvas texture baked on it.
 * Re-baking is O(canvas) — fast enough to update per beat, not per frame.
 *
 * Adapted from the Photosynthesis reference implementation.
 */

/** Resolves once the Google Font (Baloo 2) is ready. Falls back after 3 s. */
export function whenFontsReady() {
    return Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 3000))
    ]);
}

export class TextLabel {
    /**
     * @param {object} opts
     * @param {string}  opts.text        Initial text (can be empty string)
     * @param {number}  [opts.worldWidth=2.0]   Width in Three.js world units
     * @param {number}  [opts.fontSize=80]      Canvas font size in px
     * @param {string}  [opts.color='#ffffff']  Text colour
     * @param {string}  [opts.background='']    Background fill (empty = transparent)
     * @param {number}  [opts.outlineWidth=6]   Outline stroke in px (0 = none)
     * @param {string}  [opts.outlineColor='rgba(0,0,0,0.55)']
     * @param {string}  [opts.align='center']   'left' | 'center' | 'right'
     * @param {number}  [opts.padding=24]       Canvas edge padding in px
     */
    constructor({
        text         = '',
        worldWidth   = 2.0,
        fontSize     = 80,
        color        = '#ffffff',
        background   = '',
        outlineWidth = 6,
        outlineColor = 'rgba(0,0,0,0.55)',
        align        = 'center',
        padding      = 24
    } = {}) {
        this._opts = { worldWidth, fontSize, color, background, outlineWidth, outlineColor, align, padding };

        this.canvas  = document.createElement('canvas');
        this.ctx2d   = this.canvas.getContext('2d');
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;

        const mat = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            toneMapped: false
        });

        // Geometry height is computed from world width and the baked canvas ratio.
        this.geo  = new THREE.PlaneGeometry(1, 1);
        this.mesh = new THREE.Mesh(this.geo, mat);
        this.mesh.matrixAutoUpdate = false;
        this.mesh.visible = false; // Hide until non-empty text is set

        if (text && text.trim()) {
            this.setText(text);
        }
    }

    setText(text) {
        if (!text || !String(text).trim()) {
            this.mesh.visible = false;
            if (this.canvas.width > 0 && this.canvas.height > 0) {
                this.ctx2d.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.texture.needsUpdate = true;
            }
            return;
        }

        this.mesh.visible = true;
        const { worldWidth, fontSize, color, background, outlineWidth, outlineColor, align, padding } = this._opts;
        const font    = `700 ${fontSize}px "Baloo 2", "Segoe UI Rounded", system-ui, sans-serif`;
        const canvas  = this.canvas;
        const ctx     = this.ctx2d;

        // Measure to set canvas size correctly.
        ctx.font = font;
        const lines   = String(text).split('\n');
        const lineH   = fontSize * 1.3;
        const maxW    = Math.max(...lines.map((l) => ctx.measureText(l).width));
        const cw      = Math.ceil(maxW + padding * 2);
        const ch      = Math.ceil(lines.length * lineH + padding * 2);

        canvas.width  = cw;
        canvas.height = ch;

        ctx.clearRect(0, 0, cw, ch);

        if (background) {
            ctx.fillStyle = background;
            const r = 18;
            ctx.beginPath();
            ctx.roundRect?.(0, 0, cw, ch, r) ?? ctx.rect(0, 0, cw, ch);
            ctx.fill();
        }

        ctx.font      = font;
        ctx.textAlign = align;
        ctx.textBaseline = 'middle';

        const x = align === 'center' ? cw / 2 : align === 'right' ? cw - padding : padding;

        lines.forEach((line, i) => {
            const y = padding + (i + 0.5) * lineH;
            if (outlineWidth > 0) {
                ctx.strokeStyle   = outlineColor;
                ctx.lineWidth     = outlineWidth;
                ctx.lineJoin      = 'round';
                ctx.strokeText(line, x, y);
            }
            ctx.fillStyle = color;
            ctx.fillText(line, x, y);
        });

        this.texture.needsUpdate = true;

        // Scale the plane so world width is preserved and height matches canvas ratio.
        const ratio = ch / cw;
        const wh    = worldWidth * ratio;
        this.mesh.scale.set(worldWidth, wh, 1);
        this.mesh.updateMatrix();
        this.mesh.updateMatrixWorld(true);
    }

    dispose() {
        this.texture.dispose();
        this.geo.dispose();
        this.mesh.material.dispose();
    }
}
