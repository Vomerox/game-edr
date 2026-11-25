// ==========================================
// GAME EDR - MOTEUR PRINCIPAL
// Style: Désert militaire cartoon
// ==========================================

// --- AUDIO (Synthèse Vocale + Bips) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(success) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = success ? 'sine' : 'sawtooth';
    osc.frequency.setValueAtTime(success ? 800 : 150, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

function speak(text) {
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'fr-FR';
    msg.pitch = 0.8;
    msg.rate = 1.1;
    window.speechSynthesis.speak(msg);
}

// --- INITIALISATION THREE.JS ---
const scene = new THREE.Scene();

// Ciel désert dégradé (fond supérieur)
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0xd4c4a0, 80, 200);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 40, 40);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.85;
document.body.appendChild(renderer.domElement);
renderer.domElement.id = 'game-canvas';

// --- ÉCLAIRAGE DÉSERT ---
const ambientLight = new THREE.AmbientLight(0xfff5e0, 0.7);
scene.add(ambientLight);

// Lumière ciel/sol (rebond naturel)
const hemiLight = new THREE.HemisphereLight(0xcfe4ff, 0x8a6a40, 0.22);
scene.add(hemiLight);

// Soleil principal (chaud, direction désert) — ombres couvrant toute la zone de jeu
const sunLight = new THREE.DirectionalLight(0xffdd88, 1.2);
sunLight.position.set(30, 60, -20);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.left = -70;
sunLight.shadow.camera.right = 70;
sunLight.shadow.camera.top = 70;
sunLight.shadow.camera.bottom = -70;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 220;
sunLight.shadow.bias = -0.0006;
sunLight.shadow.normalBias = 0.03;
scene.add(sunLight);

// Lumière de remplissage (bleutée, ombres)
const fillLight = new THREE.DirectionalLight(0x88aaff, 0.3);
fillLight.position.set(-20, 30, 20);
scene.add(fillLight);

// --- TERRAIN (zone de jeu plane, dunes à l'horizon, variations de teinte) ---
const terrainGeo = new THREE.PlaneGeometry(640, 640, 128, 128);
const posAttr = terrainGeo.attributes.position;
const terrainColors = new Float32Array(posAttr.count * 3);
for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    posAttr.setZ(i, terrainHeight(x, -y));
    const n = 0.9 + 0.06 * Math.sin(x * 0.13 + y * 0.07) + 0.05 * Math.sin(x * 0.031 - y * 0.045) + (Math.random() - 0.5) * 0.05;
    terrainColors[i * 3] = n; terrainColors[i * 3 + 1] = n; terrainColors[i * 3 + 2] = n;
}
terrainGeo.setAttribute('color', new THREE.BufferAttribute(terrainColors, 3));
terrainGeo.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({
    color: 0xd4b56a,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
    vertexColors: true
});
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.rotation.x = -Math.PI / 2;
terrain.receiveShadow = true;
scene.add(terrain);

// Aire de déploiement (zone de jeu) légèrement marquée au sol
const deployPad = new THREE.Mesh(
    new THREE.CircleGeometry(48, 64),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.05, depthWrite: false })
);
deployPad.rotation.x = -Math.PI / 2;
deployPad.position.y = 0.02;
deployPad.scale.set(1.25, 0.75, 1);
scene.add(deployPad);

// --- DÉCORS DU DÉSERT ---
const decorGroup = new THREE.Group();
scene.add(decorGroup);

// Couleurs cartoon
const COLORS = {
    trunkBrown: 0x6b4226,
    leafGreen: 0x5a8a32,
    leafDark: 0x3d6b1e,
    rockGray: 0x8a7d6b,
    rockDark: 0x6b6052,
    metalRust: 0x8b5e3c,
    metalDark: 0x4a5a3a,
    tireDark: 0x2a2a2a,
    canvasKhaki: 0x9b8b6b,
    camoGreen: 0x4a5a2e,
    camoBrown: 0x6b5a3a,
    camoDark: 0x3a4a2a,
    screenGlow: 0x00ff44,
    antennaGray: 0x6a6a6a,
    cableYellow: 0xccaa44
};

// --- FONCTION: Palmier cartoon ---
function createPalmTree(x, z, scale) {
    const tree = new THREE.Group();

    // Tronc (courbé, segments)
    const trunkCurve = [];
    const segments = 6;
    const height = 8 * scale;
    const lean = (Math.random() - 0.5) * 3;
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        trunkCurve.push(new THREE.Vector3(
            lean * t * t,
            height * t,
            Math.sin(t * Math.PI) * 0.5
        ));
    }

    // Tronc cylindrique simplifié cartoon
    for (let i = 0; i < segments; i++) {
        const t = i / segments;
        const radius = 0.35 * scale * (1 - t * 0.4);
        const segGeo = new THREE.CylinderGeometry(radius * 0.85, radius, height / segments, 6);
        const segMat = new THREE.MeshStandardMaterial({
            color: COLORS.trunkBrown,
            roughness: 0.9,
            flatShading: true
        });
        const seg = new THREE.Mesh(segGeo, segMat);
        seg.position.copy(trunkCurve[i]);
        seg.position.y += height / segments / 2;
        seg.castShadow = true;
        tree.add(seg);
    }

    // Feuilles de palmier (grandes formes coniques)
    const topPos = trunkCurve[segments];
    const leafCount = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < leafCount; i++) {
        const angle = (i / leafCount) * Math.PI * 2;
        const leafLen = (3 + Math.random() * 2) * scale;
        const leafGeo = new THREE.ConeGeometry(0.8 * scale, leafLen, 4);
        const leafMat = new THREE.MeshStandardMaterial({
            color: i % 2 === 0 ? COLORS.leafGreen : COLORS.leafDark,
            roughness: 0.8,
            flatShading: true
        });
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set(
            topPos.x + Math.cos(angle) * leafLen * 0.3,
            topPos.y + 0.5,
            topPos.z + Math.sin(angle) * leafLen * 0.3
        );
        leaf.rotation.z = Math.cos(angle) * 0.8;
        leaf.rotation.x = Math.sin(angle) * 0.8;
        leaf.castShadow = true;
        tree.add(leaf);
    }

    tree.position.set(x, 0, z);
    return tree;
}

// --- FONCTION: Arbre mort/sec ---
function createDeadTree(x, z, scale) {
    const tree = new THREE.Group();
    const height = (4 + Math.random() * 3) * scale;

    // Tronc principal
    const trunkGeo = new THREE.CylinderGeometry(0.15 * scale, 0.35 * scale, height, 5);
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x5a4530,
        roughness: 1.0,
        flatShading: true
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = height / 2;
    trunk.castShadow = true;
    tree.add(trunk);

    // Branches mortes
    const branchCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < branchCount; i++) {
        const bLen = (1.5 + Math.random() * 2) * scale;
        const bGeo = new THREE.CylinderGeometry(0.05 * scale, 0.12 * scale, bLen, 4);
        const branch = new THREE.Mesh(bGeo, trunkMat);
        const bHeight = height * (0.5 + Math.random() * 0.4);
        const bAngle = Math.random() * Math.PI * 2;
        branch.position.set(
            Math.cos(bAngle) * bLen * 0.3,
            bHeight,
            Math.sin(bAngle) * bLen * 0.3
        );
        branch.rotation.z = Math.cos(bAngle) * (0.5 + Math.random() * 0.8);
        branch.rotation.x = Math.sin(bAngle) * 0.3;
        branch.castShadow = true;
        tree.add(branch);
    }

    tree.position.set(x, 0, z);
    return tree;
}

// --- FONCTION: Rocher cartoon ---
function createRock(x, z, scale) {
    const rock = new THREE.Group();
    const mainGeo = new THREE.DodecahedronGeometry(1.5 * scale, 0);
    const mainMat = new THREE.MeshStandardMaterial({
        color: COLORS.rockGray,
        roughness: 0.9,
        flatShading: true
    });
    const mainRock = new THREE.Mesh(mainGeo, mainMat);
    mainRock.position.y = 0.8 * scale;
    mainRock.scale.y = 0.6;
    mainRock.rotation.y = Math.random() * Math.PI;
    mainRock.castShadow = true;
    rock.add(mainRock);

    // Petit rocher à côté
    if (Math.random() > 0.4) {
        const smallGeo = new THREE.DodecahedronGeometry(0.7 * scale, 0);
        const smallMat = new THREE.MeshStandardMaterial({
            color: COLORS.rockDark,
            roughness: 0.95,
            flatShading: true
        });
        const smallRock = new THREE.Mesh(smallGeo, smallMat);
        smallRock.position.set(1.2 * scale, 0.3 * scale, 0.5 * scale);
        smallRock.scale.y = 0.5;
        smallRock.rotation.y = Math.random() * Math.PI;
        smallRock.castShadow = true;
        rock.add(smallRock);
    }

    rock.position.set(x, 0, z);
    return rock;
}

// --- FONCTION: Véhicule militaire abandonné (Jeep cartoon) ---
function createAbandonedVehicle(x, z, rotY) {
    const vehicle = new THREE.Group();

    // Châssis principal
    const chassisGeo = new THREE.BoxGeometry(6, 1.5, 3);
    const chassisMat = new THREE.MeshStandardMaterial({
        color: COLORS.camoBrown,
        roughness: 0.8,
        flatShading: true
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.y = 1.2;
    chassis.castShadow = true;
    vehicle.add(chassis);

    // Capot (avant)
    const hoodGeo = new THREE.BoxGeometry(2.5, 0.8, 2.6);
    const hoodMat = new THREE.MeshStandardMaterial({
        color: COLORS.camoGreen,
        roughness: 0.8,
        flatShading: true
    });
    const hood = new THREE.Mesh(hoodGeo, hoodMat);
    hood.position.set(2, 2, 0);
    hood.castShadow = true;
    vehicle.add(hood);

    // Cabine
    const cabGeo = new THREE.BoxGeometry(2.5, 1.8, 2.8);
    const cabMat = new THREE.MeshStandardMaterial({
        color: COLORS.camoDark,
        roughness: 0.7,
        flatShading: true
    });
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.set(-0.5, 2.8, 0);
    cab.castShadow = true;
    vehicle.add(cab);

    // Pare-brise (cassé - incliné)
    const windshieldGeo = new THREE.PlaneGeometry(2.3, 1.4);
    const windshieldMat = new THREE.MeshStandardMaterial({
        color: 0x88aacc,
        opacity: 0.4,
        transparent: true,
        side: THREE.DoubleSide,
        flatShading: true
    });
    const windshield = new THREE.Mesh(windshieldGeo, windshieldMat);
    windshield.position.set(0.8, 3.0, 0);
    windshield.rotation.y = 0;
    windshield.rotation.z = -0.3;
    vehicle.add(windshield);

    // Roues (4)
    const wheelGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.5, 8);
    const wheelMat = new THREE.MeshStandardMaterial({
        color: COLORS.tireDark,
        roughness: 1.0,
        flatShading: true
    });
    const wheelPositions = [
        { x: 1.8, z: 1.6 }, { x: 1.8, z: -1.6 },
        { x: -1.8, z: 1.6 }, { x: -1.8, z: -1.6 }
    ];
    wheelPositions.forEach((pos, i) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(pos.x, 0.65, pos.z);
        // Roue arrière-droite manquante (abandonnée)
        if (i === 3) {
            wheel.position.y = 0.3;
            wheel.position.z -= 1;
            wheel.rotation.z = 0.5;
        }
        wheel.castShadow = true;
        vehicle.add(wheel);
    });

    // Étoile militaire sur le capot
    const starShape = new THREE.Shape();
    const starPoints = 5;
    const outerR = 0.5;
    const innerR = 0.2;
    for (let i = 0; i < starPoints * 2; i++) {
        const angle = (i / (starPoints * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        if (i === 0) starShape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else starShape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    starShape.closePath();
    const starGeo = new THREE.ShapeGeometry(starShape);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xccccaa, side: THREE.DoubleSide });
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.set(2, 2.42, 0);
    star.rotation.x = -Math.PI / 2;
    vehicle.add(star);

    // Plaque de rouille / tache
    const rustGeo = new THREE.PlaneGeometry(1.5, 0.8);
    const rustMat = new THREE.MeshStandardMaterial({
        color: COLORS.metalRust,
        roughness: 1.0,
        side: THREE.DoubleSide,
        flatShading: true
    });
    const rust = new THREE.Mesh(rustGeo, rustMat);
    rust.position.set(-1.5, 1.5, 1.52);
    vehicle.add(rust);

    // Inclinaison légère (véhicule penché)
    vehicle.rotation.z = 0.05;
    vehicle.rotation.y = rotY;
    vehicle.position.set(x, 0, z);

    return vehicle;
}

// --- FONCTION: Caisses militaires ---
function createMilitaryCrate(x, z, scale) {
    const crate = new THREE.Group();

    const boxGeo = new THREE.BoxGeometry(2 * scale, 1.2 * scale, 1.2 * scale);
    const boxMat = new THREE.MeshStandardMaterial({
        color: COLORS.camoGreen,
        roughness: 0.85,
        flatShading: true
    });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.y = 0.6 * scale;
    box.castShadow = true;
    crate.add(box);

    // Bandes métalliques
    const bandGeo = new THREE.BoxGeometry(2.05 * scale, 0.1 * scale, 1.25 * scale);
    const bandMat = new THREE.MeshStandardMaterial({
        color: COLORS.antennaGray,
        roughness: 0.5,
        metalness: 0.6,
        flatShading: true
    });
    const band1 = new THREE.Mesh(bandGeo, bandMat);
    band1.position.set(0, 0.3 * scale, 0);
    crate.add(band1);
    const band2 = new THREE.Mesh(bandGeo, bandMat);
    band2.position.set(0, 0.9 * scale, 0);
    crate.add(band2);

    crate.position.set(x, 0, z);
    crate.rotation.y = Math.random() * Math.PI;
    return crate;
}

// --- FONCTION: Sacs de sable ---
function createSandbags(x, z, rotY) {
    const group = new THREE.Group();
    const bagGeo = new THREE.CylinderGeometry(0.4, 0.5, 1.2, 6);
    const bagMat = new THREE.MeshStandardMaterial({
        color: COLORS.canvasKhaki,
        roughness: 1.0,
        flatShading: true
    });

    // Empilement de sacs
    const layout = [
        { x: 0, y: 0.3, z: 0 },
        { x: 1.1, y: 0.3, z: 0 },
        { x: 2.2, y: 0.3, z: 0 },
        { x: 0.55, y: 0.9, z: 0 },
        { x: 1.65, y: 0.9, z: 0 },
        { x: 1.1, y: 1.5, z: 0 }
    ];

    layout.forEach(pos => {
        const bag = new THREE.Mesh(bagGeo, bagMat);
        bag.rotation.z = Math.PI / 2;
        bag.position.set(pos.x, pos.y, pos.z);
        bag.scale.y = 0.7 + Math.random() * 0.2;
        bag.castShadow = true;
        group.add(bag);
    });

    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    return group;
}

// --- PLACEMENT DES DÉCORS ---
function populateDesertScene() {
    // Palmiers (loin de la zone de jeu centrale)
    const palmPositions = [
        { x: -45, z: -30, s: 1.2 }, { x: 50, z: -25, s: 1.0 },
        { x: -55, z: 20, s: 0.9 }, { x: 60, z: 15, s: 1.1 },
        { x: -30, z: -40, s: 0.8 }, { x: 35, z: 35, s: 1.0 },
        { x: 70, z: -35, s: 0.7 }, { x: -65, z: -10, s: 1.3 }
    ];
    palmPositions.forEach(p => decorGroup.add(createPalmTree(p.x, p.z, p.s)));

    // Arbres morts
    const deadTreePositions = [
        { x: -40, z: 25, s: 1.0 }, { x: 45, z: -40, s: 0.8 },
        { x: -20, z: -35, s: 0.9 }, { x: 55, z: 30, s: 0.7 },
        { x: 25, z: -45, s: 1.1 }
    ];
    deadTreePositions.forEach(p => decorGroup.add(createDeadTree(p.x, p.z, p.s)));

    // Rochers
    const rockPositions = [
        { x: -35, z: -15, s: 1.2 }, { x: 40, z: 20, s: 0.8 },
        { x: -50, z: 35, s: 1.5 }, { x: 55, z: -10, s: 1.0 },
        { x: -15, z: 30, s: 0.6 }, { x: 30, z: -30, s: 0.9 },
        { x: -60, z: -35, s: 1.3 }, { x: 65, z: 25, s: 0.7 },
        { x: 15, z: 35, s: 0.5 }, { x: -25, z: -25, s: 0.8 }
    ];
    rockPositions.forEach(p => decorGroup.add(createRock(p.x, p.z, p.s)));

    // Véhicules abandonnés
    decorGroup.add(createAbandonedVehicle(-50, 10, 0.3));
    decorGroup.add(createAbandonedVehicle(55, -20, -0.8));

    // Caisses militaires
    const cratePositions = [
        { x: -38, z: 5, s: 1.0 }, { x: 42, z: -5, s: 0.8 },
        { x: -45, z: -20, s: 1.2 }, { x: 48, z: 30, s: 0.9 }
    ];
    cratePositions.forEach(p => decorGroup.add(createMilitaryCrate(p.x, p.z, p.s)));

    // Sacs de sable
    decorGroup.add(createSandbags(-35, 15, 0.5));
    decorGroup.add(createSandbags(38, -15, -0.3));
    decorGroup.add(createSandbags(-20, 25, 1.2));
}

populateDesertScene();
Ambient.init(scene);
Ambient.setBiome('desert', decorGroup);
Ambient.setSky(0x5a9ae0, 0xe8dcb8, [30, 60, -20], 1);

// =============================================
// SYSTÈME DE BIOMES — THÈMES VISUELS PAR NIVEAU
// =============================================

const BIOMES = {
    desert: {
        name: 'Désert Aride',
        terrain: 0xcaa25a,
        sky: 0x87CEEB,
        fog: 0xd4c4a0,
        fogNear: 80, fogFar: 200,
        ambient: { color: 0xfff5e0, intensity: 0.7 },
        sun: { color: 0xffdd88, intensity: 1.2, pos: [30, 60, -20] },
        fill: { color: 0x88aaff, intensity: 0.3, pos: [-20, 30, 20] },
        levels: [1]
    },
    savane: {
        name: 'Savane',
        terrain: 0xb8a44a,
        sky: 0x99bbdd,
        fog: 0xc8b880,
        fogNear: 70, fogFar: 190,
        ambient: { color: 0xfff0d0, intensity: 0.75 },
        sun: { color: 0xffcc66, intensity: 1.1, pos: [25, 55, -15] },
        fill: { color: 0x99aacc, intensity: 0.35, pos: [-15, 25, 15] },
        levels: [2]
    },
    canyon: {
        name: 'Canyon Rocheux',
        terrain: 0xb5703a,
        sky: 0x6699cc,
        fog: 0xc09060,
        fogNear: 60, fogFar: 170,
        ambient: { color: 0xffe0c0, intensity: 0.65 },
        sun: { color: 0xffaa55, intensity: 1.0, pos: [35, 50, -25] },
        fill: { color: 0x7788aa, intensity: 0.35, pos: [-25, 20, 20] },
        levels: [3]
    },
    forest: {
        name: 'Forêt Dense',
        terrain: 0x3a5a28,
        sky: 0x7a9a7a,
        fog: 0x5a7a5a,
        fogNear: 40, fogFar: 150,
        ambient: { color: 0xc0d8b0, intensity: 0.55 },
        sun: { color: 0xbbbb88, intensity: 0.7, pos: [15, 40, -10] },
        fill: { color: 0x556655, intensity: 0.45, pos: [-10, 20, 25] },
        levels: [4]
    },
    jungle: {
        name: 'Jungle Tropicale',
        terrain: 0x2a4a1a,
        sky: 0x667788,
        fog: 0x405a40,
        fogNear: 30, fogFar: 130,
        ambient: { color: 0xb0d0a0, intensity: 0.5 },
        sun: { color: 0xaacc77, intensity: 0.6, pos: [10, 35, -20] },
        fill: { color: 0x446644, intensity: 0.5, pos: [-20, 15, 15] },
        levels: [5]
    },
    mountain: {
        name: 'Haute Montagne',
        terrain: 0x7a7a6a,
        sky: 0x5577aa,
        fog: 0x8899aa,
        fogNear: 50, fogFar: 160,
        ambient: { color: 0xc0cce0, intensity: 0.7 },
        sun: { color: 0xddeeff, intensity: 0.9, pos: [20, 50, -30] },
        fill: { color: 0x7788aa, intensity: 0.4, pos: [-20, 25, 10] },
        levels: [6]
    },
    arctic: {
        name: 'Arctique',
        terrain: 0xc8d8e8,
        sky: 0x4a5a7a,
        fog: 0xaabbcc,
        fogNear: 50, fogFar: 160,
        ambient: { color: 0xc0d0e8, intensity: 0.8 },
        sun: { color: 0xddeeff, intensity: 0.6, pos: [10, 30, -30] },
        fill: { color: 0x8899cc, intensity: 0.5, pos: [-25, 20, 15] },
        levels: [7]
    },
    urban: {
        name: 'Zone Urbaine',
        terrain: 0x4a4a4a,
        sky: 0x1a1a2a,
        fog: 0x2a2a3a,
        fogNear: 40, fogFar: 150,
        ambient: { color: 0x445566, intensity: 0.45 },
        sun: { color: 0x7799bb, intensity: 0.5, pos: [-10, 40, 10] },
        fill: { color: 0xff8844, intensity: 0.3, pos: [30, 15, -20] },
        levels: [8]
    },
    industrial: {
        name: 'Zone Industrielle',
        terrain: 0x3a3830,
        sky: 0x2a2520,
        fog: 0x3a3530,
        fogNear: 35, fogFar: 140,
        ambient: { color: 0x554433, intensity: 0.4 },
        sun: { color: 0xcc8855, intensity: 0.55, pos: [-15, 35, 15] },
        fill: { color: 0xdd6633, intensity: 0.35, pos: [25, 10, -15] },
        levels: [9]
    },
    bunker: {
        name: 'Bunker Souterrain',
        terrain: 0x2a2a2a,
        sky: 0x0a0a0a,
        fog: 0x151515,
        fogNear: 25, fogFar: 120,
        ambient: { color: 0x9ab89a, intensity: 0.75 },
        sun: { color: 0xc8ffd0, intensity: 0.75, pos: [10, 50, 10] },
        fill: { color: 0x33aa44, intensity: 0.25, pos: [-20, 10, 20] },
        levels: [10]
    }
};

let currentBiome = null;

function getBiomeForLevel(levelId) {
    for (const [key, biome] of Object.entries(BIOMES)) {
        if (biome.levels.includes(levelId)) return key;
    }
    return 'desert';
}

// --- Décors spécifiques par biome ---

function createPineTree(x, z, scale) {
    const tree = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.2 * scale, 0.35 * scale, 4 * scale, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9, flatShading: true });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2 * scale;
    trunk.castShadow = true;
    tree.add(trunk);

    // 3 niveaux de feuillage conique
    for (let i = 0; i < 3; i++) {
        const radius = (2.2 - i * 0.5) * scale;
        const h = (2.5 - i * 0.3) * scale;
        const leafGeo = new THREE.ConeGeometry(radius, h, 6);
        const leafMat = new THREE.MeshStandardMaterial({
            color: i % 2 === 0 ? 0x2d5a1e : 0x3a6b28,
            roughness: 0.85, flatShading: true
        });
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.y = (3.5 + i * 1.8) * scale;
        leaf.castShadow = true;
        tree.add(leaf);
    }
    tree.position.set(x, 0, z);
    return tree;
}

function createSnowPine(x, z, scale) {
    const tree = createPineTree(x, z, scale);
    // Ajouter de la neige sur les branches
    tree.children.forEach(child => {
        if (child.geometry && child.geometry.type === 'ConeGeometry') {
            const snowGeo = new THREE.ConeGeometry(
                child.geometry.parameters.radius * 0.85,
                child.geometry.parameters.height * 0.3, 6
            );
            const snowMat = new THREE.MeshStandardMaterial({
                color: 0xf0f5ff, roughness: 0.6, flatShading: true
            });
            const snow = new THREE.Mesh(snowGeo, snowMat);
            snow.position.copy(child.position);
            snow.position.y += child.geometry.parameters.height * 0.35;
            tree.add(snow);
        }
    });
    return tree;
}

function createBuilding(x, z, w, h, d, color) {
    const bldg = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(w, h, d);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: color, roughness: 0.7, flatShading: true
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    bldg.add(body);

    // Fenêtres éclairées (face avant)
    const windowColors = [0xffdd44, 0x44aaff, 0x333333, 0xffdd44];
    const cols = Math.floor(w / 2.5);
    const rows = Math.floor(h / 3);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const winGeo = new THREE.PlaneGeometry(1, 1.2);
            const winColor = windowColors[Math.floor(Math.random() * windowColors.length)];
            const winMat = new THREE.MeshBasicMaterial({
                color: winColor, side: THREE.DoubleSide
            });
            const win = new THREE.Mesh(winGeo, winMat);
            win.position.set(
                -w / 2 + 1.5 + c * 2.5,
                2 + r * 3,
                d / 2 + 0.05
            );
            bldg.add(win);
        }
    }

    bldg.position.set(x, 0, z);
    return bldg;
}

function createRadioTower(x, z, height) {
    const tower = new THREE.Group();
    const legMat = new THREE.MeshStandardMaterial({
        color: 0x888888, roughness: 0.4, metalness: 0.6, flatShading: true
    });

    // 4 pieds convergents
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const baseR = 3;
        const topR = 0.5;
        const legGeo = new THREE.CylinderGeometry(0.15, 0.15, height, 4);
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(
            Math.cos(angle) * (baseR + topR) / 2,
            height / 2,
            Math.sin(angle) * (baseR + topR) / 2
        );
        const tilt = Math.atan2(baseR - topR, height);
        leg.rotation.z = Math.cos(angle) * tilt;
        leg.rotation.x = -Math.sin(angle) * tilt;
        leg.castShadow = true;
        tower.add(leg);
    }

    // Lumière clignotante rouge au sommet
    const lightGeo = new THREE.SphereGeometry(0.4, 6, 6);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.y = height;
    tower.add(light);

    tower.position.set(x, 0, z);
    return tower;
}

function createContainer(x, z, rotY, color) {
    const container = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(8, 3.5, 3);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: color, roughness: 0.6, metalness: 0.3, flatShading: true
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.75;
    body.castShadow = true;
    container.add(body);

    // Rainures
    for (let i = 0; i < 6; i++) {
        const lineGeo = new THREE.BoxGeometry(0.05, 3.2, 2.8);
        const lineMat = new THREE.MeshStandardMaterial({
            color: 0x222222, roughness: 0.9, flatShading: true
        });
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.position.set(-3.5 + i * 1.2, 1.75, 0);
        container.add(line);
    }

    container.position.set(x, 0, z);
    container.rotation.y = rotY || 0;
    return container;
}

function populateForestScene() {
    // Sapins
    const pinePositions = [
        { x: -45, z: -30, s: 1.2 }, { x: 50, z: -25, s: 1.0 },
        { x: -55, z: 20, s: 0.9 }, { x: 60, z: 15, s: 1.1 },
        { x: -30, z: -40, s: 0.8 }, { x: 35, z: 35, s: 1.3 },
        { x: 70, z: -35, s: 0.7 }, { x: -65, z: -10, s: 1.4 },
        { x: -50, z: 40, s: 1.0 }, { x: 45, z: 40, s: 0.9 },
        { x: -70, z: 30, s: 1.1 }, { x: 65, z: -40, s: 0.8 },
        { x: -40, z: -45, s: 1.2 }, { x: 55, z: 45, s: 0.7 }
    ];
    pinePositions.forEach(p => decorGroup.add(createPineTree(p.x, p.z, p.s)));

    // Rochers moussus
    const rockPositions = [
        { x: -35, z: -15, s: 1.0 }, { x: 40, z: 20, s: 0.8 },
        { x: -50, z: 35, s: 1.2 }, { x: 55, z: -10, s: 0.9 },
        { x: -15, z: 30, s: 0.6 }, { x: 30, z: -30, s: 0.7 }
    ];
    rockPositions.forEach(p => decorGroup.add(createRock(p.x, p.z, p.s)));

    // Caisses militaires et sacs de sable
    decorGroup.add(createMilitaryCrate(-38, 5, 1.0));
    decorGroup.add(createMilitaryCrate(42, -5, 0.8));
    decorGroup.add(createSandbags(-35, 15, 0.5));
    decorGroup.add(createSandbags(38, -15, -0.3));
}

function populateArcticScene() {
    // Sapins enneigés
    const pinePositions = [
        { x: -45, z: -30, s: 1.0 }, { x: 50, z: -25, s: 0.9 },
        { x: -55, z: 20, s: 0.8 }, { x: 60, z: 15, s: 1.0 },
        { x: -30, z: -40, s: 0.7 }, { x: 35, z: 35, s: 1.1 },
        { x: 70, z: -35, s: 0.6 }, { x: -65, z: -10, s: 1.2 },
        { x: -50, z: 40, s: 0.9 }, { x: 45, z: 40, s: 0.8 }
    ];
    pinePositions.forEach(p => decorGroup.add(createSnowPine(p.x, p.z, p.s)));

    // Rochers gelés
    const rockPositions = [
        { x: -35, z: -15, s: 1.2 }, { x: 40, z: 20, s: 0.9 },
        { x: -50, z: 35, s: 1.5 }, { x: 55, z: -10, s: 1.0 },
        { x: 30, z: -30, s: 0.8 }
    ];
    rockPositions.forEach(p => decorGroup.add(createRock(p.x, p.z, p.s)));

    // Sacs de sable et caisses
    decorGroup.add(createSandbags(-35, 15, 0.5));
    decorGroup.add(createSandbags(38, -15, -0.3));
    decorGroup.add(createMilitaryCrate(-38, 5, 1.0));
}

function populateUrbanScene() {
    // Bâtiments en arrière-plan
    decorGroup.add(createBuilding(-55, -30, 12, 20, 10, 0x4a4a4a));
    decorGroup.add(createBuilding(55, -25, 10, 15, 8, 0x555555));
    decorGroup.add(createBuilding(-60, 25, 8, 25, 8, 0x3a3a3a));
    decorGroup.add(createBuilding(60, 30, 14, 12, 10, 0x484848));
    decorGroup.add(createBuilding(-45, 40, 10, 18, 8, 0x505050));
    decorGroup.add(createBuilding(50, -40, 8, 22, 6, 0x424242));

    // Tours radio
    decorGroup.add(createRadioTower(-50, 10, 25));
    decorGroup.add(createRadioTower(55, -15, 20));

    // Conteneurs
    decorGroup.add(createContainer(-40, -10, 0.3, 0x884422));
    decorGroup.add(createContainer(42, 10, -0.5, 0x225588));
    decorGroup.add(createContainer(-35, 20, 1.0, 0x446633));

    // Caisses militaires
    decorGroup.add(createMilitaryCrate(-30, -20, 1.0));
    decorGroup.add(createMilitaryCrate(35, 25, 0.8));

    // Véhicule
    decorGroup.add(createAbandonedVehicle(-45, -35, 0.8));
}

// --- BIOME N2 : Savane (herbes hautes, acacias aplatis, termitières) ---
function createAcacia(x, z, scale) {
    const tree = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.15 * scale, 0.3 * scale, 6 * scale, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4020, roughness: 0.9, flatShading: true });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 3 * scale;
    trunk.castShadow = true;
    tree.add(trunk);
    // Canopée plate
    const canopyGeo = new THREE.CylinderGeometry(3.5 * scale, 4 * scale, 1.2 * scale, 8);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x6a8a30, roughness: 0.8, flatShading: true });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = 6.5 * scale;
    canopy.castShadow = true;
    tree.add(canopy);
    tree.position.set(x, 0, z);
    return tree;
}

function createTermiteHill(x, z, scale) {
    const hill = new THREE.Group();
    const mainGeo = new THREE.ConeGeometry(1.2 * scale, 4 * scale, 6);
    const mainMat = new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 1.0, flatShading: true });
    const main = new THREE.Mesh(mainGeo, mainMat);
    main.position.y = 2 * scale;
    main.castShadow = true;
    hill.add(main);
    // Petite excroissance
    const smallGeo = new THREE.ConeGeometry(0.6 * scale, 2 * scale, 5);
    const small = new THREE.Mesh(smallGeo, mainMat);
    small.position.set(0.8 * scale, 1.2 * scale, 0.5 * scale);
    hill.add(small);
    hill.position.set(x, 0, z);
    return hill;
}

function createTallGrass(x, z, count) {
    const group = new THREE.Group();
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x9a8a30, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
    for (let i = 0; i < count; i++) {
        const h = 1.5 + Math.random() * 2;
        const geo = new THREE.PlaneGeometry(0.3, h);
        const blade = new THREE.Mesh(geo, grassMat);
        blade.position.set(x + (Math.random() - 0.5) * 4, h / 2, z + (Math.random() - 0.5) * 4);
        blade.rotation.y = Math.random() * Math.PI;
        blade.rotation.z = (Math.random() - 0.5) * 0.3;
        group.add(blade);
    }
    return group;
}

function populateSavaneScene() {
    [{ x: -50, z: -25, s: 1.1 }, { x: 55, z: 20, s: 1.3 }, { x: -60, z: 30, s: 0.9 }, { x: 45, z: -35, s: 1.0 }]
        .forEach(p => decorGroup.add(createAcacia(p.x, p.z, p.s)));
    [{ x: -35, z: -15, s: 1.0 }, { x: 40, z: 25, s: 1.2 }, { x: -50, z: 40, s: 0.8 }]
        .forEach(p => decorGroup.add(createTermiteHill(p.x, p.z, p.s)));
    [{ x: -40, z: 10 }, { x: 35, z: -20 }, { x: -55, z: -35 }, { x: 50, z: 35 }, { x: -30, z: -40 }, { x: 60, z: -10 }]
        .forEach(p => decorGroup.add(createTallGrass(p.x, p.z, 12)));
    decorGroup.add(createRock(-45, -30, 0.7));
    decorGroup.add(createRock(50, -40, 0.9));
    decorGroup.add(createAbandonedVehicle(-50, 10, 0.3));
    decorGroup.add(createMilitaryCrate(40, -5, 0.8));
}

// --- BIOME N3 : Canyon Rocheux (gros rochers, arches, formations) ---
function createCanyonWall(x, z, rotY, height, width) {
    const wall = new THREE.Group();
    const geo = new THREE.BoxGeometry(width, height, 4);
    const mat = new THREE.MeshStandardMaterial({ color: 0xa06030, roughness: 0.95, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = height / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    wall.add(mesh);
    // Strates rocheuses
    for (let i = 0; i < 3; i++) {
        const strataGeo = new THREE.BoxGeometry(width + 0.5, 0.3, 4.2);
        const strataMat = new THREE.MeshStandardMaterial({ color: 0x8a5025 + i * 0x0a0a05, roughness: 1.0, flatShading: true });
        const strata = new THREE.Mesh(strataGeo, strataMat);
        strata.position.y = height * (0.2 + i * 0.3);
        wall.add(strata);
    }
    wall.position.set(x, 0, z);
    wall.rotation.y = rotY || 0;
    return wall;
}

function createCactus(x, z, scale) {
    const cactus = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.4 * scale, 0.5 * scale, 4 * scale, 6);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a6a2a, roughness: 0.8, flatShading: true });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 2 * scale;
    body.castShadow = true;
    cactus.add(body);
    // Bras
    const armGeo = new THREE.CylinderGeometry(0.2 * scale, 0.25 * scale, 2 * scale, 5);
    const arm1 = new THREE.Mesh(armGeo, bodyMat);
    arm1.position.set(0.6 * scale, 3 * scale, 0);
    arm1.rotation.z = -0.8;
    cactus.add(arm1);
    const arm2 = new THREE.Mesh(armGeo, bodyMat);
    arm2.position.set(-0.5 * scale, 2.5 * scale, 0.3 * scale);
    arm2.rotation.z = 0.7;
    cactus.add(arm2);
    cactus.position.set(x, 0, z);
    return cactus;
}

function populateCanyonScene() {
    // Murs de canyon en fond
    decorGroup.add(createCanyonWall(-65, 0, 0, 18, 20));
    decorGroup.add(createCanyonWall(65, 0, 0, 15, 18));
    decorGroup.add(createCanyonWall(0, -55, Math.PI / 2, 12, 25));
    decorGroup.add(createCanyonWall(0, 55, Math.PI / 2, 14, 22));
    // Gros rochers au sol
    [{ x: -40, z: -20, s: 2.0 }, { x: 45, z: 15, s: 1.8 }, { x: -30, z: 30, s: 1.5 }, { x: 35, z: -30, s: 1.3 }]
        .forEach(p => decorGroup.add(createRock(p.x, p.z, p.s)));
    // Cactus
    [{ x: -50, z: -35, s: 1.0 }, { x: 50, z: 30, s: 0.8 }, { x: -45, z: 40, s: 1.1 }, { x: 55, z: -25, s: 0.9 }]
        .forEach(p => decorGroup.add(createCactus(p.x, p.z, p.s)));
    decorGroup.add(createSandbags(-35, 10, 0.5));
    decorGroup.add(createMilitaryCrate(38, -10, 1.0));
}

// --- BIOME N5 : Jungle (palmiers denses, lianes, mousse) ---
function populateJungleScene() {
    // Palmiers denses
    [{ x: -45, z: -25, s: 1.3 }, { x: 50, z: -20, s: 1.1 }, { x: -55, z: 15, s: 1.0 },
     { x: 60, z: 10, s: 1.2 }, { x: -35, z: -40, s: 0.9 }, { x: 40, z: 30, s: 1.4 },
     { x: 70, z: -30, s: 0.8 }, { x: -65, z: -5, s: 1.1 }, { x: -50, z: 35, s: 1.0 },
     { x: 55, z: 40, s: 0.9 }, { x: -70, z: 25, s: 1.2 }, { x: 65, z: -40, s: 0.7 }]
        .forEach(p => decorGroup.add(createPalmTree(p.x, p.z, p.s)));
    // Sapins pour densité
    [{ x: -40, z: -35, s: 1.0 }, { x: 45, z: 25, s: 0.9 }, { x: -60, z: 10, s: 1.1 }, { x: 55, z: -15, s: 0.8 }]
        .forEach(p => decorGroup.add(createPineTree(p.x, p.z, p.s)));
    // Herbes hautes
    [{ x: -30, z: 20 }, { x: 35, z: -25 }, { x: -50, z: -30 }, { x: 45, z: 35 }]
        .forEach(p => decorGroup.add(createTallGrass(p.x, p.z, 18)));
    // Rochers moussus
    [{ x: -35, z: -10, s: 1.2 }, { x: 40, z: 20, s: 0.9 }]
        .forEach(p => decorGroup.add(createRock(p.x, p.z, p.s)));
    decorGroup.add(createMilitaryCrate(-40, 5, 1.0));
    decorGroup.add(createSandbags(42, -8, -0.3));
}

// --- BIOME N6 : Haute Montagne (neige partielle, gros rochers, sapins clairsemés) ---
function createSnowRock(x, z, scale) {
    const rock = createRock(x, z, scale);
    // Calotte de neige
    const snowGeo = new THREE.SphereGeometry(1.2 * scale, 6, 4, 0, Math.PI * 2, 0, Math.PI / 3);
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.5, flatShading: true });
    const snow = new THREE.Mesh(snowGeo, snowMat);
    snow.position.y = 1.2 * scale;
    rock.add(snow);
    return rock;
}

function populateMountainScene() {
    // Gros rochers avec neige
    [{ x: -50, z: -30, s: 2.5 }, { x: 55, z: -25, s: 2.0 }, { x: -60, z: 25, s: 1.8 },
     { x: 60, z: 30, s: 2.2 }, { x: -40, z: 40, s: 1.5 }, { x: 45, z: -40, s: 1.7 }]
        .forEach(p => decorGroup.add(createSnowRock(p.x, p.z, p.s)));
    // Quelques sapins
    [{ x: -45, z: -20, s: 1.0 }, { x: 50, z: 15, s: 0.9 }, { x: -55, z: 35, s: 0.8 }]
        .forEach(p => decorGroup.add(createPineTree(p.x, p.z, p.s)));
    // Rochers simples
    [{ x: -30, z: 10, s: 1.0 }, { x: 35, z: -15, s: 0.8 }]
        .forEach(p => decorGroup.add(createRock(p.x, p.z, p.s)));
    decorGroup.add(createSandbags(-35, 15, 0.5));
    decorGroup.add(createMilitaryCrate(40, -5, 0.9));
}

// --- BIOME N9 : Zone Industrielle (cheminées, tuyaux, containers rouillés) ---
function createChimney(x, z, height) {
    const chimney = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(1.5, 2, height, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6a5a4a, roughness: 0.8, metalness: 0.3, flatShading: true });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = height / 2;
    body.castShadow = true;
    chimney.add(body);
    // Rebord supérieur
    const rimGeo = new THREE.TorusGeometry(1.6, 0.3, 6, 8);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.7, metalness: 0.4, flatShading: true });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.y = height;
    rim.rotation.x = Math.PI / 2;
    chimney.add(rim);
    chimney.position.set(x, 0, z);
    return chimney;
}

function createPipe(x1, z1, x2, z2, height) {
    const pipe = new THREE.Group();
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    const geo = new THREE.CylinderGeometry(0.4, 0.4, len, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0x887755, roughness: 0.6, metalness: 0.5, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.z = Math.PI / 2;
    mesh.rotation.y = Math.atan2(dz, dx);
    mesh.position.set((x1 + x2) / 2, height, (z1 + z2) / 2);
    mesh.castShadow = true;
    pipe.add(mesh);
    return pipe;
}

function populateIndustrialScene() {
    // Cheminées
    decorGroup.add(createChimney(-55, -30, 22));
    decorGroup.add(createChimney(60, -25, 18));
    decorGroup.add(createChimney(-50, 35, 15));
    // Bâtiments bas / hangars
    decorGroup.add(createBuilding(-60, 10, 15, 8, 12, 0x4a4438));
    decorGroup.add(createBuilding(55, 15, 12, 6, 10, 0x484038));
    decorGroup.add(createBuilding(-45, -40, 10, 10, 8, 0x504840));
    // Tours radio
    decorGroup.add(createRadioTower(50, -35, 20));
    // Conteneurs rouillés
    decorGroup.add(createContainer(-40, -10, 0.2, 0x7a4422));
    decorGroup.add(createContainer(42, 5, -0.6, 0x884433));
    decorGroup.add(createContainer(-35, 25, 1.1, 0x665533));
    decorGroup.add(createContainer(38, -20, 0.4, 0x554422));
    // Tuyaux
    decorGroup.add(createPipe(-55, -30, -55, 10, 6));
    decorGroup.add(createPipe(55, -25, 55, 15, 5));
    // Caisses militaires
    decorGroup.add(createMilitaryCrate(-30, -20, 1.0));
    decorGroup.add(createMilitaryCrate(35, 30, 0.8));
}

// --- BIOME N10 : Bunker Souterrain (piliers, néons verts, câbles, dalles) ---
function createPillar(x, z) {
    const pillar = new THREE.Group();
    const geo = new THREE.BoxGeometry(2, 12, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, metalness: 0.2, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 6;
    mesh.castShadow = true;
    pillar.add(mesh);
    // Néon vert au pied
    const neonGeo = new THREE.BoxGeometry(2.2, 0.15, 2.2);
    const neonMat = new THREE.MeshBasicMaterial({ color: 0x22ff44 });
    const neon = new THREE.Mesh(neonGeo, neonMat);
    neon.position.y = 0.1;
    pillar.add(neon);
    pillar.position.set(x, 0, z);
    return pillar;
}

function createNeonStrip(x1, z1, x2, z2) {
    const group = new THREE.Group();
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    const geo = new THREE.BoxGeometry(len, 0.1, 0.3);
    const mat = new THREE.MeshBasicMaterial({ color: 0x22ff44, transparent: true, opacity: 0.6 });
    const strip = new THREE.Mesh(geo, mat);
    strip.rotation.y = Math.atan2(dz, dx);
    strip.position.set((x1 + x2) / 2, 0.05, (z1 + z2) / 2);
    group.add(strip);
    return group;
}

function createCeilingPanel(x, z, w, d) {
    const panel = new THREE.Group();
    const geo = new THREE.BoxGeometry(w, 0.5, d);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8, metalness: 0.3, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 12;
    mesh.receiveShadow = true;
    panel.add(mesh);
    panel.position.set(x, 0, z);
    return panel;
}

function populateBunkerScene() {
    // Piliers de soutènement
    [{ x: -35, z: -25 }, { x: 35, z: -25 }, { x: -35, z: 25 }, { x: 35, z: 25 },
     { x: -55, z: 0 }, { x: 55, z: 0 }, { x: 0, z: -40 }, { x: 0, z: 40 }]
        .forEach(p => decorGroup.add(createPillar(p.x, p.z)));
    // (Pas de dalle de plafond : la caméra est au-dessus et ne verrait plus la scène)
    // Néons au sol (grille)
    for (let x = -50; x <= 50; x += 25) {
        decorGroup.add(createNeonStrip(x, -45, x, 45));
    }
    for (let z = -45; z <= 45; z += 22) {
        decorGroup.add(createNeonStrip(-50, z, 50, z));
    }
    // Conteneurs militaires
    decorGroup.add(createContainer(-45, -10, 0.1, 0x3a4a2a));
    decorGroup.add(createContainer(45, 10, -0.2, 0x4a3a2a));
    // Caisses
    decorGroup.add(createMilitaryCrate(-25, -15, 1.0));
    decorGroup.add(createMilitaryCrate(30, 20, 0.9));
    decorGroup.add(createMilitaryCrate(-20, 30, 0.7));
    // Tour radio intérieure
    decorGroup.add(createRadioTower(0, -35, 11));
}

// =============================================
// APPLICATION DU BIOME (toujours forcée)
// =============================================
function applyBiome(biomeName) {
    currentBiome = biomeName;
    const biome = BIOMES[biomeName];
    if (!biome) return;

    // Ciel
    scene.background = new THREE.Color(biome.sky);

    // Brume
    scene.fog = new THREE.Fog(biome.fog, biome.fogNear, biome.fogFar);

    // Terrain
    terrainMat.color.setHex(biome.terrain);
    terrainMat.needsUpdate = true;

    // Éclairage ambiant
    ambientLight.color.setHex(biome.ambient.color);
    ambientLight.intensity = biome.ambient.intensity * 0.6;

    // Soleil
    sunLight.color.setHex(biome.sun.color);
    sunLight.intensity = biome.sun.intensity * 0.9;
    sunLight.position.set(biome.sun.pos[0], biome.sun.pos[1], biome.sun.pos[2]);

    // Lumière de remplissage
    fillLight.color.setHex(biome.fill.color);
    fillLight.intensity = biome.fill.intensity;
    fillLight.position.set(biome.fill.pos[0], biome.fill.pos[1], biome.fill.pos[2]);

    // Vider les décors actuels (nettoyage profond)
    while (decorGroup.children.length > 0) {
        const child = decorGroup.children[0];
        decorGroup.remove(child);
        // Nettoyage récursif des géométries et matériaux
        child.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });
    }

    // Charger les décors du biome
    switch (biomeName) {
        case 'desert':     populateDesertScene(); break;
        case 'savane':     populateSavaneScene(); break;
        case 'canyon':     populateCanyonScene(); break;
        case 'forest':     populateForestScene(); break;
        case 'jungle':     populateJungleScene(); break;
        case 'mountain':   populateMountainScene(); break;
        case 'arctic':     populateArcticScene(); break;
        case 'urban':      populateUrbanScene(); break;
        case 'industrial': populateIndustrialScene(); break;
        case 'bunker':     populateBunkerScene(); break;
    }

    // Ciel dégradé + vie ambiante (route, véhicules, météo...)
    const horizon = new THREE.Color(biome.fog).lerp(new THREE.Color(0xffffff), 0.12).getHex();
    Ambient.setSky(biome.sky, horizon, biome.sun.pos, biomeName === 'bunker' ? 0 : (biome.sun.intensity > 0.8 ? 1 : 0.4));
    Ambient.setBiome(biomeName, decorGroup);
    hemiLight.color.setHex(biome.sky);
    hemiLight.groundColor.setHex(biome.terrain);

    console.log(`[Biome] Environnement changé : ${biome.name}`);
}

// --- VARIABLES GLOBALES ---
let currentLevelIndex = 0;
let levelData = null;
let nodes3D = {};
let linkLines = [];
let draggedNode = null;
let activeNodeId = null;
let timeLeft = 0;
let timerInterval = null;
let timeExpired = false;
let particles = [];
let isPaused = false;
let pingInProgress = false;

let menuSelectedLevel = null;
let gameStarted = false;
let timerPausedByMenu = false;

// --- MENU PRINCIPAL (4 modes de jeu) ---
function showMainMenu() {
    // Masquer tous les overlays
    document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));

    // Arrêter le timer s'il tourne
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    const mainMenuOverlay = document.getElementById('main-menu-overlay');
    mainMenuOverlay.classList.remove('hidden');

    // --- Bandeau utilisateur intégré au menu ---
    const userBar = document.getElementById('main-menu-user-bar');
    const secondarySection = document.getElementById('main-menu-secondary');

    if (Accounts.isLoggedIn()) {
        const login = Accounts.getLogin().toUpperCase();
        const profile = Scoring.getProfile();
        const rankData = Scoring.RANKS.find(r => r.id === profile.rank) || Scoring.RANKS[0];
        const rankIcons = {
            'operateur': '&#128225;', 'chef_liaison': '&#127894;',
            'coordinateur': '&#11088;', 'controleur': '&#127941;', 'expert': '&#128081;'
        };

        userBar.className = 'main-menu-user-bar';
        userBar.innerHTML = `
            <div class="main-menu-user-info">
                <span class="user-icon">${rankIcons[profile.rank] || '&#128225;'}</span>
                <span class="user-login">${login}</span>
                <span class="user-rank">${rankData.label}</span>
            </div>
            <div class="main-menu-user-actions">
                <button class="btn-switch-account" id="btn-menu-switch">CHANGER DE COMPTE</button>
                <button class="btn-menu-logout" id="btn-menu-logout">DÉCONNEXION</button>
            </div>
        `;

        // Handler déconnexion
        document.getElementById('btn-menu-logout').onclick = () => {
            // Arrêter proprement toute partie en cours
            if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
            timerPausedByMenu = false;
            gameStarted = false;
            isPaused = false;

            Accounts.logout();
            Accounts.updateAccountIndicator();
            mainMenuOverlay.classList.add('hidden');
            showAccountChoice();
        };

        // Handler changer de compte
        document.getElementById('btn-menu-switch').onclick = () => {
            // Arrêter proprement toute partie en cours
            if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
            timerPausedByMenu = false;
            gameStarted = false;
            isPaused = false;

            Accounts.logout();
            Accounts.updateAccountIndicator();
            mainMenuOverlay.classList.add('hidden');
            showAccountChoice();
            // Aller directement à l'écran de login
            setTimeout(() => {
                document.getElementById('account-choice-overlay').classList.add('hidden');
                showLoginScreen();
            }, 100);
        };

        // Grille secondaire (profil + défis)
        if (secondarySection) {
            secondarySection.classList.remove('hidden');
            document.getElementById('btn-sec-profile').onclick = () => {
                mainMenuOverlay.classList.add('hidden');
                showProfile();
            };
            const challengesBtn = document.getElementById('btn-sec-challenges');
            if (challengesAvailable) {
                challengesBtn.style.display = '';
                challengesBtn.onclick = () => {
                    mainMenuOverlay.classList.add('hidden');
                    showChallenges();
                };
            } else {
                challengesBtn.style.display = 'none';
            }
        }
    } else {
        // Mode anonyme — bandeau simplifié
        userBar.className = 'main-menu-anon-bar';
        userBar.innerHTML = `
            <div class="main-menu-anon-info">
                <span>&#128100;</span>
                <span>MODE ANONYME — progression non sauvegardée</span>
            </div>
            <button class="btn-connect-account" id="btn-menu-connect">SE CONNECTER</button>
        `;

        document.getElementById('btn-menu-connect').onclick = () => {
            mainMenuOverlay.classList.add('hidden');
            showAccountChoice();
        };

        // Masquer la section secondaire en anonyme
        if (secondarySection) secondarySection.classList.add('hidden');
    }

    // Handlers pour les 4 boutons de mode de jeu
    document.querySelectorAll('.main-menu-btn').forEach(btn => {
        btn.onclick = () => {
            const mode = btn.dataset.mode;
            mainMenuOverlay.classList.add('hidden');

            if (mode === 'classique') {
                showMenu();
            } else if (mode === 'network-calc') {
                TrainingNetwork.start();
            } else if (mode === 'subnets') {
                TrainingSubnet.start();
            } else if (mode === 'vlsm') {
                TrainingVLSM.start();
            }
        };
    });
}

// --- PAGE PROFIL JOUEUR ---
function showProfile() {
    document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
    const overlay = document.getElementById('profile-overlay');

    const profile = Scoring.getProfile();
    const user = Accounts.getUser();
    const login = Accounts.getLogin() || 'ANONYME';

    // En-tête
    document.getElementById('profile-login').textContent = login.toUpperCase();

    // Rang
    const rankData = Scoring.RANKS.find(r => r.id === profile.rank) || Scoring.RANKS[0];
    const rankIcons = {
        'operateur': '📡', 'chef_liaison': '🎖️',
        'coordinateur': '⭐', 'controleur': '🏅', 'expert': '👑'
    };
    document.getElementById('profile-rank-icon').textContent = rankIcons[profile.rank] || '📡';
    document.getElementById('profile-rank-label').textContent = rankData.label;

    // Statistiques globales
    document.getElementById('profile-cumul-score').textContent = (profile.cumulScore || 0).toLocaleString('fr-FR');
    document.getElementById('profile-missions-completed').textContent = profile.missionsCompleted || 0;
    document.getElementById('profile-best-streak').textContent = profile.bestStreak || 0;

    // Compter les médailles
    const medalCount = Object.keys(profile.medals || {}).length;
    document.getElementById('profile-medals-count').textContent = medalCount;

    // Grille des missions (1 à 10)
    const missionsGrid = document.getElementById('profile-missions-grid');
    missionsGrid.innerHTML = '';
    for (let i = 1; i <= 10; i++) {
        const card = document.createElement('div');
        card.className = 'profile-mission-card';
        const bestScore = profile.bestScores[i] || 0;
        const medal = profile.medals[i] || null;
        const medalIcons = { bronze: '🥉', argent: '🥈', or: '🥇', distinction: '🎖️' };

        if (bestScore > 0) {
            card.classList.add('mission-completed');
            card.innerHTML = `
                <div class="profile-mission-num">M${i}</div>
                <div class="profile-mission-score">${bestScore.toLocaleString('fr-FR')}</div>
                <div class="profile-mission-medal">${medal ? medalIcons[medal] : ''}</div>
            `;
        } else {
            const isUnlocked = user && i <= (user.last_unlocked_level || 1);
            card.innerHTML = `
                <div class="profile-mission-num">M${i}</div>
                <div class="profile-mission-locked">${isUnlocked ? '🔓' : '🔒'}</div>
            `;
        }
        missionsGrid.appendChild(card);
    }

    // Collection de médailles
    const medalsDisplay = document.getElementById('profile-medals-display');
    const medalTypes = [
        { key: 'bronze', label: 'BRONZE', icon: '🥉' },
        { key: 'argent', label: 'ARGENT', icon: '🥈' },
        { key: 'or', label: 'OR', icon: '🥇' },
        { key: 'distinction', label: 'DISTINCTION', icon: '🎖️' }
    ];
    medalsDisplay.innerHTML = '';
    medalTypes.forEach(mt => {
        const count = Object.values(profile.medals || {}).filter(m => m === mt.key).length;
        const item = document.createElement('div');
        item.className = 'profile-medal-item' + (count > 0 ? ' has-medal' : '');
        item.innerHTML = `
            <div class="profile-medal-icon">${mt.icon}</div>
            <div class="profile-medal-count">${count}</div>
            <div class="profile-medal-label">${mt.label}</div>
        `;
        medalsDisplay.appendChild(item);
    });

    overlay.classList.remove('hidden');

    // Boutons retour
    document.getElementById('btn-profile-close').onclick = () => {
        overlay.classList.add('hidden');
        showMainMenu();
    };
    document.getElementById('btn-profile-back').onclick = () => {
        overlay.classList.add('hidden');
        showMainMenu();
    };
}

// --- MENU DE SÉLECTION DE NIVEAU ---
function showMenu() {
    // Masquer tous les overlays
    document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));

    // Mettre le timer en pause si une partie est en cours
    // (ne pas écraser timerPausedByMenu s'il est déjà true, ex: venant de la pause)
    if (!timerPausedByMenu) {
        timerPausedByMenu = false;
        if (timerInterval && gameStarted) {
            clearInterval(timerInterval);
            timerInterval = null;
            timerPausedByMenu = true;
        }
    }

    const menuOverlay = document.getElementById('menu-overlay');
    const grid = document.getElementById('menu-grid');
    const closeBtn = document.getElementById('btn-menu-close');

    // Afficher le bouton fermer uniquement si une partie est déjà en cours
    closeBtn.style.display = gameStarted ? 'flex' : 'none';

    menuSelectedLevel = null;
    grid.innerHTML = '';

    // Générer les 10 boutons de niveau
    const isLoggedIn = Accounts.isLoggedIn();
    levels.forEach((lvl, index) => {
        const btn = document.createElement('div');
        btn.className = 'menu-level-btn';
        btn.dataset.index = index;

        const levelNum = index + 1;
        const shortTitle = lvl.title.replace(/^Niveau \d+ : /, '');

        let statusHTML, statusClass = '';
        if (isLoggedIn) {
            // Affichage basé sur la progression du compte
            const status = Accounts.getLevelStatus(levelNum);
            if (status === 'completed') {
                statusHTML = '<div class="menu-level-status status-completed">✓ COMPLÉTÉ</div>';
                statusClass = 'level-completed';
            } else if (status === 'unlocked') {
                statusHTML = '<div class="menu-level-status status-unlocked">🔓 DÉBLOQUÉ</div>';
                statusClass = 'level-unlocked';
            } else {
                statusHTML = '<div class="menu-level-status status-locked">🔒 VERROUILLÉ</div>';
            }
        } else {
            // Affichage anonyme : tous les niveaux accessibles
            statusHTML = '<div class="menu-level-lock unlocked">🔓 ACCÈS LIBRE</div>';
        }

        if (statusClass) btn.classList.add(statusClass);

        btn.innerHTML = `
            <div class="menu-level-num">${levelNum}</div>
            <div class="menu-level-info">
                <div class="menu-level-title">${shortTitle}</div>
                ${statusHTML}
            </div>
        `;

        btn.addEventListener('click', () => selectLevel(index));
        grid.appendChild(btn);
    });

    menuOverlay.classList.remove('hidden');
}

function selectLevel(index) {
    const levelNum = index + 1;

    // Retirer la sélection précédente
    document.querySelectorAll('.menu-level-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.menu-level-btn')[index].classList.add('selected');

    if (Accounts.isLoggedIn()) {
        // Connecté : accès basé sur la progression
        if (!Accounts.isLevelUnlocked(levelNum)) {
            // Niveau verrouillé
            Scoring.logEvent(`Niveau ${levelNum} verrouillé. Complétez les niveaux précédents.`, 'warning');
            return;
        }
    }

    // Accès direct (anonyme = tous les niveaux libres, connecté = progression OK)
    document.getElementById('menu-overlay').classList.add('hidden');
    currentLevelIndex = index;
    gameStarted = true;
    showBriefing(index);
}


// --- CHARGEMENT DES NIVEAUX (avec briefing immersif) ---
function showBriefing(index) {
    if (index >= levels.length) {
        speak("Félicitations Sergent, formation GAME EDR terminée avec succès.");
        return;
    }
    const missionId = levels[index].id;
    const mission = Missions.get(missionId);
    const missionName = mission ? mission.name : `Mission ${missionId}`;
    const briefHTML = Missions.getBriefHTML(missionId);
    document.getElementById('briefing-content').innerHTML = briefHTML;
    document.getElementById('briefing-overlay').classList.remove('hidden');

    document.getElementById('btn-start-mission').onclick = () => {
        document.getElementById('briefing-overlay').classList.add('hidden');
        loadLevel(index);
    };

    // Bouton classement dans le briefing (uniquement si connecté)
    const lbBtn = document.getElementById('btn-show-leaderboard');
    if (Accounts.isLoggedIn()) {
        lbBtn.style.display = '';
        lbBtn.onclick = () => { HighScores.showLeaderboard(missionId); };
    } else {
        lbBtn.style.display = 'none';
    }
}

function loadLevel(index) {
    if (index >= levels.length) {
        speak("Félicitations Sergent, formation GAME EDR terminée avec succès.");
        return;
    }

    // Nettoyage de la scène
    if (typeof Gameplay !== 'undefined') Gameplay.reset();
    pingInProgress = false;
    linkEstablished = false;
    Object.values(nodes3D).forEach(m => scene.remove(m));
    linkLines.forEach(l => { if (l.group) scene.remove(l.group); });
    nodes3D = {};
    linkLines = [];
    clearInterval(timerInterval);

    levelData = JSON.parse(JSON.stringify(levels[index])); // Copie profonde

    // Appliquer le biome correspondant au niveau
    const biomeName = getBiomeForLevel(levels[index].id);
    applyBiome(biomeName);

    // Titres immersifs
    const missionId = levelData.id;
    const mission = Missions.get(missionId);
    const title = mission ? mission.name : levelData.title;
    document.getElementById('level-title').innerText = `N${missionId} — ${title}`;
    document.getElementById('level-desc').innerText = mission ? mission.brief.mission : levelData.desc;

    // Init scoring
    Scoring.startMission(missionId);

    // État de la liaison
    const statusEl = document.getElementById('hud-status-value');
    if (statusEl) {
        statusEl.textContent = 'INTERROMPUE';
        statusEl.className = 'status-disconnected';
    }

    // Création des équipements
    levelData.nodes.forEach(n => {
        const group = new THREE.Group();
        group.position.set(n.pos.x, 0, n.pos.z);
        group.userData = { id: n.id, type: n.type };

        // Modèles 3D : caisse-rack tactique (routeur) / poste de commandement (PC)
        if (n.type === 'router') {
            Equipment.buildRouter(group, n);
        } else {
            Equipment.buildStation(group, n);
        }

        // Hitbox invisible pour le clic
        const hitboxGeo = n.type === 'router' ? new THREE.BoxGeometry(8.5, 6.5, 5) : new THREE.BoxGeometry(7, 5.5, 6.5);
        const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
        hitbox.position.set(n.type === 'router' ? 0.8 : 0, 3, n.type === 'router' ? 0 : 0.6);
        hitbox.userData.isHitbox = true;
        group.add(hitbox);

        scene.add(group);
        nodes3D[n.id] = group;
    });

    // Dessine les câbles après un léger délai
    setTimeout(drawCables, 100);

    // Plaques d'identification + caméra d'introduction
    Gameplay.buildPlates();
    Gameplay.refreshAll(false);
    CameraRig.intro();
    const verifyBtn = document.getElementById('btn-verify');
    verifyBtn.disabled = false;
    verifyBtn.classList.remove('is-busy');

    // Initialisation du chrono
    timeLeft = levelData.time;
    timeExpired = false;
    document.getElementById('timer').className = '';
    updateTimerDisplay();
    timerInterval = setInterval(tickTimer, 1000);

    // Reset pause
    isPaused = false;
    document.getElementById('pause-overlay').classList.add('hidden');
    document.getElementById('btn-pause').classList.remove('paused');
    document.getElementById('btn-pause').innerHTML = '&#9646;&#9646; PAUSE';





    Scoring.logEvent(`Mission ${missionId} déployée. En attente de configuration.`, 'info');
    speak(`Mission ${index + 1}. À vous de jouer.`);
}

// --- LABELS D'INTERFACE (Sprites texte canvas) ---
function createInterfaceLabel(text, sub, ok) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold 36px "Share Tech Mono", monospace';
    const w1 = ctx.measureText(text).width;
    ctx.font = 'bold 26px "Share Tech Mono", monospace';
    const w2 = sub ? ctx.measureText(sub).width : 0;
    canvas.width = Math.max(150, Math.ceil(Math.max(w1, w2) + 40));
    canvas.height = sub ? 96 : 60;
    const W = canvas.width, H = canvas.height;

    ctx.fillStyle = 'rgba(16, 14, 8, 0.86)';
    ctx.beginPath();
    ctx.roundRect(3, 3, W - 6, H - 6, 12);
    ctx.fill();
    ctx.strokeStyle = sub ? (ok ? '#5ee07a' : '#ffc23a') : '#a08050';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(3, 3, W - 6, H - 6, 12);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8d5a3';
    ctx.font = 'bold 36px "Share Tech Mono", monospace';
    ctx.fillText(text, W / 2, sub ? 30 : H / 2 + 2);
    if (sub) {
        ctx.fillStyle = ok ? '#8dffa8' : '#ffc23a';
        ctx.font = 'bold 26px "Share Tech Mono", monospace';
        ctx.fillText(sub, W / 2, 68);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    const scale = 0.019;
    sprite.scale.set(W * scale, H * scale, 1);
    sprite.renderOrder = 15;
    return sprite;
}

// Couleurs de câbles réseau variées (comme de vrais câbles Ethernet cartoon)
const CABLE_COLORS = [0xddaa22, 0x2288dd, 0xdd4422, 0x22bb55, 0xcc44cc, 0xee8822];
let cableColorIdx = 0;

function drawCables() {
    // Supprime tous les anciens objets câble
    linkLines.forEach(l => {
        if (l.group) scene.remove(l.group);
    });
    linkLines = [];
    cableColorIdx = 0;

    levelData.links.forEach(link => {
        const cableGroup = new THREE.Group();
        const color = CABLE_COLORS[cableColorIdx % CABLE_COLORS.length];
        cableColorIdx++;

        const p1 = nodes3D[link.n1].position.clone();
        const p2 = nodes3D[link.n2].position.clone();
        const cableHeight = 1.2; // Hauteur de départ/arrivée au-dessus du sol
        p1.y = cableHeight;
        p2.y = cableHeight;

        // === CÂBLE PRINCIPAL (tube épais avec courbe au-dessus du sol) ===
        const dist = p1.distanceTo(p2);
        const arcHeight = cableHeight + 0.5 + dist * 0.06; // Arc vers le HAUT, toujours au-dessus du sol
        const midPoint = new THREE.Vector3(
            (p1.x + p2.x) / 2,
            arcHeight,
            (p1.z + p2.z) / 2
        );

        const curve = new THREE.QuadraticBezierCurve3(p1, midPoint, p2);
        const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.25, 8, false);
        const tubeMat = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.6,
            metalness: 0.1,
            flatShading: true
        });
        const tube = new THREE.Mesh(tubeGeo, tubeMat);
        tube.castShadow = true;
        cableGroup.add(tube);

        // Gaine extérieure (léger contour plus sombre pour effet cartoon)
        const outerGeo = new THREE.TubeGeometry(curve, 24, 0.3, 8, false);
        const outerMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color).multiplyScalar(0.5),
            roughness: 0.8,
            metalness: 0.0,
            flatShading: true,
            transparent: true,
            opacity: 0.35
        });
        const outer = new THREE.Mesh(outerGeo, outerMat);
        cableGroup.add(outer);

        // === CONNECTEURS RJ45 aux deux extrémités ===
        const intNames = [link.int1, link.int2];
        [p1, p2].forEach((pos, idx) => {
            const connGroup = new THREE.Group();

            // Boîtier du connecteur
            const bodyGeo = new THREE.BoxGeometry(0.55, 0.35, 0.7);
            const bodyMat = new THREE.MeshStandardMaterial({
                color: 0xddddcc,
                roughness: 0.3,
                metalness: 0.4,
                flatShading: true
            });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            connGroup.add(body);

            // Clip de verrouillage RJ45 (petit rectangle sur le dessus)
            const clipGeo = new THREE.BoxGeometry(0.3, 0.08, 0.5);
            const clipMat = new THREE.MeshStandardMaterial({
                color: 0xccccbb,
                roughness: 0.3,
                metalness: 0.5,
                flatShading: true
            });
            const clip = new THREE.Mesh(clipGeo, clipMat);
            clip.position.y = 0.21;
            connGroup.add(clip);

            // Contacts dorés (8 broches, comme un vrai RJ45)
            for (let pin = 0; pin < 8; pin++) {
                const pinGeo = new THREE.BoxGeometry(0.035, 0.04, 0.15);
                const pinMat = new THREE.MeshStandardMaterial({
                    color: 0xddaa44,
                    roughness: 0.2,
                    metalness: 0.9,
                    flatShading: true
                });
                const pinMesh = new THREE.Mesh(pinGeo, pinMat);
                pinMesh.position.set(-0.17 + pin * 0.05, 0.12, 0.28);
                connGroup.add(pinMesh);
            }

            // Manchon coloré (gaine du câble qui entre dans le connecteur)
            const sleeveGeo = new THREE.CylinderGeometry(0.28, 0.22, 0.4, 8);
            const sleeveMat = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.5,
                metalness: 0.1,
                flatShading: true
            });
            const sleeve = new THREE.Mesh(sleeveGeo, sleeveMat);
            sleeve.position.z = -0.5;
            sleeve.rotation.x = Math.PI / 2;
            connGroup.add(sleeve);

            // Orienter le connecteur vers l'autre extrémité
            const otherPos = idx === 0 ? p2 : p1;
            const dir = new THREE.Vector3().subVectors(otherPos, pos).normalize();
            const angle = Math.atan2(dir.x, dir.z);
            connGroup.rotation.y = angle;

            connGroup.position.copy(pos);
            connGroup.position.y = cableHeight;
            cableGroup.add(connGroup);

            // Label d'interface (affiché uniquement côté routeur, décalé le long du câble)
            const intName = intNames[idx];
            if (intName) {
                const nodeId = idx === 0 ? link.n1 : link.n2;
                const nd = levelData.nodes.find(n => n.id === nodeId);
                const intf = nd && nd.interfaces ? nd.interfaces.find(i => i.name === intName) : null;
                const cidr = intf ? Equipment.maskToCidr(intf.mask) : null;
                const ok = !!(intf && Equipment.looksLikeIp(intf.ip) && cidr !== null);
                const sub = intf && intf.ip ? `${intf.ip}${cidr !== null ? '/' + cidr : ''}` : null;
                const label = createInterfaceLabel(intName, sub, ok);
                // Décaler le label de 4 unités vers l'autre nœud pour éviter la superposition
                const labelDir = new THREE.Vector3().subVectors(otherPos, pos).normalize();
                label.position.copy(pos);
                label.position.x += labelDir.x * 3.6;
                label.position.z += labelDir.z * 3.6;
                label.position.y = cableHeight + 1.6;
                cableGroup.add(label);
            }
        });

        scene.add(cableGroup);

        // Stocker le groupe complet + matériaux pour pouvoir changer la couleur au succès
        linkLines.push({
            group: cableGroup,
            curve: curve,
            tubeMat: tubeMat,
            outerMat: outerMat,
            n1: link.n1,
            n2: link.n2
        });
    });

    if (linkEstablished) {
        linkLines.forEach(l => {
            l.tubeMat.color.setHex(0x00ff44);
            l.tubeMat.emissive = new THREE.Color(0x004400);
            l.outerMat.color.setHex(0x00aa22);
            l.outerMat.opacity = 0.5;
        });
        Gameplay.startStreams();
    }
}

// =============================================
// ÉVOLUTION 1 : SYSTÈME DE PAUSE
// =============================================
function togglePause() {
    if (!gameStarted || timeExpired || pingInProgress) return;

    const pauseOverlay = document.getElementById('pause-overlay');
    const pauseBtn = document.getElementById('btn-pause');

    if (isPaused) {
        // Reprendre
        isPaused = false;
        pauseOverlay.classList.add('hidden');
        pauseBtn.classList.remove('paused');
        pauseBtn.innerHTML = '&#9646;&#9646; PAUSE';
        if (timeLeft > 0 && !timeExpired) {
            timerInterval = setInterval(tickTimer, 1000);
        }
    } else {
        // Mettre en pause
        isPaused = true;
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        pauseOverlay.classList.remove('hidden');
        pauseBtn.classList.add('paused');
        pauseBtn.innerHTML = '&#9654; REPRENDRE';
    }
}

// Handler bouton pause
document.getElementById('btn-pause').addEventListener('click', togglePause);

// Handler reprendre depuis l'overlay
document.getElementById('btn-resume').addEventListener('click', togglePause);

// Handler menu depuis pause
document.getElementById('btn-pause-menu').addEventListener('click', () => {
    // Sortir de la pause, signaler au menu que le timer doit reprendre au retour
    isPaused = false;
    document.getElementById('pause-overlay').classList.add('hidden');
    document.getElementById('btn-pause').classList.remove('paused');
    document.getElementById('btn-pause').innerHTML = '&#9646;&#9646; PAUSE';
    // Indiquer manuellement que le timer était actif (pour que btn-menu-close le reprenne)
    timerPausedByMenu = true;
    showMenu();
    // Forcer l'affichage du bouton fermer puisqu'on vient d'une partie
    document.getElementById('btn-menu-close').style.display = 'flex';
});

// Raccourci clavier Échap pour pause
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && gameStarted && !document.querySelector('.modal:not(.hidden)') && !document.querySelector('.overlay:not(.hidden):not(#pause-overlay)')) {
        togglePause();
    }
});

// =============================================
// VALIDATION RÉSEAU STRICTE
// =============================================

// --- Utilitaires réseau ---
function ipToArray(str) {
    if (!str) return null;
    const parts = str.trim().split('.');
    if (parts.length !== 4) return null;
    const nums = parts.map(p => {
        if (!/^\d{1,3}$/.test(p)) return -1;
        return parseInt(p, 10);
    });
    if (nums.some(n => n < 0 || n > 255)) return null;
    return nums;
}

function isValidIPFormat(str) {
    if (!str) return { valid: false, partial: false };
    const parts = str.split('.');
    if (parts.length > 4) return { valid: false, partial: false };
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p === '') { if (parts.length === 4) return { valid: false, partial: false }; continue; }
        if (!/^\d{1,3}$/.test(p)) return { valid: false, partial: false };
        const num = parseInt(p, 10);
        if (num < 0 || num > 255) return { valid: false, partial: false };
    }
    if (parts.length === 4 && parts.every(p => p !== '' && /^\d{1,3}$/.test(p))) return { valid: true, partial: false };
    return { valid: false, partial: true };
}

function isValidMask(str) {
    const arr = ipToArray(str);
    if (!arr) return false;
    let binary = '';
    arr.forEach(p => binary += p.toString(2).padStart(8, '0'));
    return /^1+0+$/.test(binary) || binary === '11111111111111111111111111111111';
}

function getNetworkAddress(ipArr, maskArr) {
    return ipArr.map((o, i) => o & maskArr[i]);
}

function getBroadcastAddress(ipArr, maskArr) {
    return ipArr.map((o, i) => (o & maskArr[i]) | (~maskArr[i] & 255));
}

function arraysEqual(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

function isNetworkAddress(ipArr, maskArr) {
    const net = getNetworkAddress(ipArr, maskArr);
    return arraysEqual(ipArr, net);
}

function isBroadcastAddress(ipArr, maskArr) {
    const bcast = getBroadcastAddress(ipArr, maskArr);
    return arraysEqual(ipArr, bcast);
}

function sameNetwork(ip1Arr, ip2Arr, maskArr) {
    const net1 = getNetworkAddress(ip1Arr, maskArr);
    const net2 = getNetworkAddress(ip2Arr, maskArr);
    return arraysEqual(net1, net2);
}

function ipToString(arr) { return arr.join('.'); }

// --- Zone d'erreurs dans les modales ---
function showModalErrors(modalId, errors) {
    let errZone = document.getElementById(modalId + '-errors');
    if (!errZone) {
        errZone = document.createElement('div');
        errZone.id = modalId + '-errors';
        errZone.className = 'modal-errors';
        const modal = document.getElementById(modalId);
        const actions = modal.querySelector('.modal-actions');
        if (actions) modal.insertBefore(errZone, actions);
        else modal.appendChild(errZone);
    }
    errZone.innerHTML = errors.map(e => `<div class="modal-error-line">&#10007; ${e}</div>`).join('');
    errZone.classList.remove('hidden');
}

function clearModalErrors(modalId) {
    const errZone = document.getElementById(modalId + '-errors');
    if (errZone) { errZone.innerHTML = ''; errZone.classList.add('hidden'); }
}

// --- Validation complète STATION (PC) ---
function validatePC(ip, mask, gw) {
    const errors = [];

    // Champs vides
    if (!ip) errors.push('Adresse IP manquante.');
    if (!mask) errors.push('Masque manquant.');
    if (!gw) errors.push('Passerelle manquante.');
    if (errors.length > 0) return errors;

    // Format IP
    const ipArr = ipToArray(ip);
    if (!ipArr) errors.push(`IP "${ip}" : format invalide (ex: 192.168.1.10).`);

    // Masque valide (décimal pointé continu)
    if (!isValidMask(mask)) {
        errors.push(`Masque "${mask}" : n'est pas un masque valide (ex: 255.255.255.0).`);
    }

    // Format passerelle
    const gwArr = ipToArray(gw);
    if (!gwArr) errors.push(`Passerelle "${gw}" : format invalide.`);

    if (errors.length > 0) return errors;
    const maskArr = ipToArray(mask);

    // IP = adresse réseau ?
    if (isNetworkAddress(ipArr, maskArr)) {
        errors.push(`IP ${ip} est l'adresse réseau (${ipToString(getNetworkAddress(ipArr, maskArr))}). Utilisez une adresse d'hôte.`);
    }

    // IP = adresse broadcast ?
    if (isBroadcastAddress(ipArr, maskArr)) {
        errors.push(`IP ${ip} est l'adresse de broadcast (${ipToString(getBroadcastAddress(ipArr, maskArr))}). Utilisez une adresse d'hôte.`);
    }

    // IP identique à la passerelle ?
    if (arraysEqual(ipArr, gwArr)) {
        errors.push(`L'IP (${ip}) ne peut pas être identique à la passerelle.`);
    }

    // Passerelle dans le même réseau que l'IP ?
    if (!sameNetwork(ipArr, gwArr, maskArr)) {
        const net = ipToString(getNetworkAddress(ipArr, maskArr));
        errors.push(`La passerelle ${gw} n'est pas dans le même réseau que l'IP (réseau: ${net}/${mask}).`);
    }

    // Passerelle = adresse réseau ?
    if (isNetworkAddress(gwArr, maskArr)) {
        errors.push(`La passerelle ${gw} est une adresse réseau. Utilisez une adresse d'hôte.`);
    }

    // Passerelle = broadcast ?
    if (isBroadcastAddress(gwArr, maskArr)) {
        errors.push(`La passerelle ${gw} est une adresse de broadcast. Utilisez une adresse d'hôte.`);
    }

    return errors;
}

// --- Validation complète ROUTEUR ---
function validateRouter(interfaces, routes) {
    const errors = [];

    // 1) Valider chaque interface individuellement
    interfaces.forEach((intf, idx) => {
        const label = intf.name || `Interface ${idx}`;
        if (!intf.ip && !intf.mask) {
            errors.push(`${label} : IP et masque non renseignés.`);
            return;
        }
        if (!intf.ip) { errors.push(`${label} : IP manquante.`); return; }
        if (!intf.mask) { errors.push(`${label} : Masque manquant.`); return; }

        const ipArr = ipToArray(intf.ip);
        if (!ipArr) { errors.push(`${label} : IP "${intf.ip}" format invalide.`); return; }

        if (!isValidMask(intf.mask)) {
            errors.push(`${label} : Masque "${intf.mask}" n'est pas un masque valide.`);
            return;
        }
        const maskArr = ipToArray(intf.mask);

        if (isNetworkAddress(ipArr, maskArr)) {
            errors.push(`${label} : IP ${intf.ip} est l'adresse réseau. Utilisez une adresse d'hôte.`);
        }
        if (isBroadcastAddress(ipArr, maskArr)) {
            errors.push(`${label} : IP ${intf.ip} est l'adresse de broadcast. Utilisez une adresse d'hôte.`);
        }
    });

    if (errors.length > 0) return errors;

    // 2) Vérifier les interfaces entre elles
    for (let i = 0; i < interfaces.length; i++) {
        for (let j = i + 1; j < interfaces.length; j++) {
            const a = interfaces[i], b = interfaces[j];
            const ipA = ipToArray(a.ip), ipB = ipToArray(b.ip);
            const maskA = ipToArray(a.mask), maskB = ipToArray(b.mask);
            if (!ipA || !ipB || !maskA || !maskB) continue;

            // IP identiques ?
            if (arraysEqual(ipA, ipB)) {
                errors.push(`${a.name} et ${b.name} ont la même IP (${a.ip}). Chaque interface doit avoir une IP unique.`);
            }

            // Même réseau ? (on teste avec les deux masques)
            if (sameNetwork(ipA, ipB, maskA) || sameNetwork(ipA, ipB, maskB)) {
                const net = ipToString(getNetworkAddress(ipA, maskA));
                errors.push(`${a.name} (${a.ip}) et ${b.name} (${b.ip}) sont dans le même réseau (${net}). Les interfaces d'un routeur doivent être sur des réseaux différents.`);
            }
        }
    }

    // 3) Valider les routes statiques
    routes.forEach((rt, idx) => {
        if (!rt.dest && !rt.mask && !rt.gw) return; // ligne vide = ignorée
        const label = `Route ${idx + 1}`;
        if (!rt.dest) { errors.push(`${label} : réseau destination manquant.`); return; }
        if (!rt.mask) { errors.push(`${label} : masque destination manquant.`); return; }
        if (!rt.gw) { errors.push(`${label} : passerelle (next-hop) manquante.`); return; }

        const destArr = ipToArray(rt.dest);
        if (!destArr) { errors.push(`${label} : destination "${rt.dest}" format invalide.`); return; }
        if (!isValidMask(rt.mask)) { errors.push(`${label} : masque "${rt.mask}" n'est pas un masque valide.`); return; }
        const gwArr = ipToArray(rt.gw);
        if (!gwArr) { errors.push(`${label} : passerelle "${rt.gw}" format invalide.`); return; }

        // Le next-hop doit être joignable par une interface du routeur
        let gwReachable = false;
        interfaces.forEach(intf => {
            const intfIp = ipToArray(intf.ip);
            const intfMask = ipToArray(intf.mask);
            if (intfIp && intfMask && sameNetwork(gwArr, intfIp, intfMask)) {
                gwReachable = true;
            }
        });
        if (!gwReachable) {
            errors.push(`${label} : la passerelle ${rt.gw} n'est joignable par aucune interface du routeur.`);
        }
    });

    return errors;
}

// --- Validation temps réel (indicateurs visuels) ---
function getIPHint(value, type) {
    if (!value || value.length === 0) return { text: '', cls: 'hint-info' };
    if (type === 'mask') {
        if (isValidMask(value)) return { text: '&#10003; Masque valide', cls: 'valid' };
        const partial = isValidIPFormat(value);
        if (partial.partial) return { text: 'Saisie en cours...', cls: 'hint-info' };
        return { text: '&#10007; Masque invalide (ex: 255.255.255.0)', cls: 'invalid' };
    } else {
        const result = isValidIPFormat(value);
        if (result.valid) return { text: '&#10003; Format valide', cls: 'valid' };
        if (result.partial) return { text: 'Saisie en cours...', cls: 'hint-info' };
        return { text: '&#10007; Format invalide (ex: 192.168.1.10)', cls: 'invalid' };
    }
}

function applyIPValidation(input, hintEl) {
    const value = input.value.trim();
    const type = input.dataset.validate || 'ip';
    const hint = getIPHint(value, type);
    input.classList.remove('ip-valid', 'ip-invalid', 'ip-partial');
    if (!value) { /* vide */ }
    else if (hint.cls === 'valid') input.classList.add('ip-valid');
    else if (hint.cls === 'invalid') input.classList.add('ip-invalid');
    else input.classList.add('ip-partial');
    if (hintEl) {
        hintEl.innerHTML = hint.text;
        hintEl.className = 'ip-validation-hint ' + hint.cls;
    }
}

// Attacher la validation temps réel aux champs PC
['pc-ip', 'pc-mask', 'pc-gw'].forEach(id => {
    const input = document.getElementById(id);
    const hintEl = document.getElementById(id + '-hint');
    if (input) {
        input.addEventListener('input', () => applyIPValidation(input, hintEl));
        input.addEventListener('focus', () => applyIPValidation(input, hintEl));
    }
});

// Validation dynamique sur les champs routeur (délégation d'événements)
document.getElementById('modal-router').addEventListener('input', (e) => {
    if (e.target.matches('input[type="text"]')) {
        const value = e.target.value.trim();
        e.target.classList.remove('ip-valid', 'ip-invalid', 'ip-partial', 'router-ip-input');
        if (value) {
            e.target.classList.add('router-ip-input');
            // Déterminer si c'est un masque (id contient "mask")
            const isMask = e.target.id && e.target.id.includes('mask');
            if (isMask) {
                if (isValidMask(value)) e.target.classList.add('ip-valid');
                else if (isValidIPFormat(value).partial) e.target.classList.add('ip-partial');
                else e.target.classList.add('ip-invalid');
            } else {
                const result = isValidIPFormat(value);
                if (result.valid) e.target.classList.add('ip-valid');
                else if (result.partial) e.target.classList.add('ip-partial');
                else e.target.classList.add('ip-invalid');
            }
        }
        // Effacer les erreurs quand l'utilisateur corrige
        clearModalErrors('modal-router');
    }
});

// Effacer les erreurs PC quand l'utilisateur corrige
document.getElementById('modal-pc').addEventListener('input', () => {
    clearModalErrors('modal-pc');
});

// --- CHRONO & GAME OVER ---
function tickTimer() {
    if (timeExpired) return; // Timer déjà expiré, ne plus décrémenter
    timeLeft--;
    updateTimerDisplay();
    if(timeLeft === 30) document.getElementById('timer').className = 'danger';
    if(timeLeft <= 0) {
        clearInterval(timerInterval);
        triggerTimeExpired();
    }
}

function updateTimerDisplay() {
    if (timeExpired) {
        document.getElementById('timer').innerText = '00:00';
        return;
    }
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    document.getElementById('timer').innerText = `${m}:${s}`;
}

function triggerTimeExpired() {
    timeExpired = true;
    timeLeft = 0;
    updateTimerDisplay();
    document.getElementById('timer').className = 'danger';

    // Notification visuelle non bloquante
    Scoring.logEvent('⚠ TEMPS ÉCOULÉ — Vous pouvez continuer, mais sans bonus de vitesse.', 'warning');
    speak("Sergent, le temps est écoulé ! Terminez la mission sans bonus.");

    // Flash visuel sur le timer pour attirer l'attention
    const timerEl = document.getElementById('timer');
    timerEl.classList.add('timer-expired');
}

function triggerGameOver() {
    Scoring.failMission();
    Scoring.logEvent('MISSION ÉCHOUÉE - Liaison perdue.', 'error');
    const st = Scoring.getState();
    const goErrors = document.getElementById('go-errors');
    const goScore = document.getElementById('go-score');
    if (goErrors) goErrors.textContent = st.errors;
    if (goScore) goScore.textContent = Math.max(0, st.score);
    speak("Sergent, on est isolés ! Échec de la mission !");
    document.getElementById('game-over').classList.remove('hidden');
    Object.values(nodes3D).forEach(mesh => createExplosion(mesh.position));
}

function createExplosion(pos) {
    const geo = new THREE.BufferGeometry();
    const posArray = new Float32Array(100 * 3);
    const velArray = [];
    for(let i=0; i<100; i++) {
        posArray[i*3] = pos.x; posArray[i*3+1] = pos.y + 2; posArray[i*3+2] = pos.z;
        velArray.push({ x: (Math.random()-0.5)*3, y: Math.random()*3, z: (Math.random()-0.5)*3 });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const mat = new THREE.PointsMaterial({ size: 1.5, color: 0xff6600 });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    particles.push({ mesh: points, velocities: velArray, life: 60 });
}

// --- INTERACTION (CLIC = configurer, GLISSER = déplacer, caméra libre) ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const DRAG_THRESHOLD = 6;
let pointerState = null;   // { mode: 'node'|'pan'|'rotate', id, x, y, moved }
let cablesDirty = false;

function setMouseFromEvent(e) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function pickNode() {
    raycaster.setFromCamera(mouse, camera);
    const objectsToTest = Object.values(nodes3D).flatMap(g => g.children);
    const intersects = raycaster.intersectObjects(objectsToTest, true);
    for (const hit of intersects) {
        let o = hit.object;
        if (o.isSprite) continue;
        while (o && !(o.userData && o.userData.id)) o = o.parent;
        if (o) return o;
    }
    return null;
}

function isOnCanvas(e) { return e.target === renderer.domElement; }

renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('pointerdown', e => {
    if (!isOnCanvas(e)) return;
    setMouseFromEvent(e);
    if (e.button === 2 || e.button === 1) {
        pointerState = { mode: 'rotate', x: e.clientX, y: e.clientY, moved: false };
        return;
    }
    const nodeGroup = gameStarted ? pickNode() : null;
    if (nodeGroup) {
        pointerState = { mode: 'node', group: nodeGroup, id: nodeGroup.userData.id, x: e.clientX, y: e.clientY, moved: false };
    } else {
        pointerState = { mode: 'pan', x: e.clientX, y: e.clientY, moved: false };
    }
});

window.addEventListener('pointermove', e => {
    setMouseFromEvent(e);

    if (pointerState) {
        const dx = e.clientX - pointerState.x, dy = e.clientY - pointerState.y;
        if (!pointerState.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) pointerState.moved = true;
        if (pointerState.moved) {
            hideNodeTooltip();
            if (pointerState.mode === 'node') {
                draggedNode = pointerState.group;
                raycaster.setFromCamera(mouse, camera);
                const intersectPoint = new THREE.Vector3();
                if (raycaster.ray.intersectPlane(dragPlane, intersectPoint)) {
                    draggedNode.position.x = THREE.MathUtils.clamp(intersectPoint.x, -55, 55);
                    draggedNode.position.z = THREE.MathUtils.clamp(intersectPoint.z, -35, 35);
                    cablesDirty = true;
                }
                renderer.domElement.style.cursor = 'grabbing';
            } else if (pointerState.mode === 'pan') {
                CameraRig.pan(e.movementX || dx * 0.1, e.movementY || dy * 0.1);
                renderer.domElement.style.cursor = 'move';
            } else if (pointerState.mode === 'rotate') {
                CameraRig.rotate(e.movementX || 0, e.movementY || 0);
                renderer.domElement.style.cursor = 'grabbing';
            }
        }
        return;
    }

    // --- Survol : infobulle + anneau ---
    if (!isOnCanvas(e) || !gameStarted) {
        hideNodeTooltip();
        Gameplay.setHover(null);
        renderer.domElement.style.cursor = '';
        return;
    }
    const object = pickNode();
    if (object) {
        const id = object.userData.id;
        const alias = typeof Missions !== 'undefined' ? Missions.getAlias(id) : id;
        const typeLabel = object.userData.type === 'router' ? 'RELAIS' : 'POSTE';
        showNodeTooltip(e.clientX, e.clientY, `${typeLabel} — ${alias}  ·  clic : configurer  ·  glisser : déplacer`);
        renderer.domElement.style.cursor = 'pointer';
        Gameplay.setHover(id);
        return;
    }
    Gameplay.setHover(null);
    hideNodeTooltip();
    raycaster.setFromCamera(mouse, camera);
    const amb = Ambient.pick(raycaster);
    if (amb) {
        showNodeTooltip(e.clientX, e.clientY, `${amb.name}  ·  cliquer pour contacter`);
        renderer.domElement.style.cursor = 'help';
    } else {
        renderer.domElement.style.cursor = '';
    }
});

window.addEventListener('pointerup', e => {
    const st = pointerState;
    pointerState = null;
    draggedNode = null;
    renderer.domElement.style.cursor = '';
    if (!st) return;
    if (st.mode === 'node') {
        if (st.moved) {
            drawCables();
            Scoring.logEvent(`${Missions.getAlias(st.id)} repositionné.`, 'info');
        } else {
            openConfigMenu(st.id);
        }
    } else if (st.mode === 'pan' && !st.moved && isOnCanvas(e)) {
        setMouseFromEvent(e);
        raycaster.setFromCamera(mouse, camera);
        const amb = Ambient.pick(raycaster);
        if (amb) Ambient.interact(amb);
    }
});

window.addEventListener('wheel', e => {
    if (!isOnCanvas(e)) return;
    e.preventDefault();
    CameraRig.zoom(e.deltaY);
}, { passive: false });

renderer.domElement.addEventListener('dblclick', e => {
    setMouseFromEvent(e);
    const g = gameStarted ? pickNode() : null;
    if (g) CameraRig.focus(g.position.x, g.position.z);
});

window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if ((e.key === 'r' || e.key === 'R') && gameStarted) CameraRig.reset(false);
    if (e.key === '+' || e.key === '=') CameraRig.zoom(-1);
    if (e.key === '-') CameraRig.zoom(1);
});

// --- LOGIQUE INTERFACE (MODALES) ---
function getNodeData(id) { return levelData.nodes.find(n => n.id === id); }

let nodeSnapshot = null;
function openConfigMenu(id) {
    activeNodeId = id;
    const node = getNodeData(id);
    nodeSnapshot = JSON.stringify(node);
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));

    if (node.type === 'pc') {
        document.getElementById('pc-title').innerText = "Configuration " + Missions.getAlias(id);
        document.getElementById('pc-ip').value = node.config.ip;
        document.getElementById('pc-mask').value = node.config.mask;
        document.getElementById('pc-gw').value = node.config.gw;
        clearModalErrors('modal-pc');
        // Validation temps réel : initialiser l'état
        ['pc-ip', 'pc-mask', 'pc-gw'].forEach(fid => {
            const inp = document.getElementById(fid);
            const hint = document.getElementById(fid + '-hint');
            if (inp) applyIPValidation(inp, hint);
        });
        document.getElementById('modal-pc').classList.remove('hidden');
    } else {
        document.getElementById('router-title').innerText = "Console " + Missions.getAlias(id);
        clearModalErrors('modal-router');

        // Interfaces (avec l'équipement raccordé à chaque port)
        const intContainer = document.getElementById('router-interfaces');
        intContainer.innerHTML = `<div class="grid-head interface-head"><span>Port</span><span>Adresse IP</span><span>Masque</span></div>`;
        node.interfaces.forEach((intf, idx) => {
            const peer = getInterfacePeer(id, intf.name);
            intContainer.innerHTML += `
                <div class="interface-row">
                    <span class="intf-name">${intf.name}</span>
                    <input type="text" id="r-ip-${idx}" placeholder="IP" value="${intf.ip}" autocomplete="off">
                    <input type="text" id="r-mask-${idx}" placeholder="Masque" value="${intf.mask}" autocomplete="off">
                    <span class="intf-peer">${peer ? '↔ raccordé à <b>' + peer + '</b>' : '— port libre —'}</span>
                </div>`;
        });

        // Routes
        renderRoutes(node);
        document.getElementById('modal-router').classList.remove('hidden');
    }
    Gameplay.setSelected(id);
    // Focus sur le premier champ vide
    setTimeout(() => {
        const modal = document.querySelector('.modal:not(.hidden)');
        if (!modal) return;
        const empty = [...modal.querySelectorAll('input')].find(i => !i.value);
        const target = empty || modal.querySelector('input');
        if (target) target.focus();
    }, 30);
}

function getInterfacePeer(nodeId, intfName) {
    const l = levelData.links.find(k => (k.n1 === nodeId && k.int1 === intfName) || (k.n2 === nodeId && k.int2 === intfName));
    if (!l) return null;
    const peerId = l.n1 === nodeId ? l.n2 : l.n1;
    const peerInt = l.n1 === nodeId ? l.int2 : l.int1;
    return Missions.getAlias(peerId) + (peerInt ? ' (' + peerInt + ')' : '');
}

function syncRoutesFromInputs(node) {
    node.routes.forEach((rt, idx) => {
        const d = document.getElementById(`rt-dest-${idx}`);
        const m = document.getElementById(`rt-mask-${idx}`);
        const g = document.getElementById(`rt-gw-${idx}`);
        if (d) rt.dest = d.value.trim();
        if (m) rt.mask = m.value.trim();
        if (g) rt.gw = g.value.trim();
    });
}

function closeActiveModal() {
    const modal = document.querySelector('.modal:not(.hidden)');
    if (modal) {
        const btn = modal.querySelector('.btn-close');
        if (btn) btn.click();
    }
}

function renderRoutes(node) {
    const routeContainer = document.getElementById('router-routes');
    routeContainer.innerHTML = '';
    if (node.routes.length === 0) {
        routeContainer.innerHTML = `<div class="routes-empty">Aucune route statique. Les réseaux directement connectés sont routés automatiquement.</div>`;
        return;
    }
    routeContainer.innerHTML = `<div class="grid-head route-head"><span>Réseau destination</span><span>Masque</span><span>Next-hop</span><span></span></div>`;
    node.routes.forEach((rt, idx) => {
        routeContainer.innerHTML += `
            <div class="route-row">
                <input type="text" id="rt-dest-${idx}" placeholder="Réseau Dest" value="${rt.dest}" autocomplete="off">
                <input type="text" id="rt-mask-${idx}" placeholder="Masque" value="${rt.mask}" autocomplete="off">
                <input type="text" id="rt-gw-${idx}" placeholder="Next-hop" value="${rt.gw}" autocomplete="off">
                <button type="button" class="route-del" data-idx="${idx}" title="Supprimer cette route">✕</button>
            </div>`;
    });
}

document.getElementById('router-routes').addEventListener('click', e => {
    const btn = e.target.closest('.route-del');
    if (!btn) return;
    const node = getNodeData(activeNodeId);
    syncRoutesFromInputs(node);
    const idx = +btn.dataset.idx;
    const removed = node.routes.splice(idx, 1)[0];
    renderRoutes(node);
    Gameplay.refreshNode(activeNodeId, false);
    Scoring.logEvent(`Route ${removed && removed.dest ? removed.dest : '(vide)'} supprimée sur ${Missions.getAlias(activeNodeId)}.`, 'info');
});

// Entrée = enregistrer, Échap = fermer (dans les modales de configuration)
['modal-pc', 'modal-router'].forEach(mid => {
    document.getElementById(mid).addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById(mid === 'modal-pc' ? 'btn-save-pc' : 'btn-save-router').click();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            closeActiveModal();
        }
    });
});

document.getElementById('btn-add-route').addEventListener('click', () => {
    const node = getNodeData(activeNodeId);
    syncRoutesFromInputs(node);
    node.routes.push({ dest:"", mask:"", gw:"" });
    renderRoutes(node);
    const last = document.getElementById(`rt-dest-${node.routes.length - 1}`);
    if (last) last.focus();
    Scoring.onRouteAdded(activeNodeId);
});

// Sauvegardes avec VALIDATION STRICTE

document.getElementById('btn-save-pc').addEventListener('click', () => {
    const node = getNodeData(activeNodeId);
    const ip = document.getElementById('pc-ip').value.trim();
    const mask = document.getElementById('pc-mask').value.trim();
    const gw = document.getElementById('pc-gw').value.trim();

    // Toujours sauvegarder les valeurs saisies (même erronées) pour ne pas les perdre
    node.config.ip = ip;
    node.config.mask = mask;
    node.config.gw = gw;

    // Validation stricte
    const errors = validatePC(ip, mask, gw);
    if (errors.length > 0) {
        showModalErrors('modal-pc', errors);
        Scoring.logEvent(`Erreur config ${Missions.getAlias(activeNodeId)} : ${errors[0]}`, 'warning');
        Scoring.onConfigSaved(activeNodeId, false);
        playBeep(false);
        onNodeConfigChanged(activeNodeId, false);
        return; // Modale reste ouverte
    }

    // Config valide → fermer la modale
    clearModalErrors('modal-pc');
    Scoring.onConfigSaved(activeNodeId, true);
    Scoring.logEvent(`${Missions.getAlias(activeNodeId)} configuré : ${ip}/${mask} gw ${gw}`, 'success');
    document.getElementById('modal-pc').classList.add('hidden');
    playBeep(true);
    onNodeConfigChanged(activeNodeId, true);
});

document.getElementById('btn-save-router').addEventListener('click', () => {
    const node = getNodeData(activeNodeId);

    // Toujours sauvegarder les valeurs saisies (même erronées) pour ne pas les perdre
    node.interfaces.forEach((intf, idx) => {
        intf.ip = document.getElementById(`r-ip-${idx}`).value.trim();
        intf.mask = document.getElementById(`r-mask-${idx}`).value.trim();
    });
    node.routes.forEach((rt, idx) => {
        rt.dest = document.getElementById(`rt-dest-${idx}`).value.trim();
        rt.mask = document.getElementById(`rt-mask-${idx}`).value.trim();
        rt.gw = document.getElementById(`rt-gw-${idx}`).value.trim();
    });

    // Validation stricte
    const errors = validateRouter(node.interfaces, node.routes);
    if (errors.length > 0) {
        showModalErrors('modal-router', errors);
        Scoring.logEvent(`Erreur config ${Missions.getAlias(activeNodeId)} : ${errors[0]}`, 'warning');
        Scoring.onConfigSaved(activeNodeId, false);
        playBeep(false);
        onNodeConfigChanged(activeNodeId, false);
        return; // Modale reste ouverte
    }

    // Config valide → fermer la modale
    clearModalErrors('modal-router');
    Scoring.onConfigSaved(activeNodeId, true);
    Scoring.logEvent(`${Missions.getAlias(activeNodeId)} configuré avec succès.`, 'success');
    document.getElementById('modal-router').classList.add('hidden');
    playBeep(true);
    onNodeConfigChanged(activeNodeId, true);
});

document.querySelectorAll('.btn-close').forEach(b => b.addEventListener('click', (e) => {
    const modal = e.target.closest('.modal');

    // Sauvegarder les valeurs saisies en mémoire avant de fermer (pour ne rien perdre)
    if (activeNodeId) {
        const node = getNodeData(activeNodeId);
        if (node) {
            if (node.type === 'pc' && modal.id === 'modal-pc') {
                node.config.ip = document.getElementById('pc-ip').value.trim();
                node.config.mask = document.getElementById('pc-mask').value.trim();
                node.config.gw = document.getElementById('pc-gw').value.trim();
            } else if (node.type === 'router' && modal.id === 'modal-router') {
                node.interfaces.forEach((intf, idx) => {
                    const ipEl = document.getElementById(`r-ip-${idx}`);
                    const maskEl = document.getElementById(`r-mask-${idx}`);
                    if (ipEl) intf.ip = ipEl.value.trim();
                    if (maskEl) intf.mask = maskEl.value.trim();
                });
                node.routes.forEach((rt, idx) => {
                    const destEl = document.getElementById(`rt-dest-${idx}`);
                    const maskEl = document.getElementById(`rt-mask-${idx}`);
                    const gwEl = document.getElementById(`rt-gw-${idx}`);
                    if (destEl) rt.dest = destEl.value.trim();
                    if (maskEl) rt.mask = maskEl.value.trim();
                    if (gwEl) rt.gw = gwEl.value.trim();
                });
            }
        }
    }

    clearModalErrors(modal.id);
    modal.classList.add('hidden');
    if (activeNodeId) onNodeConfigChanged(activeNodeId, true);
}));

// Après toute modification : écrans, LEDs, plaques et étiquettes de câbles à jour.
// Une configuration modifiée après la liaison établie invalide la liaison.
function onNodeConfigChanged(id, closed) {
    if (!levelData) return;
    const node = getNodeData(id);
    const changed = !node || JSON.stringify(node) !== nodeSnapshot;
    if (node) nodeSnapshot = JSON.stringify(node);
    if (linkEstablished && changed) setLinkEstablished(false);
    Gameplay.refreshNode(id, false);
    drawCables();
    if (closed && !document.querySelector('.modal:not(.hidden)')) Gameplay.setSelected(null);
}

let linkEstablished = false;
function setLinkEstablished(on) {
    linkEstablished = on;
    Gameplay.refreshAll(on);
    if (on) Gameplay.startStreams(); else Gameplay.stopStreams();
    const statusEl = document.getElementById('hud-status-value');
    if (statusEl) {
        statusEl.textContent = on ? 'OPÉRATIONNELLE' : 'INTERROMPUE';
        statusEl.className = on ? 'status-connected' : 'status-disconnected';
    }
}


// --- MOTEUR DE VALIDATION (SIMULATEUR DE PING EDR) ---

function ipToLong(ip) {
    if(!ip || ip.split('.').length !== 4) return null;
    return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

function isSameSubnet(ip1, ip2, mask) {
    const lIp1 = ipToLong(ip1);
    const lIp2 = ipToLong(ip2);
    const lMask = ipToLong(mask);
    if(lIp1 === null || lIp2 === null || lMask === null) return false;
    return (lIp1 & lMask) === (lIp2 & lMask);
}

function getNodeByIp(ip) {
    for(let n of levelData.nodes) {
        if(n.type === 'pc' && n.config.ip === ip) return n;
        if(n.type === 'router') {
            for(let intf of n.interfaces) {
                if(intf.ip === ip) return n;
            }
        }
    }
    return null;
}

function routePacket(currentNode, targetIp, ttl = 10, trace) {
    if (trace) trace.push(currentNode.id);
    if(ttl <= 0) return { success: false, reason: "Boucle de routage (TTL expiré)." };

    // 1. Sommes-nous arrivés à destination ?
    if(currentNode.type === 'pc' && currentNode.config.ip === targetIp) return { success: true };
    if(currentNode.type === 'router' && currentNode.interfaces.some(i => i.ip === targetIp)) return { success: true };

    // 2. Traitement PC
    if(currentNode.type === 'pc') {
        if(isSameSubnet(currentNode.config.ip, targetIp, currentNode.config.mask)) {
            const targetNode = getNodeByIp(targetIp);
            if(targetNode) return routePacket(targetNode, targetIp, ttl - 1, trace);
        }
        if(!currentNode.config.gw) return { success: false, reason: `Passerelle manquante sur le poste ${currentNode.id}` };

        const gwNode = getNodeByIp(currentNode.config.gw);
        if(!gwNode) return { success: false, reason: `Passerelle ${currentNode.config.gw} injoignable ou mal configurée.` };
        return routePacket(gwNode, targetIp, ttl - 1, trace);
    }

    // 3. Traitement Routeur
    if(currentNode.type === 'router') {
        // A. Vérifier réseaux directement connectés (Interfaces)
        for(let intf of currentNode.interfaces) {
            if(intf.ip && intf.mask && isSameSubnet(intf.ip, targetIp, intf.mask)) {
                const targetNode = getNodeByIp(targetIp);
                if(targetNode) return routePacket(targetNode, targetIp, ttl - 1, trace);
            }
        }
        // B. Vérifier table de routage statique
        for(let rt of currentNode.routes) {
            if(rt.dest && rt.mask && rt.gw && isSameSubnet(rt.dest, targetIp, rt.mask)) {
                const nextHopNode = getNodeByIp(rt.gw);
                if(nextHopNode) return routePacket(nextHopNode, targetIp, ttl - 1, trace);
            }
        }
        return { success: false, reason: `Aucune route vers ${targetIp} dans la table de ${currentNode.id}` };
    }
    return { success: false, reason: "Équipement défectueux." };
}

function resumeTimerAfterPing() {
    if (!timeExpired && !isPaused && gameStarted && timeLeft > 0 && !timerInterval) {
        timerInterval = setInterval(tickTimer, 1000);
    }
}

function setVerifyBusy(busy) {
    pingInProgress = busy;
    const btn = document.getElementById('btn-verify');
    btn.disabled = busy;
    btn.classList.toggle('is-busy', busy);
    btn.textContent = busy ? 'PING EN COURS…' : 'VÉRIFIER LA CONNEXION (PING)';
}

document.getElementById('btn-verify').addEventListener('click', async () => {
    if (!levelData || pingInProgress || isPaused) return;
    document.querySelectorAll('.modal').forEach(m => { if (!m.classList.contains('hidden')) m.querySelector('.btn-close').click(); });

    // 1. Validation Physique (Câbles) — on identifie précisément les câbles en défaut
    const badLinks = [];
    levelData.links.forEach(link => {
        const n1 = getNodeData(link.n1);
        const n2 = getNodeData(link.n2);

        const ip1 = n1.type==='pc' ? n1.config.ip : n1.interfaces.find(i=>i.name===link.int1).ip;
        const mask1 = n1.type==='pc' ? n1.config.mask : n1.interfaces.find(i=>i.name===link.int1).mask;
        const ip2 = n2.type==='pc' ? n2.config.ip : n2.interfaces.find(i=>i.name===link.int2).ip;
        const mask2 = n2.type==='pc' ? n2.config.mask : n2.interfaces.find(i=>i.name===link.int2).mask;

        if(!ip1 || !ip2 || !mask1 || !mask2 || !isSameSubnet(ip1, ip2, mask1) || mask1 !== mask2) {
            badLinks.push(link);
        }
    });

    if (badLinks.length > 0) {
        playBeep(false);
        Gameplay.flashLinks(badLinks.map(l => [l.n1, l.n2]));
        const desc = badLinks.map(l => `${Missions.getAlias(l.n1)}${l.int1 ? ' ' + l.int1 : ''} ↔ ${Missions.getAlias(l.n2)}${l.int2 ? ' ' + l.int2 : ''}`);
        badLinks.forEach(l => {
            Gameplay.failBurst(nodes3D[l.n1].position.clone().lerp(nodes3D[l.n2].position, 0.5));
        });
        Scoring.onPingAttempt(false, `Câble(s) incohérent(s) (IP/masque pas dans le même sous-réseau) : ${desc.join(' ; ')}`);
        speak("Erreur. Les équipements reliés par le câble en rouge ne sont pas dans le même sous-réseau.");
        return;
    }

    // 2. Ping Test (Alpha <-> Bravo)
    const pcAlpha = levelData.nodes.find(n => n.id === "PC_Alpha");
    const pcBravo = levelData.nodes.find(n => n.id === "PC_Bravo");

    if(!pcAlpha.config.ip || !pcBravo.config.ip) {
        playBeep(false);
        Scoring.onPingAttempt(false, "Adresses IP des extrémités manquantes.");
        speak("Adresses IP des extrémités manquantes.");
        return;
    }

    // Le chrono est suspendu pendant l'animation du paquet
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    setVerifyBusy(true);
    Scoring.logEvent(`PING ${pcBravo.config.ip} depuis ${Missions.getAlias('PC_Alpha')}…`, 'info');

    // Ping Aller (paquet jaune)
    const traceAller = [];
    const pingAller = routePacket(pcAlpha, pcBravo.config.ip, 10, traceAller);
    await Gameplay.animatePacket(traceAller, pingAller.success, 0xffd24a);
    if (!levelData || !pingInProgress) return;
    if(!pingAller.success) {
        setVerifyBusy(false);
        resumeTimerAfterPing();
        playBeep(false);
        Scoring.onPingAttempt(false, 'ALLER : ' + pingAller.reason);
        speak("Le paquet aller a été perdu. " + pingAller.reason);
        return;
    }

    // Ping Retour (paquet bleu)
    Scoring.logEvent(`Réponse de ${Missions.getAlias('PC_Bravo')} en route…`, 'info');
    const traceRetour = [];
    const pingRetour = routePacket(pcBravo, pcAlpha.config.ip, 10, traceRetour);
    await Gameplay.animatePacket(traceRetour, pingRetour.success, 0x5ab4ff);
    if (!levelData || !pingInProgress) return;
    if(!pingRetour.success) {
        setVerifyBusy(false);
        resumeTimerAfterPing();
        playBeep(false);
        Scoring.onPingAttempt(false, 'RETOUR : ' + pingRetour.reason);
        speak("Le paquet retour a été perdu. " + pingRetour.reason);
        return;
    }

    // === SUCCÈS TOTAL ===
    clearInterval(timerInterval);
    timerInterval = null;
    setVerifyBusy(false);
    playBeep(true);
    Scoring.onPingAttempt(true);

    // Les câbles deviennent verts au succès + flux de données + feu d'artifice
    setLinkEstablished(true);
    drawCables();
    Gameplay.celebrate();

    Scoring.logEvent('LIAISON ÉTABLIE — Ping bidirectionnel confirmé !', 'success');
    speak("Beau travail Sergent. Ping bidirectionnel confirmé.");

    // Calcul du score final et affichage du débriefing
    const missionId = levelData.id;
    const totalTime = levels[currentLevelIndex].time;
    const debriefData = Scoring.completeMission(missionId, timeLeft, totalTime);

    // Sauvegarde progression si connecté
    if (Accounts.isLoggedIn()) {
        Accounts.completeLevel(missionId, debriefData.totalScore);
    }

    // Extraire la clé de médaille pour l'API
    // (déclaré ici pour être accessible dans submitChallengeResult plus bas)
    const medalKey = debriefData.medal ? debriefData.medal.label.toLowerCase().replace(/\s/g, '') : null;

    // Si un défi est en cours, soumettre le résultat
    if (activeChallengeId && Accounts.isLoggedIn()) {
        submitChallengeResult(debriefData.totalScore, medalKey);
    }

    // Après 1.5s : submit score (si connecté) → [bonus] → debrief + classement
    setTimeout(() => {
        // Fonction d'affichage du debrief final (avec ou sans bonus)
        function showFinalDebrief(bonusData, scores, playerName) {
            if (bonusData && bonusData.correct) {
                debriefData.bonusMission = Bonus.BONUS_SCORE_MISSION;
                debriefData.bonusTimeBonus = bonusData.timeRemaining * Bonus.BONUS_SCORE_PER_SECOND;
                debriefData.bonusTotal = debriefData.bonusMission + debriefData.bonusTimeBonus;
                debriefData.totalScore += debriefData.bonusTotal;
                debriefData.bonusQuestionCorrect = true;
                Scoring.addBonusToProfile(debriefData.bonusTotal);
            }

            let debriefHTML = Missions.getDebriefHTML(debriefData);
            document.getElementById('debrief-content').innerHTML = debriefHTML;

            // Classement uniquement si connecté
            if (scores && scores.length > 0) {
                const lbHTML = HighScores.renderLeaderboardHTML(scores, playerName, debriefData.totalScore);
                document.getElementById('debrief-content').innerHTML += lbHTML;
            }

            document.getElementById('debrief-overlay').classList.remove('hidden');
        }

        // Fonction pour lancer le bonus puis le debrief
        function proceedToBonusAndDebrief(scores, playerName) {
            if (Bonus.hasBonusQuestion(missionId)) {
                Bonus.showBonusBriefing(missionId, () => {
                    Bonus.showBonusQuestion(missionId, (bonusResult) => {
                        showFinalDebrief(bonusResult, scores, playerName);
                    });
                });
            } else {
                showFinalDebrief(null, scores, playerName);
            }
        }

        if (Accounts.isLoggedIn()) {
            // Utilisateur connecté : soumettre le score et afficher le classement
            const playerName = Accounts.getLogin().toUpperCase();
            HighScores.submitScore(missionId, playerName, debriefData.totalScore, medalKey, Accounts.getLogin())
                .then((result) => {
                    proceedToBonusAndDebrief(result.scores || [], playerName);
                })
                .catch(() => {
                    proceedToBonusAndDebrief([], playerName);
                });
        } else {
            // Anonyme : pas d'enregistrement de score, debrief direct
            proceedToBonusAndDebrief([], null);
        }
    }, 2800);
});

// --- BOUTONS DEBRIEFING (Mission suivante / Recommencer) ---
document.getElementById('btn-next-mission').addEventListener('click', () => {
    document.getElementById('debrief-overlay').classList.add('hidden');
    currentLevelIndex++;
    if (currentLevelIndex >= levels.length) {
        speak("Félicitations Sergent ! Vous avez terminé toutes les missions de la formation EDR.");
        // Afficher un écran de victoire finale
        document.getElementById('debrief-overlay').classList.add('hidden');
        const gameOver = document.getElementById('game-over');
        gameOver.querySelector('h1').textContent = 'FORMATION TERMINÉE';
        gameOver.querySelector('p').textContent = 'Félicitations Sergent ! Toutes les missions ont été accomplies avec succès.';
        const profile = Scoring.getProfile();
        const goScore = document.getElementById('go-score');
        const goErrors = document.getElementById('go-errors');
        if (goScore) goScore.textContent = profile.cumulScore;
        if (goErrors) goErrors.textContent = '—';
        gameOver.classList.remove('hidden');
    } else {
        showBriefing(currentLevelIndex);
    }
});

document.getElementById('btn-retry-mission').addEventListener('click', () => {
    document.getElementById('debrief-overlay').classList.add('hidden');
    showBriefing(currentLevelIndex);
});

// --- BOUTONS GAME OVER ---
document.getElementById('btn-go-retry').addEventListener('click', () => {
    document.getElementById('game-over').classList.add('hidden');
    showBriefing(currentLevelIndex);
});

document.getElementById('btn-go-menu').addEventListener('click', () => {
    document.getElementById('game-over').classList.add('hidden');
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    gameStarted = false;
    showMainMenu();
});

// --- BOUTONS MENU ---
document.getElementById('btn-menu').addEventListener('click', () => {
    showMenu();
});

document.getElementById('btn-menu-close').addEventListener('click', () => {
    document.getElementById('menu-overlay').classList.add('hidden');
    // Reprendre le timer s'il était en pause
    if (timerPausedByMenu && gameStarted && timeLeft > 0 && !timeExpired) {
        if (!timerInterval) {
            timerInterval = setInterval(tickTimer, 1000);
        }
    }
    timerPausedByMenu = false;
});

document.getElementById('btn-back-main-menu').addEventListener('click', () => {
    // Arrêter proprement la partie en cours
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    timerPausedByMenu = false;
    gameStarted = false;
    isPaused = false;
    document.getElementById('pause-overlay').classList.add('hidden');
    document.getElementById('btn-pause').classList.remove('paused');
    document.getElementById('btn-pause').innerHTML = '&#9646;&#9646; PAUSE';

    // Retour au menu principal SANS toucher à l'authentification
    showMainMenu();
});


// --- BOUCLE D'ANIMATION ---
let animTime = 0;

const animClock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(animClock.getDelta(), 0.1);
    animTime += dt;

    // Redessin des câbles pendant un glisser-déposer (au plus une fois par image)
    if (cablesDirty) { cablesDirty = false; drawCables(); }

    // Équipements : LEDs, écrans, antennes, groupe électrogène...
    Object.values(nodes3D).forEach(grp => {
        const nd = levelData ? levelData.nodes.find(n => n.id === grp.userData.id) : null;
        Equipment.animate(grp, animTime, dt, nd);
    });

    if (!gameStarted) CameraRig.idle(dt);
    Ambient.update(dt, animTime);
    Gameplay.update(dt, animTime);
    CameraRig.update(dt, camera);

    // Mise à jour des particules d'explosion
    for(let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.life--;
        const positions = p.mesh.geometry.attributes.position.array;
        for(let j = 0; j < p.velocities.length; j++) {
            positions[j*3] += p.velocities[j].x;
            positions[j*3+1] += p.velocities[j].y;
            positions[j*3+2] += p.velocities[j].z;
            p.velocities[j].y -= 0.1; // Gravité
        }
        p.mesh.geometry.attributes.position.needsUpdate = true;
        if(p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
        }
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    CameraRig.reset(false);
});

animate();

// Initialisation du module High Scores
HighScores.init();

// Initialisation du module Comptes puis auto-reconnexion ou choix anonyme/compte
Accounts.init().then(async () => {
    // Tenter la reconnexion automatique
    const saved = localStorage.getItem('gameedr_session');
    if (saved) {
        try {
            const session = JSON.parse(saved);
            if (session.login && session.password) {
                const result = await Accounts.authenticate(session.login, session.password);
                if (result.ok) {
                    console.log('[AutoReconnect] Reconnexion réussie pour', session.login);
                    Accounts.updateAccountIndicator();
                    showMainMenu();
                    return;
                }
            }
        } catch (e) {
            localStorage.removeItem('gameedr_session');
        }
    }
    showAccountChoice();
});

// --- ÉCRAN CHOIX ANONYME / COMPTE ---
function showAccountChoice() {
    document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
    document.getElementById('account-choice-overlay').classList.remove('hidden');
    Accounts.updateAccountIndicator();
    document.getElementById('btn-play-anonymous').onclick = () => {
        Accounts.logout();
        document.getElementById('account-choice-overlay').classList.add('hidden');
        Accounts.updateAccountIndicator();
        showMainMenu();
    };

    document.getElementById('btn-play-account').onclick = () => {
        document.getElementById('account-choice-overlay').classList.add('hidden');
        showLoginScreen();
    };

    document.getElementById('btn-home-credits').onclick = () => {
        document.getElementById('account-choice-overlay').classList.add('hidden');
        showCredits('home');
    };
}

// --- ÉCRAN CRÉDITS ---
let creditsReturnTo = 'home';

function showCredits(from) {
    creditsReturnTo = from || 'home';
    document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
    const overlay = document.getElementById('credits-overlay');
    const scroll = overlay.querySelector('.credits-scroll');
    // Relancer l'animation depuis le début
    scroll.style.animation = 'none';
    // Force reflow
    void scroll.offsetHeight;
    scroll.style.animation = '';
    overlay.classList.remove('hidden');
}

function closeCredits() {
    document.getElementById('credits-overlay').classList.add('hidden');
    if (creditsReturnTo === 'menu') {
        showMainMenu();
    } else {
        showAccountChoice();
    }
}

document.getElementById('btn-credits-close').onclick = closeCredits;

// Fermer avec Echap
document.getElementById('credits-overlay').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCredits();
});

// Retour auto à la fin du défilement
document.querySelector('.credits-scroll').addEventListener('animationend', closeCredits);

// --- ÉCRAN DE CONNEXION ---
function showLoginScreen() {
    document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
    const overlay = document.getElementById('login-overlay');
    const loginInput = document.getElementById('login-input');
    const pwInput = document.getElementById('login-password');
    const errorEl = document.getElementById('login-error');
    const successEl = document.getElementById('login-success');

    loginInput.value = '';
    pwInput.value = '';
    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');
    overlay.classList.remove('hidden');
    setTimeout(() => loginInput.focus(), 100);

    document.getElementById('btn-login-validate').onclick = async () => {
        const login = loginInput.value.trim();
        const password = pwInput.value;
        errorEl.classList.add('hidden');
        successEl.classList.add('hidden');

        if (!login || !password) {
            errorEl.textContent = 'Veuillez remplir tous les champs.';
            errorEl.classList.remove('hidden');
            return;
        }

        const result = await Accounts.authenticate(login, password);
        if (result.ok) {
            successEl.textContent = result.message;
            successEl.classList.remove('hidden');
            Accounts.updateAccountIndicator();
            // Sauvegarder la session pour reconnexion automatique
            saveSession(login, password);
            // Petite pause pour montrer le message de succès
            setTimeout(() => {
                overlay.classList.add('hidden');
                showMainMenu();
            }, 800);
        } else {
            errorEl.textContent = result.error;
            errorEl.classList.remove('hidden');
            pwInput.value = '';
            pwInput.focus();
        }
    };

    document.getElementById('btn-login-cancel').onclick = () => {
        overlay.classList.add('hidden');
        showAccountChoice();
    };

    // Bouton retour à l'accueil (si présent)
    const btnBack = document.getElementById('btn-login-back');
    if (btnBack) {
        btnBack.onclick = () => {
            overlay.classList.add('hidden');
            showAccountChoice();
        };
    }

    // Validation par Entrée
    const onEnter = (e) => { if (e.key === 'Enter') document.getElementById('btn-login-validate').click(); };
    loginInput.onkeydown = onEnter;
    pwInput.onkeydown = onEnter;
}

// =============================================
// TOOLTIP NOEUD 3D
// =============================================

function showNodeTooltip(x, y, text) {
    const tip = document.getElementById('node-tooltip');
    if (!tip) return;
    tip.textContent = text;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
    tip.classList.remove('hidden');
}

function hideNodeTooltip() {
    const tip = document.getElementById('node-tooltip');
    if (tip) tip.classList.add('hidden');
}

// =============================================
// SYSTÈME DE DÉFIS RÉSEAU (ASYNCHRONE)
// =============================================

const CHALLENGES_API = 'challenges/api.php';
let challengesAvailable = false;

// Vérifier la disponibilité de l'API challenges
function initChallenges() {
    fetch(CHALLENGES_API + '?action=ping')
        .then(r => r.json())
        .then(data => {
            challengesAvailable = data.success === true;
            console.log('[Challenges]', challengesAvailable ? 'API disponible.' : 'API indisponible.');
        })
        .catch(() => {
            challengesAvailable = false;
            console.warn('[Challenges] API indisponible.');
        });
}

function showChallenges() {
    document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
    const overlay = document.getElementById('challenges-overlay');
    overlay.classList.remove('hidden');

    // Tabs
    document.querySelectorAll('.challenges-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.challenges-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            loadChallengesTab(tab.dataset.tab);
        };
    });

    // Charger l'onglet actif
    loadChallengesTab('open');

    // Boutons retour
    document.getElementById('btn-challenges-close').onclick = () => {
        overlay.classList.add('hidden');
        showMainMenu();
    };
    document.getElementById('btn-challenges-back').onclick = () => {
        overlay.classList.add('hidden');
        showMainMenu();
    };
}

function loadChallengesTab(tab) {
    const content = document.getElementById('challenges-content');
    content.innerHTML = '<div class="challenges-loading">CHARGEMENT...</div>';

    if (tab === 'create') {
        renderCreateChallengeForm(content);
        return;
    }

    const login = Accounts.getLogin();
    let url = CHALLENGES_API + '?action=';

    if (tab === 'open') {
        url += 'list';
    } else if (tab === 'mine') {
        url += 'my_challenges&login=' + encodeURIComponent(login);
    }

    fetch(url)
        .then(r => r.json())
        .then(data => {
            if (!data.success || !data.challenges || data.challenges.length === 0) {
                content.innerHTML = '<div class="challenge-empty">Aucun défi disponible pour le moment.</div>';
                return;
            }
            renderChallengesList(content, data.challenges, tab);
        })
        .catch(() => {
            content.innerHTML = '<div class="challenge-empty">Erreur de connexion au serveur de défis.</div>';
        });
}

function renderChallengesList(container, challenges, tab) {
    const login = Accounts.getLogin();
    let html = '';

    challenges.forEach(ch => {
        const mission = Missions.get(ch.level_id);
        const missionName = mission ? mission.codeName : ('Mission ' + ch.level_id);
        const isOwn = ch.creator_login.toLowerCase() === login.toLowerCase();

        html += '<div class="challenge-card">';
        html += '<div class="challenge-info">';
        html += `<div class="challenge-creator">${isOwn ? '(VOUS) ' : ''}${ch.creator_login.toUpperCase()}</div>`;
        html += `<div class="challenge-level">${missionName} — Niveau ${ch.level_id}</div>`;
        html += '</div>';
        html += '<div class="challenge-score-ref">';
        html += `<div>${ch.creator_score.toLocaleString('fr-FR')}</div>`;
        html += '<div class="challenge-score-label">SCORE À BATTRE</div>';
        html += '</div>';

        html += '<div class="challenge-actions">';

        // Vérifier si le joueur a déjà relevé ce défi
        const myResult = ch.results ? ch.results.find(r => r.login.toLowerCase() === login.toLowerCase()) : null;

        if (myResult) {
            const won = myResult.score > ch.creator_score;
            html += `<div class="challenge-result ${won ? 'win' : 'lose'}">${won ? 'VICTOIRE' : 'DÉFAITE'} : ${myResult.score.toLocaleString('fr-FR')}</div>`;
        } else if (!isOwn) {
            html += `<button class="challenge-accept-btn" data-challenge-id="${ch.id}" data-level="${ch.level_id}">RELEVER LE DÉFI</button>`;
        } else {
            const count = ch.results ? ch.results.length : 0;
            html += `<div class="challenge-score-label">${count} participant(s)</div>`;
        }

        html += '</div></div>';
    });

    container.innerHTML = html;

    // Bind accept buttons
    container.querySelectorAll('.challenge-accept-btn').forEach(btn => {
        btn.onclick = () => {
            const challengeId = btn.dataset.challengeId;
            const levelId = parseInt(btn.dataset.level);
            acceptChallenge(challengeId, levelId);
        };
    });
}

function renderCreateChallengeForm(container) {
    const profile = Scoring.getProfile();
    let optionsHTML = '';
    for (let i = 1; i <= 10; i++) {
        const best = profile.bestScores[i] || 0;
        if (best > 0) {
            const mission = Missions.get(i);
            const name = mission ? mission.codeName : ('Mission ' + i);
            optionsHTML += `<option value="${i}" data-score="${best}">${name} — Meilleur score : ${best.toLocaleString('fr-FR')}</option>`;
        }
    }

    if (!optionsHTML) {
        container.innerHTML = '<div class="challenge-empty">Vous devez d\'abord compléter au moins une mission pour créer un défi.</div>';
        return;
    }

    container.innerHTML = `
        <div class="challenge-create-form">
            <label class="challenge-form-label">MISSION DU DÉFI</label>
            <select class="challenge-form-select" id="challenge-level-select">
                ${optionsHTML}
            </select>
            <div class="challenge-form-info" id="challenge-create-info">
                Votre meilleur score sera utilisé comme score de référence.
                Les autres joueurs devront le battre sur la même mission.
            </div>
            <button class="btn-success btn-large" id="btn-create-challenge" style="width:100%">PUBLIER LE DÉFI</button>
        </div>
    `;

    document.getElementById('btn-create-challenge').onclick = () => {
        const select = document.getElementById('challenge-level-select');
        const levelId = parseInt(select.value);
        const score = parseInt(select.options[select.selectedIndex].dataset.score);
        const medal = profile.medals[levelId] || null;
        createChallenge(levelId, score, medal);
    };
}

function createChallenge(levelId, score, medal) {
    const login = Accounts.getLogin();
    fetch(CHALLENGES_API + '?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            creator_login: login,
            level_id: levelId,
            creator_score: score,
            creator_medal: medal
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            // Recharger l'onglet "Mes défis"
            document.querySelectorAll('.challenges-tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.challenges-tab[data-tab="mine"]').classList.add('active');
            loadChallengesTab('mine');
        } else {
            alert('Erreur : ' + (data.error || 'Impossible de créer le défi.'));
        }
    })
    .catch(() => alert('Erreur de connexion au serveur.'));
}

// Variable pour stocker le défi en cours
let activeChallengeId = null;

function acceptChallenge(challengeId, levelId) {
    const login = Accounts.getLogin();

    // Notifier le serveur
    fetch(CHALLENGES_API + '?action=accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: challengeId, challenger_login: login })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            // Stocker l'ID du défi actif
            activeChallengeId = challengeId;

            // Fermer l'overlay challenges
            document.getElementById('challenges-overlay').classList.add('hidden');

            // Lancer directement le niveau
            const levelIndex = levelId - 1;
            if (levelIndex >= 0 && levelIndex < levels.length) {
                currentLevelIndex = levelIndex;

                // Afficher le briefing
                const mission = Missions.get(levelId);
                if (mission) {
                    document.getElementById('briefing-content').innerHTML = Missions.getBriefHTML(levelId);
                    document.getElementById('briefing-content').innerHTML += '<div class="debrief-medal" style="margin-top:15px;">MODE DÉFI — Score à battre : ' + data.challenge.creator_score.toLocaleString('fr-FR') + '</div>';
                    document.getElementById('briefing-overlay').classList.remove('hidden');
                } else {
                    loadLevel(levelIndex);
                    gameStarted = true;
                }
            }
        } else {
            alert('Erreur : ' + (data.error || 'Impossible d\'accepter le défi.'));
        }
    })
    .catch(() => alert('Erreur de connexion au serveur.'));
}

// Soumettre le résultat d'un défi après complétion de mission
function submitChallengeResult(score, medal) {
    if (!activeChallengeId) return;

    const login = Accounts.getLogin();
    fetch(CHALLENGES_API + '?action=complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            challenge_id: activeChallengeId,
            challenger_login: login,
            challenger_score: score,
            challenger_medal: medal
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            console.log('[Challenges] Résultat soumis :', data.won ? 'VICTOIRE' : 'DÉFAITE');
        }
    })
    .catch(() => console.warn('[Challenges] Erreur lors de la soumission du résultat.'))
    .finally(() => {
        activeChallengeId = null;
    });
}

// =============================================
// Sauvegarder la session après connexion réussie
function saveSession(login, password) {
    try {
        localStorage.setItem('gameedr_session', JSON.stringify({ login, password }));
    } catch (e) {}
}

// Initialisation des challenges
initChallenges();
