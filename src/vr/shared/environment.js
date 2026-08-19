import * as THREE from 'three';

/* ============================================================================
   Garden Environment — Realistic 360° Immersive Nature Backdrop
   ---------------------------------------------------------------------------
   Creates a lush, realistic, full 360° outdoor garden:
     • 360° Sky Dome with horizon hills, atmospheric haze, and rich zenith gradient
     • Radiant sun with soft atmospheric glow & volumetric cumulus clouds
     • High-detail procedural grass lawn with natural tone variation
     • Double-ring organic forest & flowering trees (blossoms + lush canopies)
     • 3D garden shrubs, colorful flower clusters, and natural stepping stone path
     • Floating gentle garden pollen/fireflies drifting softly in the breeze
   ========================================================================== */

const TWO_PI = Math.PI * 2;

/* ------------------------------------------------------------------
   360° Sky Dome with Horizon Mountain / Hills Landscape
   ------------------------------------------------------------------ */
function buildRealisticSkyDome() {
    const SIZE = 1024;
    const canvas = document.createElement('canvas');
    canvas.width  = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    // Vertical atmospheric gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, SIZE);
    skyGrad.addColorStop(0.00, '#1976d2');  // Deep sky blue at zenith
    skyGrad.addColorStop(0.35, '#42a5f5');  // Mid sky
    skyGrad.addColorStop(0.60, '#81d4fa');  // Soft light sky
    skyGrad.addColorStop(0.72, '#b3e5fc');  // Atmospheric haze
    skyGrad.addColorStop(0.82, '#fff3e0');  // Warm horizon glow
    skyGrad.addColorStop(0.92, '#ffe0b2');  // Sunset amber horizon
    skyGrad.addColorStop(1.00, '#c8e6c9');  // Ground transition
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Distant soft hill silhouettes along the horizon (360° panorama band)
    const horizonY = SIZE * 0.82;

    // Layer 1: Distant blue-green mountain ridge
    ctx.fillStyle = 'rgba(76, 120, 110, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let x = 0; x <= SIZE; x += 16) {
        const h1 = Math.sin(x * 0.02) * 28 + Math.sin(x * 0.05 + 1.2) * 14 + Math.cos(x * 0.01) * 35;
        ctx.lineTo(x, horizonY - 30 - h1);
    }
    ctx.lineTo(SIZE, SIZE);
    ctx.lineTo(0, SIZE);
    ctx.closePath();
    ctx.fill();

    // Layer 2: Nearer green rolling hills & woodland ridge
    ctx.fillStyle = 'rgba(56, 110, 60, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let x = 0; x <= SIZE; x += 12) {
        const h2 = Math.sin(x * 0.035 + 0.8) * 18 + Math.sin(x * 0.08) * 9 + Math.cos(x * 0.015) * 22;
        ctx.lineTo(x, horizonY - 10 - h2);
    }
    ctx.lineTo(SIZE, SIZE);
    ctx.lineTo(0, SIZE);
    ctx.closePath();
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.SphereGeometry(90, 48, 24);
    const mat = new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.BackSide,
        toneMapped: false,
        depthWrite: false
    });
    const dome = new THREE.Mesh(geo, mat);
    dome.renderOrder = -10;
    dome.matrixAutoUpdate = false;
    dome.updateMatrix();
    return dome;
}

/* ------------------------------------------------------------------
   Sun & Atmospheric Corona
   ------------------------------------------------------------------ */
function buildSun() {
    const geo = new THREE.CircleGeometry(4.0, 32);
    const mat = new THREE.MeshBasicMaterial({
        color: 0xfffde7, transparent: true, opacity: 0.95,
        toneMapped: false, depthWrite: false
    });
    const sun = new THREE.Mesh(geo, mat);
    sun.position.set(-38, 44, -52);
    sun.lookAt(0, 0, 0);
    sun.matrixAutoUpdate = false;
    sun.updateMatrix();

    // Soft multi-layer halo
    const haloGeo = new THREE.CircleGeometry(8.5, 32);
    const haloMat = new THREE.MeshBasicMaterial({
        color: 0xffe082, transparent: true, opacity: 0.32,
        toneMapped: false, depthWrite: false
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.copy(sun.position);
    halo.lookAt(0, 0, 0);
    halo.matrixAutoUpdate = false;
    halo.updateMatrix();

    return [sun, halo];
}

/* ------------------------------------------------------------------
   Fluffy Volumetric Clouds
   ------------------------------------------------------------------ */
function buildCloud(x, y, z, scale = 1) {
    const g   = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const blobs = [
        [0, 0, 0, 2.6],
        [2.3, 0.2, 0, 2.0],
        [-2.2, 0.1, 0, 1.9],
        [1.0, 0.9, 0.4, 1.6],
        [-0.8, 0.8, -0.3, 1.5],
        [3.6, -0.2, 0, 1.3],
        [-3.4, -0.2, 0, 1.2]
    ];
    blobs.forEach(([bx, by, bz, r]) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r * scale, 10, 8), mat);
        m.position.set(bx * scale, by * scale, bz * scale);
        m.matrixAutoUpdate = false;
        m.updateMatrix();
        g.add(m);
    });
    g.position.set(x, y, z);
    g.userData.baseX = x;
    g.userData.driftSpeed = 0.25 + Math.random() * 0.35;
    g.userData.driftRange = 5 + Math.random() * 4;
    return g;
}

function buildClouds() {
    const specs = [
        [-35, 26, -55, 1.2],
        [ 25, 30, -50, 1.0],
        [-12, 22, -48, 1.35],
        [ 42, 24, -32, 0.95],
        [-42, 28, -22, 1.1],
        [  8, 34, -65, 1.3],
        [-25, 32, -40, 0.85],
        [ 18, 20,  45, 1.15],
        [-30, 25,  40, 1.0]
    ];
    return specs.map(([x, y, z, s]) => buildCloud(x, y, z, s));
}

/* ------------------------------------------------------------------
   High-Detail Natural Grass Lawn
   ------------------------------------------------------------------ */
function buildRealisticGround() {
    const SIZE = 1024;
    const canvas = document.createElement('canvas');
    canvas.width  = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    // Base rich garden green
    ctx.fillStyle = '#4a9c4a';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Multi-shade organic patches (meadow textures)
    for (let i = 0; i < 260; i++) {
        const x = Math.random() * SIZE;
        const y = Math.random() * SIZE;
        const r = 10 + Math.random() * 40;
        const shades = ['#3d8b3d', '#52aa52', '#347c34', '#5cbd5c', '#449644'];
        ctx.fillStyle = shades[Math.floor(Math.random() * shades.length)];
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.5 + Math.random() * 0.5), Math.random() * Math.PI, 0, TWO_PI);
        ctx.fill();
    }

    // Fine grass blade hints
    ctx.strokeStyle = 'rgba(25, 75, 25, 0.32)';
    ctx.lineWidth   = 1.2;
    for (let i = 0; i < 600; i++) {
        const x = Math.random() * SIZE;
        const y = Math.random() * SIZE;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 10, y - 6 - Math.random() * 12);
        ctx.stroke();
    }

    // Little clover / flower accents in grass
    for (let i = 0; i < 80; i++) {
        const x = Math.random() * SIZE;
        const y = Math.random() * SIZE;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 235, 59, 0.45)';
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, TWO_PI);
        ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace  = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 16);

    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshLambertMaterial({ map: tex })
    );
    mesh.rotation.x   = -Math.PI / 2;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
}

/* ------------------------------------------------------------------
   Natural Stepping Stone Pathway
   ------------------------------------------------------------------ */
function buildPath() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xd8cbaf });
    const stones = [];

    for (let z = -3; z <= 6; z++) {
        for (const x of [-0.48, 0.48]) {
            const rx = 0.28 + Math.random() * 0.08;
            const rz = 0.24 + Math.random() * 0.08;
            const stone = new THREE.Mesh(
                new THREE.CylinderGeometry(rx, rz, 0.05, 10),
                mat
            );
            stone.rotation.y = Math.random() * Math.PI;
            stone.position.set(x + (Math.random() - 0.5) * 0.16, 0.026, z * 0.78 + (Math.random() - 0.5) * 0.1);
            stone.receiveShadow = true;
            stone.matrixAutoUpdate = false;
            stone.updateMatrix();
            stones.push(stone);
        }
    }
    return stones;
}

/* ------------------------------------------------------------------
   Organic Realistic 3D Trees with Branching & Multi-Foliage Canopies
   ------------------------------------------------------------------ */
function buildRealisticTree(x, z, height = 3.2, foliageColor = 0x2e8b44, isBlossom = false) {
    const g = new THREE.Group();

    // Natural wood trunk with taper
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c4028 });
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.22, height * 0.45, 10),
        trunkMat
    );
    trunk.position.y = height * 0.225;
    trunk.castShadow = true;
    trunk.matrixAutoUpdate = false;
    trunk.updateMatrix();
    g.add(trunk);

    // Tree canopy material
    const baseColor = new THREE.Color(foliageColor);
    const canopyMat = new THREE.MeshLambertMaterial({ color: baseColor });
    const highlightMat = new THREE.MeshLambertMaterial({ color: baseColor.clone().offsetHSL(0.04, 0.1, 0.08) });
    const darkMat = new THREE.MeshLambertMaterial({ color: baseColor.clone().offsetHSL(-0.02, 0.0, -0.12) });

    // Multi-cluster volumetric crown (4 to 6 natural leaf clusters)
    const clusters = [
        { pos: [0, height * 0.65, 0], scale: height * 0.38, mat: canopyMat },
        { pos: [height * 0.22, height * 0.72, height * 0.15], scale: height * 0.28, mat: highlightMat },
        { pos: [-height * 0.20, height * 0.68, -height * 0.12], scale: height * 0.26, mat: darkMat },
        { pos: [0, height * 0.88, 0], scale: height * 0.25, mat: highlightMat },
        { pos: [-height * 0.12, height * 0.55, height * 0.18], scale: height * 0.24, mat: darkMat },
    ];

    clusters.forEach(({ pos, scale, mat: m }) => {
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(scale, 10, 8), m);
        sphere.position.fromArray(pos);
        sphere.castShadow = true;
        sphere.matrixAutoUpdate = false;
        sphere.updateMatrix();
        g.add(sphere);
    });

    // If flowering tree, scatter blossom dots on canopy
    if (isBlossom) {
        const blossomMat = new THREE.MeshBasicMaterial({
            color: [0xff80ab, 0xffab40, 0xffd54f, 0xff4081][Math.floor(Math.random() * 4)],
            side: THREE.DoubleSide
        });
        for (let b = 0; b < 12; b++) {
            const dot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 6), blossomMat);
            const a = Math.random() * TWO_PI;
            const r = height * (0.22 + Math.random() * 0.18);
            dot.position.set(Math.cos(a) * r, height * (0.58 + Math.random() * 0.3), Math.sin(a) * r);
            dot.rotation.set(Math.random(), Math.random(), Math.random());
            dot.matrixAutoUpdate = false;
            dot.updateMatrix();
            g.add(dot);
        }
    }

    g.position.set(x, 0, z);
    g.matrixAutoUpdate = false;
    g.updateMatrix();
    return g;
}

function buildTreeRing(radius = 16, count = 24) {
    const trees = [];
    const greens = [0x2e8b44, 0x38a858, 0x256e36, 0x43a047, 0x1b5e20, 0x4caf50];

    // Inner ring (decorative garden trees + flowering trees)
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * TWO_PI;
        const r = radius + (Math.random() - 0.5) * 3;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const height = 2.8 + Math.random() * 1.5;
        const color = greens[i % greens.length];
        const isBlossom = i % 3 === 0;
        trees.push(buildRealisticTree(x, z, height, color, isBlossom));
    }

    // Outer dense woodland ring (creating a 360° lush horizon wall)
    const outerCount = 28;
    const outerRadius = radius + 9;
    for (let i = 0; i < outerCount; i++) {
        const angle = (i / outerCount) * TWO_PI;
        const r = outerRadius + (Math.random() - 0.5) * 4;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const height = 4.0 + Math.random() * 2.2;
        const color = greens[(i + 2) % greens.length];
        trees.push(buildRealisticTree(x, z, height, color, false));
    }

    return trees;
}

/* ------------------------------------------------------------------
   Vibrant Garden Flower Clusters & Shrubs
   ------------------------------------------------------------------ */
function buildGardenShrubs(count = 20) {
    const shrubs = [];
    const shrubMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
    const flowerMats = [
        new THREE.MeshBasicMaterial({ color: 0xff4081, side: THREE.DoubleSide }),
        new THREE.MeshBasicMaterial({ color: 0xffd54f, side: THREE.DoubleSide }),
        new THREE.MeshBasicMaterial({ color: 0xff6e40, side: THREE.DoubleSide }),
        new THREE.MeshBasicMaterial({ color: 0xb388ff, side: THREE.DoubleSide }),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    ];

    for (let i = 0; i < count; i++) {
        const g = new THREE.Group();
        const angle = (i / count) * TWO_PI + (Math.random() - 0.5) * 0.3;
        const dist  = 6.5 + Math.random() * 7.5;
        const x     = Math.cos(angle) * dist;
        const z     = Math.sin(angle) * dist;
        const rad   = 0.45 + Math.random() * 0.35;

        // Bush body
        const bush = new THREE.Mesh(new THREE.SphereGeometry(rad, 8, 7), shrubMat);
        bush.position.y = rad * 0.75;
        bush.castShadow = true;
        bush.matrixAutoUpdate = false;
        bush.updateMatrix();
        g.add(bush);

        // Flower blossoms on the bush
        const fMat = flowerMats[i % flowerMats.length];
        for (let b = 0; b < 6; b++) {
            const flower = new THREE.Mesh(new THREE.CircleGeometry(0.09, 6), fMat);
            const fa = Math.random() * TWO_PI;
            flower.position.set(Math.cos(fa) * rad * 0.85, rad * 0.75 + Math.sin(b * 1.5) * rad * 0.4, Math.sin(fa) * rad * 0.85);
            flower.rotation.set(Math.random(), Math.random(), Math.random());
            flower.matrixAutoUpdate = false;
            flower.updateMatrix();
            g.add(flower);
        }

        g.position.set(x, 0, z);
        g.matrixAutoUpdate = false;
        g.updateMatrix();
        shrubs.push(g);
    }
    return shrubs;
}

/* ------------------------------------------------------------------
   Floating Gentle Garden Pollen / Fireflies (Drifting Ambient Light)
   ------------------------------------------------------------------ */
function buildAmbientPollen(count = 24) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xfff9c4, side: THREE.DoubleSide });

    for (let i = 0; i < count; i++) {
        const p = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), mat);
        const angle = Math.random() * TWO_PI;
        const r = 2.0 + Math.random() * 8.0;
        p.position.set(Math.cos(angle) * r, 0.6 + Math.random() * 2.2, Math.sin(angle) * r);
        p.userData.baseY = p.position.y;
        p.userData.baseX = p.position.x;
        p.userData.phase = i * 0.7;
        p.userData.speed = 0.8 + Math.random() * 0.8;
        g.add(p);
    }
    return g;
}

/* ============================================================
   Exported GardenEnvironment Class
   ============================================================ */

export class GardenEnvironment {
    /**
     * @param {THREE.Scene} scene
     * @param {object} [opts]
     * @param {boolean} [opts.path=true]     include stone path
     * @param {boolean} [opts.flowers=true]  include flowers & shrubs
     * @param {number}  [opts.treeRadius=15] tree ring radius
     * @param {number}  [opts.treeCount=20]  number of inner trees
     */
    constructor(scene, opts = {}) {
        this.scene   = scene;
        this.opts    = { path: true, flowers: true, treeRadius: 15, treeCount: 20, ...opts };
        this._clouds = [];
        this._pollen = null;
    }

    build() {
        // 360° Sky Dome with horizon hills
        this.scene.add(buildRealisticSkyDome());

        // Sun & atmospheric corona
        const [sun, halo] = buildSun();
        this.scene.add(sun);
        this.scene.add(halo);

        // Fluffy volumetric clouds
        this._clouds = buildClouds();
        this._clouds.forEach((c) => this.scene.add(c));

        // Realistic lush lawn ground
        this.scene.add(buildRealisticGround());

        // Stepping stone path
        if (this.opts.path) {
            buildPath().forEach((s) => this.scene.add(s));
        }

        // Dual-layer tree forest (inner flowering + outer dense woodland)
        buildTreeRing(this.opts.treeRadius, this.opts.treeCount)
            .forEach((t) => this.scene.add(t));

        // Garden shrubs & flower clusters
        if (this.opts.flowers) {
            buildGardenShrubs(24).forEach((s) => this.scene.add(s));
        }

        // Gentle floating pollen / fairy light motes
        this._pollen = buildAmbientPollen(26);
        this.scene.add(this._pollen);

        return this;
    }

    /** Call from render loop — animates cloud drift & floating pollen */
    update(elapsed) {
        this._clouds.forEach((cloud) => {
            cloud.position.x = cloud.userData.baseX +
                Math.sin(elapsed * cloud.userData.driftSpeed) * cloud.userData.driftRange;
        });

        if (this._pollen) {
            this._pollen.children.forEach((p) => {
                p.position.y = p.userData.baseY + Math.sin(elapsed * p.userData.speed + p.userData.phase) * 0.15;
                p.position.x = p.userData.baseX + Math.cos(elapsed * 0.5 + p.userData.phase) * 0.18;
                p.rotation.y += 0.02;
            });
        }
    }
}
