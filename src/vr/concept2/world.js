import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TextLabel } from '../shared/labels.js';
import { GardenEnvironment } from '../shared/environment.js';

/* ============================================================================
   World — Every Family Is Special (Concept 2)
   ---------------------------------------------------------------------------
   Full 360° shared garden sky. Each family group has a distinct coloured
   ground patch + backdrop — but they all live under the same beautiful sky,
   reinforcing the "all families share the same world" theme.

   Family A features the 3D GLB model (myfamily.glb), while Families B and C
   feature stylized figures representing diverse backgrounds.

   Families slide into view (objects move, camera stays still in VR).
   ========================================================================== */

const TWO_PI = Math.PI * 2;

/* ------------------------------------------------------------------
   Shared figure builder (same as concept 1)
   ------------------------------------------------------------------ */
function makeFigure({ bodyColor = 0x4a90d9, headColor = 0xf5cba7, scale = 1.0, hat = false }) {
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

    for (const sign of [-1, 1]) {
        const arm = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.055 * scale, 0.34 * scale, 6, 10),
            new THREE.MeshLambertMaterial({ color: bodyColor })
        );
        arm.position.set(sign * 0.21 * scale, 1.10 * scale, 0);
        arm.rotation.z = sign * -0.3;
        arm.castShadow = true;
        const key = sign < 0 ? 'lArm' : 'rArm';
        g.userData[key] = arm;
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

    const eyeM = new THREE.MeshLambertMaterial({ color: 0x222222 });
    for (const x of [-0.05, 0.05]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025 * scale, 8, 8), eyeM);
        eye.position.set(x * scale, 1.57 * scale, 0.13 * scale);
        g.add(eye);
    }

    if (hat) {
        const brim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22 * scale, 0.22 * scale, 0.04 * scale, 16),
            new THREE.MeshLambertMaterial({ color: 0x5d4e37 })
        );
        brim.position.y = 1.67 * scale;
        g.add(brim);
        const top = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14 * scale, 0.16 * scale, 0.24 * scale, 16),
            new THREE.MeshLambertMaterial({ color: 0x5d4e37 })
        );
        top.position.y = 1.80 * scale;
        g.add(top);
    }

    g.userData.head     = headMesh;
    g.userData.animated = true;
    return g;
}

/** Coloured ground patch for each family */
function makeGroundPatch(color, w = 5, d = 5.5) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx    = canvas.getContext('2d');

    // Base fill
    const base = new THREE.Color(color);
    ctx.fillStyle = `#${base.getHexString()}`;
    ctx.fillRect(0, 0, 256, 256);

    // Subtle texture blobs
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * 256, y = Math.random() * 256;
        const r = 6 + Math.random() * 20;
        const lighter = base.clone().multiplyScalar(Math.random() > 0.5 ? 1.08 : 0.92);
        ctx.fillStyle = `#${lighter.getHexString()}`;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, TWO_PI);
        ctx.fill();
    }

    const tex  = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshLambertMaterial({ map: tex })
    );
    mesh.rotation.x    = -Math.PI / 2;
    mesh.position.y    = 0.005;  // just above garden ground to avoid z-fight
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
}

/** Backdrop arch/banner for each family — placed in front of house, above family */
function makeBackdrop(color, label) {
    const g = new THREE.Group();

    // Archway (two decorative pillars + lintel in front of the house, framing the family)
    const pillarMat = new THREE.MeshLambertMaterial({ color });
    const pillar    = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.11, 2.7, 10),
        pillarMat
    );
    for (const x of [-1.65, 1.65]) {
        const p = pillar.clone();
        p.position.set(x, 1.35, -0.95);
        p.castShadow = true;
        p.matrixAutoUpdate = false;
        p.updateMatrix();
        g.add(p);
    }
    const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.16, 0.14),
        pillarMat
    );
    lintel.position.set(0, 2.72, -0.95);
    lintel.castShadow = true;
    lintel.matrixAutoUpdate = false;
    lintel.updateMatrix();
    g.add(lintel);

    // Family name label floating prominently above the arch and in front of house
    const lbl = new TextLabel({
        text: label, worldWidth: 2.8, fontSize: 86,
        color: '#ffffff', background: `rgba(${hexToRgb(color).join(',')},0.94)`,
        borderColor: '#ffd54f', borderWidth: 4, padding: 28
    });
    lbl.mesh.position.set(0, 2.88, -0.90);
    lbl.mesh.matrixAutoUpdate = true;
    g.add(lbl.mesh);

    g.userData.label = lbl;
    return g;
}

function hexToRgb(hex) {
    const c = new THREE.Color(hex);
    return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)];
}

/* ------------------------------------------------------------------
   Three distinct family groups
   ------------------------------------------------------------------ */

function setupGlbFamily(gltfModel, group, {
    scale = 0.11,
    position = [0, 1.15, -1.0],
    pedestalColor = 0xfff3cf,
    lightColor = 0xfff7e6,
    starColor = 0xffe680
} = {}) {
    if (!gltfModel || !gltfModel.scene) return false;

    const model = gltfModel.scene;
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
                if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
                    child.material.metalness = 0.0;
                    child.material.roughness = 0.3;
                }
                child.material.side = THREE.DoubleSide;
                child.material.transparent = true;
                child.material.alphaTest = 0.02;
                child.material.depthWrite = true;
                child.material.toneMapped = false;
                if (child.material.map) {
                    child.material.map.colorSpace = THREE.SRGBColorSpace;
                    child.material.map.needsUpdate = true;
                }
            }
        }
    });

    // Rotate upright and face forward: (0, PI/2, PI/2)
    model.rotation.set(0, Math.PI / 2, Math.PI / 2);
    model.scale.set(scale, scale, scale);
    model.position.fromArray(position);
    group.add(model);
    group.userData.glbModel = model;
    group.userData.figures = [];

    // Glowing garden pedestal under the family
    const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.5, 0.08, 24),
        new THREE.MeshLambertMaterial({ color: pedestalColor })
    );
    pedestal.position.set(position[0], 0.04, position[2]);
    pedestal.receiveShadow = true;
    group.add(pedestal);

    // Dedicated warm accent light on the family
    const spot = new THREE.PointLight(lightColor, 2.5, 10);
    spot.position.set(position[0], 2.5, position[2] + 1.5);
    group.add(spot);

    // Floating sparkle stars around the family
    const sparkleGroup = new THREE.Group();
    const starMat = new THREE.MeshBasicMaterial({ color: starColor, side: THREE.DoubleSide });
    for (let s = 0; s < 6; s++) {
        const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), starMat);
        const a = (s / 6) * Math.PI * 2;
        star.position.set(position[0] + Math.cos(a) * 1.3, 1.2 + Math.sin(a * 2) * 0.4, position[2] + Math.sin(a) * 0.3);
        star.userData.baseY = star.position.y;
        star.userData.phase = s * 1.1;
        sparkleGroup.add(star);
    }
    group.add(sparkleGroup);
    group.userData.sparkles = sparkleGroup;

    return true;
}

function setupGlbHouse(gltfModel, group, {
    scale = 1.85,
    position = [0, 1.85, -2.5]
} = {}) {
    if (!gltfModel || !gltfModel.scene) return false;

    const house = gltfModel.scene;
    house.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
                if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
                    child.material.metalness = 0.0;
                    child.material.roughness = 0.5;
                }
                child.material.side = THREE.DoubleSide;
                child.material.transparent = true;
                child.material.alphaTest = 0.02;
                child.material.depthWrite = true;
                child.material.toneMapped = false;
                if (child.material.map) {
                    child.material.map.colorSpace = THREE.SRGBColorSpace;
                    child.material.map.needsUpdate = true;
                }
            }
        }
    });

    house.rotation.set(0, 0, 0);
    house.scale.set(scale, scale, scale);
    house.position.fromArray(position);
    group.add(house);
    group.userData.glbHouse = house;

    return true;
}

function buildFamilyA(gltfModel, houseModel = null) {
    const g = new THREE.Group();
    g.add(makeGroundPatch(0xd8ebb0));   // light lime — town garden

    const arch = makeBackdrop(0x3b6fa8, 'Tamil Family');
    g.add(arch);

    // South Indian House backdrop
    setupGlbHouse(houseModel, g, {
        scale: 1.85,
        position: [0, 1.85, -2.5]
    });

    // Tamil Family (standing in front of house on glowing pedestal)
    const hasGlb = setupGlbFamily(gltfModel, g, {
        scale: 0.11,
        position: [0, 1.15, -1.0],
        pedestalColor: 0xfff3cf,
        starColor: 0xffe680
    });

    if (!hasGlb) {
        // Fallback figures
        const p1 = makeFigure({ bodyColor: 0x2c3e80, headColor: 0xf0c890 });
        p1.position.set(-1.0, 0, -1.0);
        g.add(p1);

        const p2 = makeFigure({ bodyColor: 0xe07b39, headColor: 0xf5c8a0 });
        p2.position.set(0.2, 0, -1.2);
        p2.rotation.y = -0.3;
        g.add(p2);

        const child = makeFigure({ bodyColor: 0x4caf70, headColor: 0xf0c890, scale: 0.76 });
        child.position.set(1.1, 0, -0.7);
        g.add(child);

        g.userData.figures = [p1, p2, child];
    }

    // Town garden prop: flower bed
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * TWO_PI;
        const flower = new THREE.Mesh(
            new THREE.CircleGeometry(0.1, 8),
            new THREE.MeshLambertMaterial({
                color: [0xff6b8a, 0xffd740, 0xff9e57][i % 3],
                side: THREE.DoubleSide
            })
        );
        flower.position.set(
            Math.cos(angle) * 0.45 - 1.8,
            0.01,
            Math.sin(angle) * 0.32 - 2.2
        );
        flower.rotation.x = -Math.PI / 2;
        flower.matrixAutoUpdate = false;
        flower.updateMatrix();
        g.add(flower);
    }

    g.userData.label   = arch.userData.label;
    return g;
}

function buildFamilyB(gltfModel, houseModel = null) {
    const g = new THREE.Group();
    g.add(makeGroundPatch(0xc8e6a0));  // earthy green — farmhouse

    const arch = makeBackdrop(0x7a5c2e, 'Gujarathi Family');
    g.add(arch);

    // North Indian House backdrop
    setupGlbHouse(houseModel, g, {
        scale: 1.80,
        position: [0, 1.80, -2.5]
    });

    // Gujarathi Family (standing in front of house on glowing pedestal)
    const hasGlb = setupGlbFamily(gltfModel, g, {
        scale: 0.11,
        position: [0, 1.15, -1.0],
        pedestalColor: 0xdfefc0,
        lightColor: 0xfffae0,
        starColor: 0xa8f080
    });

    if (!hasGlb) {
        // Figures
        const p1 = makeFigure({ bodyColor: 0x8b5e3c, headColor: 0xc8935a, hat: true });
        p1.position.set(-1.0, 0, -1.0);
        g.add(p1);

        const p2 = makeFigure({ bodyColor: 0xd63384, headColor: 0xc8935a });
        p2.position.set(0.2, 0, -1.2);
        p2.rotation.y = 0.2;
        g.add(p2);

        const child = makeFigure({ bodyColor: 0xf4c430, headColor: 0xc8935a, scale: 0.73 });
        child.position.set(1.1, 0, -0.7);
        g.add(child);

        g.userData.figures = [p1, p2, child];
    }

    // Farm prop: small tree
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, 1.2, 8),
        new THREE.MeshLambertMaterial({ color: 0x7a5c2e })
    );
    trunk.position.set(-1.8, 0.6, -2.0);
    trunk.castShadow = true;
    trunk.matrixAutoUpdate = false;
    trunk.updateMatrix();
    g.add(trunk);

    const leaves = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0x3a8a3a })
    );
    leaves.position.set(-1.8, 1.65, -2.0);
    leaves.castShadow = true;
    leaves.matrixAutoUpdate = false;
    leaves.updateMatrix();
    g.add(leaves);

    g.userData.label   = arch.userData.label;
    return g;
}

function buildFamilyC(gltfModel, houseModel = null) {
    const g = new THREE.Group();
    g.add(makeGroundPatch(0xbdd8f0));  // cool blue — city courtyard

    const arch = makeBackdrop(0x2b9c8e, 'Punjabi Family');
    g.add(arch);

    // Northwestern House backdrop
    setupGlbHouse(houseModel, g, {
        scale: 1.80,
        position: [0, 1.80, -2.5]
    });

    // Punjabi Family (standing in front of house on glowing pedestal)
    const hasGlb = setupGlbFamily(gltfModel, g, {
        scale: 0.11,
        position: [0, 1.15, -1.0],
        pedestalColor: 0xc8e0f8,
        lightColor: 0xe8f4ff,
        starColor: 0x80d0ff
    });

    if (!hasGlb) {
        // Figures — grandparent + parent + child
        const gp = makeFigure({ bodyColor: 0x7a8090, headColor: 0xf0e0d0, scale: 1.02 });
        gp.position.set(-1.0, 0, -1.0);
        g.add(gp);

        const p = makeFigure({ bodyColor: 0x2b9c8e, headColor: 0xf5c8a0 });
        p.position.set(0.2, 0, -1.2);
        p.rotation.y = -0.2;
        g.add(p);

        const child = makeFigure({ bodyColor: 0x9b59b6, headColor: 0xf5c8a0, scale: 0.74 });
        child.position.set(1.1, 0, -0.7);
        g.add(child);

        g.userData.figures = [gp, p, child];
    }

    // City prop: small fountain
    const basin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.40, 0.18, 14),
        new THREE.MeshLambertMaterial({ color: 0x9e9e9e })
    );
    basin.position.set(-2.0, 0.09, -2.0);
    basin.receiveShadow = true;
    basin.matrixAutoUpdate = false;
    basin.updateMatrix();
    g.add(basin);

    const water = new THREE.Mesh(
        new THREE.CircleGeometry(0.38, 14),
        new THREE.MeshBasicMaterial({ color: 0x64b5f6, toneMapped: false })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(-2.0, 0.19, -2.0);
    water.matrixAutoUpdate = false;
    water.updateMatrix();
    g.add(water);

    g.userData.label   = arch.userData.label;
    return g;
}

/* ================================================================ */

function makeIconBadge(emoji, color) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(20, 20, 216, 216, 40);
    ctx.fill();
    ctx.font = '110px serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 128, 128);
    const tex  = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.6),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })
    );
}

/* ================================================================ */

export class World {
    constructor(scene, tweener) {
        this.scene   = scene;
        this.tweener = tweener;

        this.familyA      = null;
        this.familyB      = null;
        this.familyC      = null;
        this.captionLabel = null;
        this.ahaGroup     = null;
        this.finalLabel   = null;
        this._garden      = null;
        this._elapsed     = 0;
    }

    /** Load external GLTF model with safe error fallback */
    async loadModel(url) {
        return new Promise((resolve) => {
            const loader = new GLTFLoader();
            loader.load(
                url,
                (gltf) => resolve(gltf),
                undefined,
                (err) => {
                    console.warn(`[GLTFLoader] Warning loading ${url}:`, err);
                    resolve(null);
                }
            );
        });
    }

    build(models = {}) {
        // 360° garden sky + ground + trees
        this._garden = new GardenEnvironment(this.scene, {
            path:       false,    // path would look odd mid-field
            flowers:    true,
            treeRadius: 15,
            treeCount:  22
        });
        this._garden.build();

        this._buildLighting();
        this._buildCaption();

        // Support both single model (legacy) or multi-model object { familyA, familyB, familyC, houseA, houseB, houseC }
        const gltfA = models?.familyA || (models?.scene ? models : null);
        const gltfB = models?.familyB || null;
        const gltfC = models?.familyC || null;
        const houseA = models?.houseA || null;
        const houseB = models?.houseB || null;
        const houseC = models?.houseC || null;

        // Family groups — Family A (myfamily + southindianhouse), Family B (northindian + northindianhouse), Family C (northwestfamily + northwesternhouse)
        this.familyA = buildFamilyA(gltfA, houseA);
        this.familyB = buildFamilyB(gltfB, houseB);
        this.familyC = buildFamilyC(gltfC, houseC);

        // Initial positions: A at centre (first beat), B and C off-screen to sides
        this.familyA.position.set(-5.5, 0, 0);
        this.familyB.position.set(0,    0, 0);
        this.familyC.position.set(5.5,  0, 0);

        [this.familyA, this.familyB, this.familyC].forEach((f) => {
            f.visible = false;
            this.scene.add(f);
        });

        this._buildAha();
        this._buildFinalMessage();
    }

    _buildLighting() {
        this.scene.background = null;  // sky dome handles it

        const ambient = new THREE.AmbientLight(0xfff5e8, 0.65);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0xffd880, 1.9);
        sun.position.set(-12, 20, 12);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.near   = 0.5;
        sun.shadow.camera.far    = 50;
        sun.shadow.camera.left   = -12;
        sun.shadow.camera.right  = 12;
        sun.shadow.camera.top    = 10;
        sun.shadow.camera.bottom = -10;
        sun.shadow.bias = -0.001;
        this.scene.add(sun);

        const fill = new THREE.DirectionalLight(0xc8e8ff, 0.38);
        fill.position.set(8, 6, 8);
        fill.matrixAutoUpdate = false;
        fill.updateMatrix();
        this.scene.add(fill);
    }

    _buildCaption() {
        // Dialogue subtitle box removed entirely per user request
        this.captionLabel = null;
    }

    _buildAha() {
        // 5 icons removed per user request
        this.ahaGroup = null;
    }

    _buildFinalMessage() {
        this.finalLabel = new TextLabel({
            text:        '❤️ Every Family Is Special',
            worldWidth:  4.0,
            fontSize:    80,
            color:       '#ffe082',
            background:  'rgba(25,8,55,0.88)',
            borderColor: '#ffd54f',
            borderWidth: 4,
            padding:     34
        });
        this.finalLabel.mesh.position.set(0, 3.1, -0.80);
        this.finalLabel.mesh.matrixAutoUpdate = true;
        this.finalLabel.mesh.visible = false;
        this.scene.add(this.finalLabel.mesh);
    }

    /* -------------------------------------------------------------- API */

    say(text) {
        // Dialogue subtitle box removed entirely per user request
    }

    showFamily(which) {
        const map = { A: this.familyA, B: this.familyB, C: this.familyC };
        [this.familyA, this.familyB, this.familyC].forEach((f) => { f.visible = false; });

        const fam = map[which];
        if (!fam) return Promise.resolve();

        const targetX = 0;
        const fromX   = fam.position.x;
        fam.visible   = true;

        return this.tweener.add(2.0, (p) => {
            fam.position.x = fromX + (targetX - fromX) * p;
        });
    }

    showAllFamilies() {
        const targets = { A: -4.2, B: 0, C: 4.2 };
        const froms   = {
            A: this.familyA.position.x,
            B: this.familyB.position.x,
            C: this.familyC.position.x
        };

        [this.familyA, this.familyB, this.familyC].forEach((f) => { f.visible = true; });

        return this.tweener.add(2.0, (p) => {
            this.familyA.position.x = froms.A + (targets.A - froms.A) * p;
            this.familyB.position.x = froms.B + (targets.B - froms.B) * p;
            this.familyC.position.x = froms.C + (targets.C - froms.C) * p;
        });
    }

    showAha(visible) {
        // 5 icons removed per user request
    }

    showFinalMessage(visible) {
        if (this.finalLabel?.mesh) this.finalLabel.mesh.visible = visible;
    }

    triggerInteraction() {
        [this.familyA, this.familyB, this.familyC].forEach((fam) => {
            if (fam?.visible && fam.userData?.glbModel) {
                const m = fam.userData.glbModel;
                this.tweener.add(0.7, (p) => {
                    const s = 0.11 * (1 + Math.sin(p * Math.PI) * 0.18);
                    m.scale.set(s, s, s);
                    m.rotation.z = Math.PI / 2 + Math.sin(p * Math.PI * 2) * 0.10;
                });
            }
        });
    }

    /* -------------------------------------------------------------- loop */

    update(dt, elapsed) {
        this._elapsed = elapsed;

        // Cloud drift
        this._garden?.update(elapsed);

        // Animate all visible family figures
        [this.familyA, this.familyB, this.familyC].forEach((fam, fi) => {
            if (!fam?.visible) return;
            if (fam.userData.glbModel) {
                fam.userData.glbModel.position.y = 1.15 + Math.sin(elapsed * 2.0 + fi) * 0.035;
                fam.userData.glbModel.rotation.z = Math.PI / 2 + Math.sin(elapsed * 1.2) * 0.02;
            }
            if (fam.userData.sparkles) {
                fam.userData.sparkles.rotation.y = elapsed * 0.5;
                fam.userData.sparkles.children.forEach((star) => {
                    star.position.y = star.userData.baseY + Math.sin(elapsed * 3.0 + star.userData.phase) * 0.08;
                    star.rotation.x = elapsed * 2.0;
                    star.rotation.z = elapsed * 1.5;
                });
            }
            fam.userData.figures?.forEach((fig, i) => {
                if (!fig?.userData?.animated) return;
                const t = elapsed + fi * 1.4 + i * 0.8;
                if (fig.userData.head) fig.userData.head.position.y = 1.55 + Math.sin(t * 1.1) * 0.012;
                if (fig.userData.lArm) fig.userData.lArm.rotation.z = 0.30 + Math.sin(t * 1.3) * 0.07;
                if (fig.userData.rArm) fig.userData.rArm.rotation.z = -0.30 + Math.sin(t * 1.3 + Math.PI) * 0.07;
            });

            // Family labels face viewer
            if (fam.userData.label?.mesh) {
                const wp = new THREE.Vector3();
                fam.getWorldPosition(wp);
                fam.userData.label.mesh.lookAt(wp.x, 2.95, 5);
            }
        });

        // Final label faces viewer
        if (this.finalLabel?.mesh?.visible) this.finalLabel.mesh.lookAt(0, 3.5, 5);
    }
}
