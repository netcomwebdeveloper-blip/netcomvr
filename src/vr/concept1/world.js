import * as THREE from 'three';
import { TextLabel } from '../shared/labels.js';
import { GardenEnvironment } from '../shared/environment.js';

/* ============================================================================
   World — A Day in My Family (Concept 1)
   ---------------------------------------------------------------------------
   Full 360° garden setting. The family home is suggested by simple outdoor
   furniture and a decorative facade — the viewer stands in a warm garden and
   the family life happens all around them.

   VR STAGING RULE:
     Camera NEVER moves while renderer.xr.isPresenting.
     For close-ups: characters/props move toward the viewer, not the reverse.
   ========================================================================== */

const WARM_ORANGE = new THREE.Color(0xffd180);
const NOON_WHITE  = new THREE.Color(0xfff8f0);
const AMBER_GOLD  = new THREE.Color(0xffb347);
const NIGHT_BLUE  = new THREE.Color(0x3a5a8a);

/** Stylized human figure from Three.js primitives. */
function makeFigure({ bodyColor = 0x4a90d9, headColor = 0xf5cba7, scale = 1 }) {
    const g = new THREE.Group();

    const headMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.14 * scale, 16, 12),
        new THREE.MeshLambertMaterial({ color: headColor })
    );
    headMesh.position.y = 1.55 * scale;
    headMesh.castShadow = true;
    g.add(headMesh);

    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.12 * scale, 0.42 * scale, 8, 16),
        new THREE.MeshLambertMaterial({ color: bodyColor })
    );
    body.position.y = 1.12 * scale;
    body.castShadow = true;
    g.add(body);

    for (const [sign, name] of [[-1, 'lArm'], [1, 'rArm']]) {
        const arm = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.055 * scale, 0.34 * scale, 6, 10),
            new THREE.MeshLambertMaterial({ color: bodyColor })
        );
        arm.position.set(sign * 0.21 * scale, 1.10 * scale, 0);
        arm.rotation.z = sign * -0.3;
        arm.castShadow = true;
        g.userData[name] = arm;
        g.add(arm);
    }

    for (const sign of [-1, 1]) {
        const leg = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.065 * scale, 0.38 * scale, 6, 10),
            new THREE.MeshLambertMaterial({ color: 0x2c3e50 })
        );
        leg.position.set(sign * 0.1 * scale, 0.62 * scale, 0);
        leg.castShadow = true;
        g.add(leg);
    }

    // Eyes
    const eyeM = new THREE.MeshLambertMaterial({ color: 0x222222 });
    for (const x of [-0.05, 0.05]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025 * scale, 8, 8), eyeM);
        eye.position.set(x * scale, 1.57 * scale, 0.13 * scale);
        g.add(eye);
    }

    g.userData.head     = headMesh;
    g.userData.animated = true;
    return g;
}

/** Simple outdoor picnic table */
function makeOutdoorTable() {
    const g = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0xc8a26a });
    const top  = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.75), wood);
    top.position.y = 0.72; top.castShadow = true; top.receiveShadow = true; g.add(top);
    // Bench left
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.28), wood);
    bench.position.set(-0.0, 0.44, 0.52); bench.receiveShadow = true; g.add(bench);
    // Bench right
    const bench2 = bench.clone(); bench2.position.set(0, 0.44, -0.52); g.add(bench2);
    // Legs (A-frame)
    for (const z of [-0.34, 0.34]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.72, 0.07),
            new THREE.MeshLambertMaterial({ color: 0x9a7240 }));
        leg.position.set(-0.6, 0.36, z); leg.castShadow = true; g.add(leg);
        const leg2 = leg.clone(); leg2.position.set(0.6, 0.36, z); g.add(leg2);
    }
    return g;
}

/** Garden bench */
function makeGardenBench() {
    const g   = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x8d6e3f });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.38), mat);
    seat.position.y = 0.46; seat.castShadow = true; seat.receiveShadow = true; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 0.06), mat);
    back.position.set(0, 0.68, -0.16); back.castShadow = true; g.add(back);
    for (const x of [-0.44, 0.44]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.46, 6), mat);
        leg.position.set(x, 0.23, 0); g.add(leg);
    }
    return g;
}

/** Small toy/ball on ground */
function makeBall(color = 0xff5252) {
    const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 10),
        new THREE.MeshLambertMaterial({ color })
    );
    m.castShadow = true;
    return m;
}

/** Day icon badge for aha moment */
function makeAhaIcon(emoji, color) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(128, 128, 110, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '100px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 128, 130);
    const tex  = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.65, 0.65),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })
    );
    return mesh;
}

/* ================================================================ */

export class World {
    constructor(scene, tweener) {
        this.scene   = scene;
        this.tweener = tweener;

        this.caption    = null;
        this.aha        = null;
        this.parent1    = null;
        this.parent2    = null;
        this.child      = null;

        this._garden    = null;
        this._sunLight  = null;
        this._ambient   = null;
        this._elapsed   = 0;
    }

    build() {
        // ----- Sky / garden environment (360°) -----
        this._garden = new GardenEnvironment(this.scene, {
            path:       true,
            flowers:    true,
            treeRadius: 13,
            treeCount:  20
        });
        this._garden.build();

        // ----- Lighting -----
        this._buildLighting();

        // ----- Scene set: outdoor family space -----
        this._buildOutdoorSet();

        // ----- Characters -----
        this._buildCharacters();

        // ----- Caption label -----
        this._buildCaption();

        // ----- Aha icons -----
        this._buildAhaMoment();

        // Freeze static objects
        this.scene.traverse((obj) => {
            if (obj.isMesh && !obj.userData.animated && obj.matrixAutoUpdate) {
                obj.matrixAutoUpdate = false;
                obj.updateMatrix();
            }
        });
    }

    _buildLighting() {
        // Remove any default background — sky dome handles it
        this.scene.background = null;

        this._ambient = new THREE.AmbientLight(0xfff5e8, 0.65);
        this.scene.add(this._ambient);

        this._sunLight = new THREE.DirectionalLight(WARM_ORANGE, 1.8);
        this._sunLight.position.set(-12, 18, 10);
        this._sunLight.castShadow = true;
        this._sunLight.shadow.mapSize.set(1024, 1024);
        this._sunLight.shadow.camera.near   = 0.5;
        this._sunLight.shadow.camera.far    = 50;
        this._sunLight.shadow.camera.left   = -10;
        this._sunLight.shadow.camera.right  = 10;
        this._sunLight.shadow.camera.top    = 10;
        this._sunLight.shadow.camera.bottom = -10;
        this._sunLight.shadow.bias = -0.001;
        this.scene.add(this._sunLight);

        // Soft sky fill
        const fill = new THREE.DirectionalLight(0xc8e8ff, 0.35);
        fill.position.set(6, 5, 6);
        fill.matrixAutoUpdate = false;
        fill.updateMatrix();
        this.scene.add(fill);
    }

    _buildOutdoorSet() {
        // Simple house façade — warm wall behind the action
        const facadeMat = new THREE.MeshLambertMaterial({ color: 0xfdf0d0, side: THREE.FrontSide });
        const facade    = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2), facadeMat);
        facade.position.set(0, 1.6, -3.8);
        facade.receiveShadow = true;
        facade.matrixAutoUpdate = false;
        facade.updateMatrix();
        this.scene.add(facade);

        // Roof triangle
        const roofShape = new THREE.Shape();
        roofShape.moveTo(-3.4, 0); roofShape.lineTo(3.4, 0); roofShape.lineTo(0, 1.6);
        const roofGeo = new THREE.ShapeGeometry(roofShape);
        const roof    = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0xd4694a }));
        roof.position.set(0, 3.2, -3.79);
        roof.matrixAutoUpdate = false;
        roof.updateMatrix();
        this.scene.add(roof);

        // Door
        const door = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 1.1, 0.08),
            new THREE.MeshLambertMaterial({ color: 0x8b5e3c })
        );
        door.position.set(0, 0.55, -3.76);
        door.matrixAutoUpdate = false;
        door.updateMatrix();
        this.scene.add(door);

        // Window left
        const winMat = new THREE.MeshBasicMaterial({ color: 0xc8eeff, toneMapped: false });
        for (const x of [-1.5, 1.5]) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.65), winMat);
            win.position.set(x, 1.3, -3.77);
            win.matrixAutoUpdate = false;
            win.updateMatrix();
            this.scene.add(win);
        }

        // Outdoor picnic table (left)
        const table = makeOutdoorTable();
        table.position.set(-2.4, 0, -1.6);
        table.rotation.y = 0.2;
        table.matrixAutoUpdate = false;
        table.updateMatrix();
        this.scene.add(table);

        // Garden bench (right)
        const bench = makeGardenBench();
        bench.position.set(2.6, 0, -1.8);
        bench.rotation.y = -0.35;
        bench.matrixAutoUpdate = false;
        bench.updateMatrix();
        this.scene.add(bench);

        // Colourful balls on the ground
        const ballColors = [0xff5252, 0x2196f3, 0xffeb3b];
        ballColors.forEach((c, i) => {
            const ball = makeBall(c);
            ball.position.set(-0.6 + i * 0.55, 0.12, 0.4);
            ball.matrixAutoUpdate = false;
            ball.updateMatrix();
            this.scene.add(ball);
        });

        // Potted plants
        for (const [x, z] of [[-2.8, -3.6], [2.8, -3.6]]) {
            // Pot
            const pot = new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.12, 0.28, 12),
                new THREE.MeshLambertMaterial({ color: 0xc0784e })
            );
            pot.position.set(x, 0.14, z);
            pot.castShadow = true;
            pot.matrixAutoUpdate = false;
            pot.updateMatrix();
            this.scene.add(pot);
            // Plant
            const plant = new THREE.Mesh(
                new THREE.SphereGeometry(0.22, 10, 8),
                new THREE.MeshLambertMaterial({ color: 0x3a9a3a })
            );
            plant.position.set(x, 0.55, z);
            plant.castShadow = true;
            plant.matrixAutoUpdate = false;
            plant.updateMatrix();
            this.scene.add(plant);
        }
    }

    _buildCharacters() {
        this.parent1 = makeFigure({ bodyColor: 0xd95b43, headColor: 0xf5cba7, scale: 1 });
        this.parent1.position.set(-1.4, 0, -1.2);
        this.scene.add(this.parent1);

        this.parent2 = makeFigure({ bodyColor: 0x4a90d9, headColor: 0xe8b998, scale: 1 });
        this.parent2.position.set(1.8, 0, -1.5);
        this.parent2.rotation.y = -0.4;
        this.scene.add(this.parent2);

        this.child = makeFigure({ bodyColor: 0x52b788, headColor: 0xf5cba7, scale: 0.74 });
        this.child.position.set(0.3, 0, -0.8);
        this.scene.add(this.child);
    }

    _buildCaption() {
        this.caption = new TextLabel({
            text:        '',
            worldWidth:  3.4,
            fontSize:    72,
            color:       '#ffffff',
            background:  'rgba(15,35,55,0.72)',
            outlineWidth: 0,
            padding:     28
        });
        this.caption.mesh.position.set(0, 2.85, -2.5);
        this.caption.mesh.matrixAutoUpdate = true;
        this.scene.add(this.caption.mesh);
    }

    _buildAhaMoment() {
        this.aha = new THREE.Group();
        this.aha.visible = false;

        const items = [
            { label: '🌅', color: '#f4a261', x: -1.8 },
            { label: '📚', color: '#4a7abf', x: -0.9 },
            { label: '🍽️', color: '#e76f51', x:  0.0 },
            { label: '🎮', color: '#52b788', x:  0.9 },
            { label: '🌙', color: '#364f6b', x:  1.8 }
        ];

        items.forEach(({ label, color, x }) => {
            const icon = makeAhaIcon(label, color);
            icon.position.set(x, 2.5, -2.4);
            icon.userData.baseY = 2.5;
            icon.matrixAutoUpdate = true;
            this.aha.add(icon);
        });

        this.scene.add(this.aha);
    }

    /* ---------------------------------------------------------------- API */

    say(text) {
        if (this.caption) this.caption.setText(text);
    }

    setTimeOfDay(phase, tweener) {
        const configs = {
            morning:   { sunColor: WARM_ORANGE, sunI: 1.8, ambI: 0.65 },
            afternoon: { sunColor: NOON_WHITE,  sunI: 2.2, ambI: 0.80 },
            evening:   { sunColor: AMBER_GOLD,  sunI: 1.3, ambI: 0.45 },
            night:     { sunColor: NIGHT_BLUE,  sunI: 0.4, ambI: 0.20 }
        };
        const cfg = configs[phase] || configs.morning;
        const toC = new THREE.Color(cfg.sunColor);
        const fromC = this._sunLight.color.clone();
        const fromSI = this._sunLight.intensity;
        const fromAI = this._ambient.intensity;

        return tweener.add(2.5, (p) => {
            this._sunLight.color.lerpColors(fromC, toC, p);
            this._ambient.color.lerpColors(fromC, toC, p);
            this._sunLight.intensity = fromSI + (cfg.sunI - fromSI) * p;
            this._ambient.intensity  = fromAI + (cfg.ambI - fromAI) * p;
        });
    }

    showAha(visible) {
        if (this.aha) this.aha.visible = visible;
    }

    bringForward(who, z, tweener) {
        const fig = ({ parent1: this.parent1, parent2: this.parent2, child: this.child })[who];
        if (!fig) return Promise.resolve();
        const fromZ = fig.position.z;
        return tweener.add(1.8, (p) => { fig.position.z = fromZ + (z - fromZ) * p; });
    }

    sendBack(who, z, tweener) {
        return this.bringForward(who, z, tweener);
    }

    /* ---------------------------------------------------------------- loop */

    update(dt, elapsed) {
        this._elapsed = elapsed;

        // Garden cloud drift
        this._garden?.update(elapsed);

        // Character idle animation
        const figures = [
            { fig: this.parent1, phase: 0   },
            { fig: this.parent2, phase: 1.1 },
            { fig: this.child,   phase: 2.3 }
        ];
        figures.forEach(({ fig, phase }) => {
            if (!fig || !fig.visible) return;
            const t = elapsed + phase;
            if (fig.userData.head) fig.userData.head.position.y = 1.55 + Math.sin(t * 1.1) * 0.012;
            if (fig.userData.lArm) fig.userData.lArm.rotation.z = 0.30 + Math.sin(t * 1.3) * 0.08;
            if (fig.userData.rArm) fig.userData.rArm.rotation.z = -0.30 + Math.sin(t * 1.3 + Math.PI) * 0.08;
        });

        // Aha icons float
        if (this.aha?.visible) {
            this.aha.children.forEach((icon, i) => {
                icon.position.y = (icon.userData.baseY || 2.5) + Math.sin(elapsed * 1.2 + i * 1.1) * 0.055;
            });
        }

        // Caption always faces viewer
        if (this.caption) this.caption.mesh.lookAt(0, 2.85, 5);
    }
}
