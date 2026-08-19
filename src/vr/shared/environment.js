import * as THREE from 'three';

/* ============================================================================
   Garden Environment — shared by both VR concepts
   ---------------------------------------------------------------------------
   Creates a full 360° immersive garden backdrop:

   • Sky dome     — large inverted sphere with vertical gradient (zenith blue
                    → horizon warm white). Seen from every direction in VR.
   • Sun disk     — emissive mesh at the sun position, gives the warm glow
   • Clouds       — a handful of white grouped spheres drifting slowly
   • Ground       — large canvas-textured grass plane
   • Trees        — ring of stylized trees (trunk + foliage) around the scene
   • Flowers      — scattered small coloured patches
   • Path         — simple stone-coloured strip leading toward the viewer

   All geometry is static after build() so matrixAutoUpdate is set to false.
   The clouds and maybe the time-of-day tint change can be driven via update().
   ========================================================================== */

const TWO_PI = Math.PI * 2;

/* ------------------------------------------------------------------
   Sky dome with vertical gradient
   ------------------------------------------------------------------ */
function buildSkyDome() {
    // Canvas gradient painted on a sphere interior.
    const SIZE = 512;
    const canvas = document.createElement('canvas');
    canvas.width  = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, SIZE);
    grad.addColorStop(0.00, '#4fc3f7');  // zenith — rich sky blue
    grad.addColorStop(0.45, '#81d4fa');  // mid sky
    grad.addColorStop(0.70, '#b3e5fc');  // near horizon
    grad.addColorStop(0.85, '#ffe0b2');  // warm horizon glow
    grad.addColorStop(1.00, '#ffcc80');  // ground horizon
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const geo = new THREE.SphereGeometry(80, 32, 16);
    const mat = new THREE.MeshBasicMaterial({
        map: tex,
        side: THREE.BackSide,
        toneMapped: false,
        depthWrite: false
    });
    const dome = new THREE.Mesh(geo, mat);
    dome.renderOrder = -1;
    dome.matrixAutoUpdate = false;
    dome.updateMatrix();
    return dome;
}

/* ------------------------------------------------------------------
   Sun disc — emissive, placed at ~45° elevation
   ------------------------------------------------------------------ */
function buildSun() {
    const geo = new THREE.CircleGeometry(3.5, 32);
    const mat = new THREE.MeshBasicMaterial({
        color: 0xfffde7, transparent: true, opacity: 0.92,
        toneMapped: false, depthWrite: false
    });
    const sun = new THREE.Mesh(geo, mat);
    sun.position.set(-35, 42, -50);
    sun.lookAt(0, 0, 0);
    sun.matrixAutoUpdate = false;
    sun.updateMatrix();

    // Soft halo
    const haloGeo = new THREE.CircleGeometry(6.5, 32);
    const haloMat = new THREE.MeshBasicMaterial({
        color: 0xfff8e1, transparent: true, opacity: 0.28,
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
   Clouds — small groups of white spheres
   ------------------------------------------------------------------ */
function buildCloud(x, y, z, scale = 1) {
    const g    = new THREE.Group();
    const mat  = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const blobs = [
        [0, 0, 0, 2.4],
        [2.2, 0.3, 0, 1.8],
        [-2.1, 0.2, 0, 1.7],
        [0.8, 0.9, 0.5, 1.4],
        [-0.7, 0.8, -0.3, 1.3]
    ];
    blobs.forEach(([bx, by, bz, r]) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r * scale, 10, 7), mat);
        m.position.set(bx * scale, by * scale, bz * scale);
        m.matrixAutoUpdate = false;
        m.updateMatrix();
        g.add(m);
    });
    g.position.set(x, y, z);
    g.userData.baseX  = x;
    g.userData.driftSpeed = 0.3 + Math.random() * 0.4;
    g.userData.driftRange = 4 + Math.random() * 3;
    return g;
}

function buildClouds() {
    const clouds = [];
    const specs = [
        [-28, 22, -50, 1.1],
        [ 20, 26, -48, 0.9],
        [-10, 18, -45, 1.3],
        [ 40, 20, -30, 0.85],
        [-38, 24, -25, 1.0],
        [  5, 30, -60, 1.2],
        [-20, 28, -38, 0.75]
    ];
    specs.forEach(([x, y, z, s]) => clouds.push(buildCloud(x, y, z, s)));
    return clouds;
}

/* ------------------------------------------------------------------
   Ground — large canvas grass texture
   ------------------------------------------------------------------ */
function buildGround() {
    const SIZE = 512;
    const canvas = document.createElement('canvas');
    canvas.width  = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');

    // Base green
    ctx.fillStyle = '#5aaa5a';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Darker blotches for variation
    for (let i = 0; i < 140; i++) {
        const x = Math.random() * SIZE;
        const y = Math.random() * SIZE;
        const r = 8 + Math.random() * 28;
        const shade = Math.random() > 0.5 ? '#4caf4c' : '#63bc63';
        ctx.fillStyle = shade;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.65, Math.random() * Math.PI, 0, TWO_PI);
        ctx.fill();
    }

    // Blade hints — tiny darker lines
    ctx.strokeStyle = 'rgba(30,90,30,0.25)';
    ctx.lineWidth   = 1;
    for (let i = 0; i < 280; i++) {
        const x = Math.random() * SIZE;
        const y = Math.random() * SIZE;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 8, y - 6 - Math.random() * 8);
        ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace  = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);

    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(160, 160),
        new THREE.MeshLambertMaterial({ map: tex })
    );
    mesh.rotation.x   = -Math.PI / 2;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
}

/* ------------------------------------------------------------------
   Stone path
   ------------------------------------------------------------------ */
function buildPath() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xd4c8a8 });

    const stones = [];
    // A simple linear path from z=2 to z=6 toward viewer
    for (let z = -3; z <= 5; z++) {
        for (const x of [-0.45, 0.45]) {
            const stone = new THREE.Mesh(
                new THREE.CylinderGeometry(0.28, 0.30, 0.06, 8),
                mat
            );
            stone.rotation.y   = Math.random() * Math.PI;
            stone.position.set(x + (Math.random() - 0.5) * 0.18, 0.03, z * 0.8);
            stone.receiveShadow = true;
            stone.matrixAutoUpdate = false;
            stone.updateMatrix();
            stones.push(stone);
        }
    }
    return stones;
}

/* ------------------------------------------------------------------
   Stylized tree
   ------------------------------------------------------------------ */
function buildTree(x, z, height = 2.8, foliageColor = 0x2e8b44) {
    const g = new THREE.Group();

    // Trunk
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.16, height * 0.4, 8),
        new THREE.MeshLambertMaterial({ color: 0x7a5c2e })
    );
    trunk.position.y   = height * 0.2;
    trunk.castShadow   = true;
    trunk.matrixAutoUpdate = false;
    trunk.updateMatrix();
    g.add(trunk);

    // Main foliage sphere
    const foliage = new THREE.Mesh(
        new THREE.SphereGeometry(height * 0.34, 10, 8),
        new THREE.MeshLambertMaterial({ color: foliageColor })
    );
    foliage.position.y = height * 0.55;
    foliage.castShadow = true;
    foliage.matrixAutoUpdate = false;
    foliage.updateMatrix();
    g.add(foliage);

    // Secondary foliage
    const f2 = new THREE.Mesh(
        new THREE.SphereGeometry(height * 0.24, 8, 7),
        new THREE.MeshLambertMaterial({ color: new THREE.Color(foliageColor).multiplyScalar(0.85) })
    );
    f2.position.set(height * 0.22, height * 0.65, 0);
    f2.castShadow = true;
    f2.matrixAutoUpdate = false;
    f2.updateMatrix();
    g.add(f2);

    g.position.set(x, 0, z);
    g.matrixAutoUpdate = false;
    g.updateMatrix();
    return g;
}

function buildTreeRing(radius = 14, count = 18) {
    const trees = [];
    const greens = [0x2e8b44, 0x38a858, 0x256e36, 0x3db060, 0x27774c];
    for (let i = 0; i < count; i++) {
        const angle  = (i / count) * TWO_PI;
        const r      = radius + (Math.random() - 0.5) * 3;
        const x      = Math.cos(angle) * r;
        const z      = Math.sin(angle) * r;
        const height = 2.4 + Math.random() * 1.4;
        const color  = greens[i % greens.length];
        trees.push(buildTree(x, z, height, color));
    }
    return trees;
}

/* ------------------------------------------------------------------
   Flowers — small coloured disc/cylinder patches
   ------------------------------------------------------------------ */
function buildFlowers(count = 60) {
    const meshes = [];
    const colors = [0xff6b8a, 0xffd740, 0xff9e57, 0xce93d8, 0x80deea, 0xffffff];
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x4aaa4a });

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * TWO_PI;
        const dist  = 3 + Math.random() * 10;
        const x     = Math.cos(angle) * dist;
        const z     = Math.sin(angle) * dist;

        // Stem
        const stem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.015, 0.22, 5),
            stemMat
        );
        stem.position.set(x, 0.11, z);
        stem.matrixAutoUpdate = false;
        stem.updateMatrix();
        meshes.push(stem);

        // Head
        const head = new THREE.Mesh(
            new THREE.CircleGeometry(0.07, 8),
            new THREE.MeshLambertMaterial({ color: colors[i % colors.length], side: THREE.DoubleSide })
        );
        head.position.set(x, 0.23, z);
        head.rotation.x = -Math.PI / 2;
        head.matrixAutoUpdate = false;
        head.updateMatrix();
        meshes.push(head);
    }
    return meshes;
}

/* ============================================================
   Exported class
   ============================================================ */

export class GardenEnvironment {
    /**
     * @param {THREE.Scene} scene
     * @param {object} [opts]
     * @param {boolean} [opts.path=true]     include stone path
     * @param {boolean} [opts.flowers=true]  include flowers
     * @param {number}  [opts.treeRadius=14] tree ring radius
     * @param {number}  [opts.treeCount=18]  number of trees
     */
    constructor(scene, opts = {}) {
        this.scene   = scene;
        this.opts    = { path: true, flowers: true, treeRadius: 14, treeCount: 18, ...opts };
        this._clouds = [];
        this._sunLight = null;
    }

    build() {
        // Sky dome
        this.scene.add(buildSkyDome());

        // Sun
        const [sun, halo] = buildSun();
        this.scene.add(sun);
        this.scene.add(halo);

        // Clouds
        this._clouds = buildClouds();
        this._clouds.forEach((c) => this.scene.add(c));

        // Ground
        this.scene.add(buildGround());

        // Path
        if (this.opts.path) {
            buildPath().forEach((s) => this.scene.add(s));
        }

        // Tree ring
        buildTreeRing(this.opts.treeRadius, this.opts.treeCount)
            .forEach((t) => this.scene.add(t));

        // Flowers
        if (this.opts.flowers) {
            buildFlowers().forEach((f) => this.scene.add(f));
        }

        return this;
    }

    /** Call from the render loop — animates cloud drift only. */
    update(elapsed) {
        this._clouds.forEach((cloud) => {
            cloud.position.x = cloud.userData.baseX +
                Math.sin(elapsed * cloud.userData.driftSpeed) * cloud.userData.driftRange;
        });
    }

    /** Tint the sky dome canvas for time-of-day (optional, called from world). */
    setSkyTint(color) {
        // simple: adjust scene fog colour or ambient if needed
        // no-op if not used — lighting handles most of the mood
    }
}
