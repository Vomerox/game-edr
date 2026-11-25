// ==========================================
// GAME EDR - VIE AMBIANTE DU DÉCOR
// Route + convois, hélicoptère, oiseaux, météo, drapeau, radar, ciel.
// Les véhicules, l'hélico et le radar sont cliquables.
// ==========================================

// Relief du terrain (partagé avec game.js) : zone de jeu plate, dunes autour.
function terrainHeight(x, z) {
    const py = -z;
    let h = Math.sin(x * 0.05) * 0.8 + Math.cos(py * 0.08) * 0.5 + Math.sin(x * 0.12 + py * 0.1) * 0.3
          + Math.sin(x * 0.021 + 1.3) * Math.cos(py * 0.017) * 1.6;
    const d = Math.sqrt((x / 1.35) * (x / 1.35) + z * z);
    const t = Math.min(1, Math.max(0, (d - 40) / 28));
    const flat = t * t * (3 - 2 * t);
    const far = 1 + Math.max(0, d - 90) / 35;
    return -0.05 + flat * (h * far + 0.05);
}

const Ambient = (() => {
    const ROAD_Z = -54;
    const ROAD_LEN = 420;
    let scene = null;
    let root = null;
    let sky = null;
    let biome = 'desert';
    let cfg = null;

    let vehicles = [];
    let spawnTimer = 1.5;
    let heli = null;
    let heliTimer = 6;
    let birds = [];
    let weather = null;
    let puffs = [];
    let flag = null;
    let radar = null;
    let beacons = [];
    let clickables = [];

    // ---------- Configuration par biome ----------
    const BIOME_CFG = {
        desert:     { road: 0xb89c68, dust: 0xd8c294, vehicleColor: 0xb59a6a, fleet: ['truck', 'jeep', 'apc', 'truck'], heli: true, birds: 'vulture', weather: 'sand', lights: false },
        savane:     { road: 0xa88f5a, dust: 0xcdb680, vehicleColor: 0x8a8a52, fleet: ['jeep', 'truck', 'jeep'], heli: true, birds: 'vulture', weather: 'pollen', lights: false },
        canyon:     { road: 0xa06a40, dust: 0xc08a5a, vehicleColor: 0x9b7f56, fleet: ['truck', 'apc', 'jeep'], heli: true, birds: 'vulture', weather: 'sand', lights: false },
        forest:     { road: 0x5a4a32, dust: null, vehicleColor: 0x4f5a2e, fleet: ['truck', 'jeep'], heli: true, birds: 'crow', weather: 'leaves', lights: false },
        jungle:     { road: 0x4a3a24, dust: null, vehicleColor: 0x445228, fleet: ['jeep', 'truck'], heli: true, birds: 'crow', weather: 'rain', lights: true },
        mountain:   { road: 0x7c776c, dust: 0x9a958a, vehicleColor: 0x56603a, fleet: ['truck', 'apc'], heli: true, birds: 'crow', weather: 'snowlight', lights: false },
        arctic:     { road: 0xd5dde6, dust: 0xeef4fa, vehicleColor: 0xd6dbe0, fleet: ['truck', 'apc', 'jeep'], heli: true, birds: null, weather: 'snow', lights: true },
        urban:      { road: 0x2b2b30, dust: null, vehicleColor: 0x3a4030, fleet: ['car', 'car', 'jeep', 'car', 'truck'], heli: true, birds: null, weather: 'rain', lights: true, asphalt: true },
        industrial: { road: 0x34322e, dust: null, vehicleColor: 0x4a4a3a, fleet: ['truck', 'car', 'truck'], heli: true, birds: null, weather: 'embers', lights: true, asphalt: true },
        bunker:     { road: null, dust: null, vehicleColor: 0x404040, fleet: [], heli: false, birds: null, weather: 'dust', lights: true }
    };

    const VEHICLE_NAMES = {
        truck: ['Convoi logistique L-12', 'Camion de ravitaillement GBC', 'Porteur citerne C-7', 'Camion transmissions T-4'],
        jeep:  ['Patrouille VLRA', 'Véhicule de liaison P4', 'Patrouille légère Bravo-2'],
        apc:   ['VAB section 3', 'Blindé de reconnaissance R-1'],
        car:   ['Véhicule civil', 'Taxi local', 'Véhicule de la police militaire']
    };
    const CHATTER = [
        'RAS sur l\'axe Nord, on poursuit.',
        'Bien reçu, on maintient l\'allure.',
        'Ravitaillement en route vers le relais RAVEN.',
        'On a du matériel réseau à bord, ne coupez pas la route !',
        'Contact radio OK, à vous.',
        'Visibilité réduite, on ralentit.',
        'Les câbles de rechange arrivent dans 10 minutes.'
    ];

    // ---------- Utilitaires ----------
    const matCache = {};
    function mat(key, params) {
        if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(params);
        return matCache[key];
    }
    function add(parent, geo, material, x, y, z, rx, ry, rz) {
        const m = new THREE.Mesh(geo, material);
        m.position.set(x || 0, y || 0, z || 0);
        m.rotation.set(rx || 0, ry || 0, rz || 0);
        m.castShadow = true;
        m.receiveShadow = true;
        parent.add(m);
        return m;
    }
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);

    let dotTex = null;
    function dotTexture() {
        if (dotTex) return dotTex;
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
        dotTex = new THREE.CanvasTexture(c);
        return dotTex;
    }

    // ---------- Ciel dégradé ----------
    function buildSky() {
        const geo = new THREE.SphereGeometry(480, 32, 16);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x4f8fd8) },
                horizonColor: { value: new THREE.Color(0xe8d8b0) },
                sunDir: { value: new THREE.Vector3(0.4, 0.5, -0.75).normalize() },
                sunColor: { value: new THREE.Color(0xfff0c0) },
                sunStrength: { value: 1.0 }
            },
            vertexShader: `
                varying vec3 vDir;
                void main() {
                    vDir = normalize(position);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: `
                uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunStrength;
                varying vec3 vDir;
                void main() {
                    float h = max(vDir.y, 0.0);
                    vec3 col = mix(horizonColor, topColor, pow(h, 0.55));
                    float s = max(dot(vDir, sunDir), 0.0);
                    col += sunColor * (pow(s, 600.0) * 1.5 + pow(s, 12.0) * 0.25) * sunStrength;
                    if (vDir.y < 0.0) col = horizonColor;
                    gl_FragColor = vec4(col, 1.0);
                }`,
            side: THREE.BackSide,
            depthWrite: false,
            fog: false
        });
        sky = new THREE.Mesh(geo, material);
        sky.renderOrder = -1;
        scene.add(sky);
    }

    function setSky(top, horizon, sunPos, sunStrength) {
        if (!sky) return;
        sky.material.uniforms.topColor.value.setHex(top);
        sky.material.uniforms.horizonColor.value.setHex(horizon);
        if (sunPos) sky.material.uniforms.sunDir.value.set(sunPos[0], Math.max(sunPos[1] * 0.35, 8), sunPos[2] - 40).normalize();
        sky.material.uniforms.sunStrength.value = sunStrength === undefined ? 1 : sunStrength;
    }

    // ---------- Route ----------
    function buildRoad() {
        if (!cfg.road) return;
        const segs = 140;
        const geo = new THREE.PlaneGeometry(ROAD_LEN, 8.5, segs, 2);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), z = pos.getZ(i) + ROAD_Z;
            pos.setY(i, terrainHeight(x, z) + 0.12);
            pos.setZ(i, z);
        }
        geo.computeVertexNormals();
        const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: cfg.road, roughness: 1, metalness: 0 }));
        road.receiveShadow = true;
        root.add(road);

        // Marquage central (pointillés) ou ornières
        const dashMat = new THREE.MeshBasicMaterial({ color: cfg.asphalt ? 0xe8e2c8 : new THREE.Color(cfg.road).multiplyScalar(0.75) });
        const step = cfg.asphalt ? 7 : 3.5;
        for (let x = -ROAD_LEN / 2; x < ROAD_LEN / 2; x += step) {
            if (cfg.asphalt) {
                const d = new THREE.Mesh(B(3.2, 0.02, 0.22), dashMat);
                d.position.set(x, terrainHeight(x, ROAD_Z) + 0.16, ROAD_Z);
                root.add(d);
            } else {
                [-1.7, 1.7].forEach(off => {
                    const r = new THREE.Mesh(B(step * 0.95, 0.02, 0.6), dashMat);
                    r.position.set(x, terrainHeight(x, ROAD_Z + off) + 0.15, ROAD_Z + off);
                    root.add(r);
                });
            }
        }
        // Bornes / panneaux
        for (let x = -150; x <= 150; x += 50) {
            const post = new THREE.Group();
            add(post, B(0.25, 1.1, 0.25), mat('post', { color: 0xe8e4d8, roughness: 0.8 }), 0, 0.55, 0);
            add(post, B(0.27, 0.22, 0.27), mat('postRed', { color: 0xc03020, roughness: 0.6 }), 0, 0.95, 0);
            post.position.set(x + 7, terrainHeight(x + 7, ROAD_Z + 5), ROAD_Z + 5);
            root.add(post);
        }
        // Panneau directionnel
        const sign = new THREE.Group();
        add(sign, new THREE.CylinderGeometry(0.1, 0.1, 3.4, 6), mat('pole', { color: 0x777777, metalness: 0.6, roughness: 0.4 }), 0, 1.7, 0);
        const c = document.createElement('canvas');
        c.width = 256; c.height = 96;
        const g = c.getContext('2d');
        g.fillStyle = '#2d5a2a'; g.fillRect(0, 0, 256, 96);
        g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(6, 6, 244, 84);
        g.fillStyle = '#fff'; g.font = 'bold 34px "Share Tech Mono", monospace';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('PC EDR  ►', 128, 50);
        const panel = new THREE.Mesh(B(2.6, 1, 0.08), [mat('signBack', { color: 0x666666 }), mat('signBack', { color: 0x666666 }), mat('signBack', { color: 0x666666 }), mat('signBack', { color: 0x666666 }),
            new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.6 }), mat('signBack', { color: 0x666666 })]);
        panel.position.y = 3.1;
        panel.castShadow = true;
        sign.add(panel);
        sign.position.set(-24, terrainHeight(-24, ROAD_Z + 6), ROAD_Z + 6);
        root.add(sign);
    }

    // ---------- Véhicules ----------
    function wheel(parent, list, r, w, x, y, z) {
        const pivot = new THREE.Group();
        pivot.position.set(x, y, z);
        add(pivot, new THREE.CylinderGeometry(r, r, w, 14), mat('tire', { color: 0x1a1a1a, roughness: 0.95 }), 0, 0, 0, Math.PI / 2);
        add(pivot, new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 8), mat('rim', { color: 0x55583e, roughness: 0.6, metalness: 0.4 }), 0, 0, 0, Math.PI / 2);
        parent.add(pivot);
        list.push(pivot);
    }

    function lights(v, frontX, y, halfW, backX) {
        const head = new THREE.MeshBasicMaterial({ color: 0xfff4cc });
        const tail = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
        [-1, 1].forEach(s => {
            add(v.body, B(0.08, 0.22, 0.32), head, frontX, y, s * halfW);
            add(v.body, B(0.08, 0.16, 0.26), tail, backX, y, s * halfW);
        });
        v.headMat = head;
        if (cfg.lights) {
            const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xfff2c0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
            glow.scale.set(3.5, 2.2, 1);
            glow.position.set(frontX + 0.8, y, 0);
            v.body.add(glow);
            v.glow = glow;
            const beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xfff2c0, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
            beam.scale.set(9, 3, 1);
            beam.position.set(frontX + 4.5, 0.3, 0);
            v.body.add(beam);
        }
    }

    function buildTruck(v, color) {
        const body = v.body, wheels = v.wheels;
        const paint = mat('paint' + color, { color, roughness: 0.75, metalness: 0.15 });
        const dark = mat('dark', { color: 0x222222, roughness: 0.8 });
        const tarp = mat('tarp' + color, { color: new THREE.Color(color).multiplyScalar(0.8), roughness: 1, flatShading: true });
        add(body, B(7.2, 0.4, 2.3), dark, 0, 1.05, 0);                 // châssis
        add(body, B(2.0, 1.8, 2.3), paint, 2.55, 2.1, 0);              // cabine
        add(body, B(0.05, 0.75, 1.9), mat('glass', { color: 0x1d2b33, roughness: 0.1, metalness: 0.6 }), 3.56, 2.45, 0);
        add(body, B(1.0, 0.9, 2.2), paint, 3.9, 1.5, 0);               // capot
        add(body, B(0.1, 0.6, 2.2), dark, 4.42, 1.45, 0);              // calandre
        add(body, B(4.6, 0.9, 2.4), paint, -1.1, 1.7, 0);              // benne
        const cover = add(body, new THREE.CylinderGeometry(1.25, 1.25, 4.6, 10, 1, false, 0, Math.PI), tarp, -1.1, 2.15, 0, 0, 0, Math.PI / 2);
        cover.rotation.set(0, 0, Math.PI / 2);
        cover.scale.set(1, 1, 0.96);
        add(body, new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), dark, 1.6, 3.2, 1.0);  // échappement
        lights(v, 4.48, 1.55, 0.85, -3.42);
        [[3.1], [-1.2], [-2.6]].forEach(([x]) => [-1.1, 1.1].forEach(z => wheel(body, wheels, 0.62, 0.45, x, 0.62, z)));
        v.length = 9;
    }

    function buildJeep(v, color) {
        const body = v.body, wheels = v.wheels;
        const paint = mat('paint' + color, { color, roughness: 0.75, metalness: 0.15 });
        const dark = mat('dark', { color: 0x222222, roughness: 0.8 });
        add(body, B(4.4, 0.9, 2.1), paint, 0, 1.25, 0);
        add(body, B(1.4, 0.35, 2.0), paint, 1.4, 1.85, 0);             // capot
        add(body, B(0.06, 0.7, 1.9), mat('glass', { color: 0x1d2b33, roughness: 0.1, metalness: 0.6 }), 0.65, 2.1, 0, 0, 0, -0.25);
        add(body, B(0.1, 0.1, 2.0), dark, -0.9, 2.55, 0);              // arceau
        [-0.95, 0.95].forEach(z => add(body, B(0.1, 0.9, 0.1), dark, -0.9, 2.1, z));
        add(body, new THREE.CylinderGeometry(0.5, 0.5, 0.3, 12), mat('tire', { color: 0x1a1a1a, roughness: 0.95 }), -2.35, 1.4, 0, 0, 0, Math.PI / 2);
        add(body, new THREE.CylinderGeometry(0.03, 0.03, 2.4, 4), dark, -1.8, 2.9, 0.8);  // antenne
        lights(v, 2.22, 1.5, 0.75, -2.22);
        [1.4, -1.4].forEach(x => [-1.0, 1.0].forEach(z => wheel(body, wheels, 0.5, 0.4, x, 0.5, z)));
        v.length = 6;
    }

    function buildApc(v, color) {
        const body = v.body, wheels = v.wheels;
        const paint = mat('paint' + color, { color, roughness: 0.7, metalness: 0.25, flatShading: true });
        const dark = mat('dark', { color: 0x222222, roughness: 0.8 });
        add(body, B(6.2, 1.5, 2.6), paint, 0, 1.6, 0);
        add(body, B(1.2, 1.0, 2.6), paint, 3.35, 1.4, 0, 0, 0, 0.55);  // nez incliné
        add(body, B(4.8, 0.5, 2.3), paint, -0.4, 2.55, 0);
        const turret = new THREE.Group();
        turret.position.set(-0.2, 2.95, 0);
        add(turret, new THREE.CylinderGeometry(0.7, 0.8, 0.5, 10), paint, 0, 0, 0);
        add(turret, new THREE.CylinderGeometry(0.07, 0.07, 2.0, 6), dark, 1.1, 0.05, 0, 0, 0, Math.PI / 2);
        body.add(turret);
        v.turret = turret;
        lights(v, 3.7, 1.7, 1.0, -3.12);
        [2.2, 0.75, -0.75, -2.2].forEach(x => [-1.25, 1.25].forEach(z => wheel(body, wheels, 0.62, 0.4, x, 0.62, z)));
        v.length = 8;
    }

    function buildCar(v) {
        const body = v.body, wheels = v.wheels;
        const colors = [0x8a1c1c, 0x1c3f8a, 0xc9c9c9, 0x2b2b2b, 0xd8c24a, 0x3f6b3a];
        const p = new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)], roughness: 0.35, metalness: 0.5 });
        add(body, B(4.4, 0.75, 1.9), p, 0, 0.85, 0);
        add(body, B(2.3, 0.7, 1.75), mat('carGlass', { color: 0x223038, roughness: 0.15, metalness: 0.7 }), -0.3, 1.55, 0);
        add(body, B(2.2, 0.08, 1.7), p, -0.3, 1.93, 0);
        lights(v, 2.22, 0.95, 0.7, -2.22);
        [1.35, -1.35].forEach(x => [-0.9, 0.9].forEach(z => wheel(body, wheels, 0.42, 0.3, x, 0.42, z)));
        v.length = 5.5;
    }

    function spawnVehicle(kind, dir, xStart) {
        const v = { group: new THREE.Group(), body: new THREE.Group(), wheels: [], kind, dir, puffT: 0 };
        v.group.add(v.body);
        if (kind === 'truck') buildTruck(v, cfg.vehicleColor);
        else if (kind === 'jeep') buildJeep(v, cfg.vehicleColor);
        else if (kind === 'apc') buildApc(v, cfg.vehicleColor);
        else buildCar(v);
        v.speed = (kind === 'car' ? 13 : kind === 'jeep' ? 11 : 8) * (0.85 + Math.random() * 0.3);
        v.laneZ = ROAD_Z + (dir > 0 ? 1.9 : -1.9);
        v.x = xStart;
        v.group.rotation.y = dir > 0 ? 0 : Math.PI;
        const names = VEHICLE_NAMES[kind] || ['Véhicule'];
        v.name = names[Math.floor(Math.random() * names.length)];
        v.group.traverse(o => { o.userData.ambient = v; });
        root.add(v.group);
        vehicles.push(v);
        clickables.push(v.group);
        return v;
    }

    function scheduleTraffic(dt) {
        if (!cfg.fleet.length) return;
        spawnTimer -= dt;
        if (spawnTimer > 0 || vehicles.length > 10) return;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const start = -dir * (ROAD_LEN / 2 - 5);
        const convoy = Math.random() < 0.4 && !cfg.asphalt;
        if (convoy) {
            const n = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < n; i++) {
                const kind = i === 0 ? 'jeep' : (Math.random() < 0.7 ? 'truck' : 'apc');
                const v = spawnVehicle(kind, dir, start - dir * i * 13);
                v.speed = 8;
                v.convoy = true;
            }
            spawnTimer = 14 + Math.random() * 8;
        } else {
            spawnVehicle(cfg.fleet[Math.floor(Math.random() * cfg.fleet.length)], dir, start);
            spawnTimer = 5 + Math.random() * 8;
        }
    }

    // ---------- Poussière ----------
    function emitPuff(x, y, z, color) {
        let p = puffs.find(q => q.life <= 0);
        if (!p) {
            if (puffs.length > 90) return;
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color, transparent: true, opacity: 0, depthWrite: false }));
            root.add(s);
            p = { sprite: s, life: 0 };
            puffs.push(p);
        }
        p.sprite.material.color.setHex(color);
        p.sprite.position.set(x, y, z);
        p.life = p.max = 1.6 + Math.random() * 0.8;
        p.vy = 0.6 + Math.random() * 0.5;
        p.vx = (Math.random() - 0.5) * 0.8;
        p.sprite.visible = true;
    }

    // ---------- Hélicoptère ----------
    function buildHeli() {
        const h = { group: new THREE.Group() };
        const paint = mat('heli', { color: 0x3b4426, roughness: 0.6, metalness: 0.3, flatShading: true });
        const dark = mat('dark', { color: 0x222222, roughness: 0.8 });
        const body = add(h.group, new THREE.SphereGeometry(1.6, 12, 8), paint, 0, 0, 0);
        body.scale.set(2.0, 1.0, 1.05);
        add(h.group, new THREE.SphereGeometry(1.0, 10, 6), mat('heliGlass', { color: 0x1d2b33, roughness: 0.1, metalness: 0.7 }), 2.4, 0.25, 0).scale.set(1, 0.8, 1);
        add(h.group, new THREE.CylinderGeometry(0.25, 0.5, 6, 8), paint, -4.6, 0.35, 0, 0, 0, Math.PI / 2);
        add(h.group, B(1.2, 1.6, 0.12), paint, -7.4, 1.0, 0, 0, 0, -0.3);
        add(h.group, B(1.6, 0.1, 1.6), paint, -6.8, 0.4, 0);
        [-1.0, 1.0].forEach(z => {
            add(h.group, B(4.2, 0.12, 0.12), dark, 0, -1.9, z);
            add(h.group, B(0.1, 0.9, 0.1), dark, 1.0, -1.45, z * 0.8);
            add(h.group, B(0.1, 0.9, 0.1), dark, -1.0, -1.45, z * 0.8);
        });
        add(h.group, new THREE.CylinderGeometry(0.2, 0.3, 0.6, 8), dark, 0, 1.75, 0);
        const rotor = new THREE.Group();
        rotor.position.set(0, 2.1, 0);
        for (let i = 0; i < 4; i++) {
            const blade = add(rotor, B(7.5, 0.06, 0.45), dark, 0, 0, 0);
            blade.rotation.y = i * Math.PI / 2;
            blade.position.set(Math.cos(i * Math.PI / 2) * 3.75, 0, -Math.sin(i * Math.PI / 2) * 3.75);
        }
        const disc = new THREE.Mesh(new THREE.CircleGeometry(7.5, 24), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.12, depthWrite: false }));
        disc.rotation.x = -Math.PI / 2;
        rotor.add(disc);
        h.group.add(rotor);
        h.rotor = rotor;
        const tail = new THREE.Group();
        tail.position.set(-7.5, 1.0, 0.15);
        add(tail, B(0.1, 2.0, 0.08), dark, 0, 0, 0);
        h.group.add(tail);
        h.tail = tail;
        const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
        strobe.position.set(-7.6, 1.9, 0);
        h.group.add(strobe);
        h.strobe = strobe;
        h.group.scale.setScalar(0.85);
        h.name = 'Hélicoptère de reconnaissance « FAUCON 2 »';
        h.group.traverse(o => { o.userData.ambient = h; });
        h.kind = 'heli';
        return h;
    }

    function launchHeli() {
        if (!heli) {
            heli = buildHeli();
            root.add(heli.group);
            clickables.push(heli.group);
        }
        heli.active = true;
        heli.dir = Math.random() < 0.5 ? 1 : -1;
        heli.x = -heli.dir * 200;
        heli.z = -45 + Math.random() * 40;
        heli.y = 24 + Math.random() * 6;
        heli.speed = 24 + Math.random() * 8;
        heli.zDrift = (Math.random() - 0.5) * 0.15;
        heli.group.visible = true;
        heli.group.rotation.set(0, heli.dir > 0 ? 0 : Math.PI, 0);
    }

    // ---------- Oiseaux ----------
    function buildBirds(kind) {
        const color = kind === 'vulture' ? 0x2a2018 : 0x111111;
        const m = mat('bird' + kind, { color, roughness: 0.9, side: THREE.DoubleSide, flatShading: true });
        const count = kind === 'vulture' ? 5 : 8;
        const cx = (Math.random() - 0.5) * 60, cz = -30 + Math.random() * 20;
        for (let i = 0; i < count; i++) {
            const g = new THREE.Group();
            add(g, B(0.9, 0.22, 0.25), m, 0, 0, 0).castShadow = true;
            const wl = new THREE.Group(), wr = new THREE.Group();
            add(wl, B(0.55, 0.05, 1.5), m, 0, 0, 0.75);
            add(wr, B(0.55, 0.05, 1.5), m, 0, 0, -0.75);
            g.add(wl); g.add(wr);
            const s = kind === 'vulture' ? 1.4 : 0.8;
            g.scale.setScalar(s);
            root.add(g);
            birds.push({ g, wl, wr, r: 18 + Math.random() * 22, a: Math.random() * Math.PI * 2,
                speed: (0.18 + Math.random() * 0.12) * (Math.random() < 0.5 ? 1 : -1), y: 28 + Math.random() * 10,
                cx, cz, flap: Math.random() * 10, glide: kind === 'vulture' });
        }
    }

    // ---------- Météo ----------
    const WEATHER = {
        sand:      { n: 500, color: 0xe0cc98, size: 0.28, vel: [6, -0.2, 1.2], opacity: 0.55 },
        pollen:    { n: 300, color: 0xf2e6a8, size: 0.22, vel: [1.5, 0.15, 0.4], opacity: 0.6 },
        leaves:    { n: 160, color: 0x8a7a2a, size: 0.4, vel: [1.6, -1.2, 0.5], opacity: 0.85 },
        rain:      { n: 1400, color: 0x9fb4cc, size: 0.16, vel: [-1.5, -38, 0], opacity: 0.55 },
        snowlight: { n: 300, color: 0xffffff, size: 0.35, vel: [0.8, -2.2, 0.3], opacity: 0.8 },
        snow:      { n: 900, color: 0xffffff, size: 0.42, vel: [1.4, -3.2, 0.4], opacity: 0.9 },
        embers:    { n: 260, color: 0xff8a2a, size: 0.35, vel: [0.6, 2.2, 0.2], opacity: 0.9, additive: true },
        dust:      { n: 300, color: 0x9a9a8a, size: 0.25, vel: [0.3, -0.1, 0.2], opacity: 0.45 }
    };
    const WX = { minX: -90, maxX: 90, minY: 0, maxY: 45, minZ: -80, maxZ: 45 };

    function buildWeather(type) {
        const w = WEATHER[type];
        if (!w) return;
        const geo = new THREE.BufferGeometry();
        const arr = new Float32Array(w.n * 3);
        const seed = new Float32Array(w.n);
        for (let i = 0; i < w.n; i++) {
            arr[i * 3] = WX.minX + Math.random() * (WX.maxX - WX.minX);
            arr[i * 3 + 1] = WX.minY + Math.random() * (WX.maxY - WX.minY);
            arr[i * 3 + 2] = WX.minZ + Math.random() * (WX.maxZ - WX.minZ);
            seed[i] = Math.random() * 10;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const material = new THREE.PointsMaterial({
            color: w.color, size: w.size, map: dotTexture(), transparent: true, opacity: w.opacity,
            depthWrite: false, blending: w.additive ? THREE.AdditiveBlending : THREE.NormalBlending
        });
        const points = new THREE.Points(geo, material);
        points.frustumCulled = false;
        root.add(points);
        weather = { points, w, seed, type };
    }

    function updateWeather(dt, t) {
        if (!weather) return;
        const arr = weather.points.geometry.attributes.position.array;
        const v = weather.w.vel;
        const n = weather.w.n;
        for (let i = 0; i < n; i++) {
            const s = weather.seed[i];
            arr[i * 3] += (v[0] + Math.sin(t * 0.7 + s) * 0.6) * dt;
            arr[i * 3 + 1] += (v[1] + (weather.type === 'sand' || weather.type === 'pollen' ? Math.sin(t * 1.3 + s * 3) * 0.5 : 0)) * dt;
            arr[i * 3 + 2] += (v[2] + Math.cos(t * 0.5 + s) * 0.3) * dt;
            if (arr[i * 3] > WX.maxX) arr[i * 3] = WX.minX;
            if (arr[i * 3] < WX.minX) arr[i * 3] = WX.maxX;
            if (arr[i * 3 + 1] < WX.minY) arr[i * 3 + 1] = WX.maxY;
            if (arr[i * 3 + 1] > WX.maxY) arr[i * 3 + 1] = WX.minY;
            if (arr[i * 3 + 2] > WX.maxZ) arr[i * 3 + 2] = WX.minZ;
        }
        weather.points.geometry.attributes.position.needsUpdate = true;
        if (weather.type === 'embers') weather.points.material.opacity = 0.7 + Math.sin(t * 5) * 0.2;
    }

    // ---------- Drapeau ----------
    function buildFlag(x, z) {
        const g = new THREE.Group();
        add(g, new THREE.CylinderGeometry(0.08, 0.12, 9, 8), mat('flagPole', { color: 0xb0b0b0, metalness: 0.7, roughness: 0.3 }), 0, 4.5, 0);
        add(g, new THREE.SphereGeometry(0.18, 8, 6), mat('gold', { color: 0xd8b04a, metalness: 0.9, roughness: 0.3 }), 0, 9.1, 0);
        add(g, new THREE.CylinderGeometry(0.6, 0.8, 0.4, 8), mat('concrete', { color: 0x8a8a80, roughness: 1 }), 0, 0.2, 0);
        const c = document.createElement('canvas');
        c.width = 256; c.height = 160;
        const cg = c.getContext('2d');
        cg.fillStyle = '#4b5a2a'; cg.fillRect(0, 0, 256, 160);
        cg.fillStyle = '#d4a84b'; cg.fillRect(0, 0, 256, 14); cg.fillRect(0, 146, 256, 14);
        cg.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 18 : 42;
            cg.lineTo(128 + Math.cos(a) * r, 70 + Math.sin(a) * r);
        }
        cg.closePath(); cg.fill();
        cg.font = 'bold 30px "Black Ops One", monospace';
        cg.textAlign = 'center'; cg.fillText('EDR', 128, 136);
        const geo = new THREE.PlaneGeometry(3.6, 2.2, 18, 6);
        geo.translate(1.8, 0, 0);
        const cloth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide, roughness: 0.9 }));
        cloth.position.set(0.08, 7.7, 0);
        cloth.castShadow = true;
        g.add(cloth);
        g.position.set(x, terrainHeight(x, z), z);
        root.add(g);
        flag = { cloth, base: Float32Array.from(geo.attributes.position.array) };
        g.traverse(o => { o.userData.ambient = { kind: 'flag', name: 'Drapeau du groupement EDR' }; });
        clickables.push(g);
    }

    function updateFlag(t) {
        if (!flag) return;
        const pos = flag.cloth.geometry.attributes.position;
        const base = flag.base;
        for (let i = 0; i < pos.count; i++) {
            const x = base[i * 3], y = base[i * 3 + 1];
            const k = x / 3.6;
            pos.array[i * 3 + 2] = Math.sin(x * 2.2 - t * 6.5 + y * 0.6) * 0.28 * k + Math.sin(x * 4.1 - t * 9) * 0.06 * k;
            pos.array[i * 3 + 1] = y - k * k * 0.15;
        }
        pos.needsUpdate = true;
        flag.cloth.geometry.computeVertexNormals();
    }

    // ---------- Radar mobile ----------
    function buildRadar(x, z) {
        const g = new THREE.Group();
        const olive = mat('radarOlive', { color: 0x4b5530, roughness: 0.7, metalness: 0.2 });
        const dark = mat('dark', { color: 0x222222, roughness: 0.8 });
        add(g, B(5, 1.6, 2.4), olive, 0, 1.5, 0);
        [-1.6, 1.6].forEach(px => [-1.25, 1.25].forEach(pz => add(g, new THREE.CylinderGeometry(0.5, 0.5, 0.35, 12), dark, px, 0.5, pz, Math.PI / 2)));
        add(g, B(1.8, 0.12, 0.12), dark, 3.3, 0.9, 0);
        add(g, new THREE.CylinderGeometry(0.2, 0.25, 2.2, 8), mat('steel', { color: 0x70757b, metalness: 0.8, roughness: 0.4 }), -0.8, 3.4, 0);
        const head = new THREE.Group();
        head.position.set(-0.8, 4.6, 0);
        const dish = add(head, new THREE.SphereGeometry(2.0, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3.2), mat('dish', { color: 0xc8c8bc, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }), 0, 0, 0);
        dish.rotation.z = Math.PI / 2 - 0.3;
        dish.position.x = -0.9;
        add(head, new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), dark, 0.2, 0, 0, 0, 0, Math.PI / 2 - 0.3);
        g.add(head);
        const blink = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
        blink.position.set(1.8, 2.45, 0.9);
        g.add(blink);
        g.position.set(x, terrainHeight(x, z), z);
        g.rotation.y = 0.5;
        root.add(g);
        radar = { head, blink, speed: 1.2 };
        g.traverse(o => { o.userData.ambient = { kind: 'radar', name: 'Radar de surveillance aérienne', ref: radar }; });
        clickables.push(g);
    }

    // Gyrophares (bunker / industrie)
    function buildBeacon(x, z, h) {
        const g = new THREE.Group();
        add(g, new THREE.CylinderGeometry(0.12, 0.12, h, 6), mat('steel', { color: 0x70757b, metalness: 0.8, roughness: 0.4 }), 0, h / 2, 0);
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.45, 10), new THREE.MeshBasicMaterial({ color: 0xff8a00 }));
        lamp.position.y = h + 0.2;
        g.add(lamp);
        const beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: 0xff8a00, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
        beam.scale.set(4, 4, 1);
        beam.position.y = h + 0.2;
        g.add(beam);
        const light = new THREE.PointLight(0xff8a00, 0.0, 22, 2);
        light.position.y = h + 0.5;
        g.add(light);
        g.position.set(x, terrainHeight(x, z), z);
        root.add(g);
        beacons.push({ beam, light, phase: Math.random() * 6 });
    }

    // ---------- Nettoyage ----------
    function clearAll() {
        if (!root) return;
        while (root.children.length) {
            const c = root.children[0];
            root.remove(c);
            c.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material && !Object.values(matCache).includes(o.material)) {
                    if (Array.isArray(o.material)) o.material.forEach(m => { if (!Object.values(matCache).includes(m)) m.dispose(); });
                    else o.material.dispose();
                }
            });
        }
        vehicles = []; puffs = []; birds = []; beacons = []; clickables = [];
        heli = null; weather = null; flag = null; radar = null;
    }

    function clearDecorNear(decorGroup, keepOut) {
        if (!decorGroup) return;
        const doomed = decorGroup.children.filter(c => {
            const p = c.position;
            if (cfg.road && Math.abs(p.z - ROAD_Z) < 9) return true;
            return keepOut.some(k => Math.hypot(p.x - k.x, p.z - k.z) < k.r);
        });
        doomed.forEach(c => decorGroup.remove(c));
        // Poser le décor restant sur le relief
        decorGroup.children.forEach(c => { c.position.y += terrainHeight(c.position.x, c.position.z); });
    }

    // =========================================================
    // API
    // =========================================================
    function init(sc) {
        scene = sc;
        root = new THREE.Group();
        scene.add(root);
        buildSky();
    }

    function setBiome(name, decorGroup) {
        biome = name;
        cfg = BIOME_CFG[name] || BIOME_CFG.desert;
        clearAll();
        const flagPos = { x: -44, z: -28, r: 6 };
        const radarPos = { x: 46, z: -32, r: 8 };
        clearDecorNear(decorGroup, name === 'bunker' ? [] : [flagPos, radarPos]);

        buildRoad();
        if (name !== 'bunker') {
            buildFlag(flagPos.x, flagPos.z);
            buildRadar(radarPos.x, radarPos.z);
        }
        if (cfg.birds) buildBirds(cfg.birds);
        buildWeather(cfg.weather);
        if (name === 'bunker' || name === 'industrial') {
            [[-40, -25], [40, -25], [-40, 25], [40, 25]].forEach(([x, z]) => buildBeacon(x, z, name === 'bunker' ? 7 : 9));
        }
        // Pré-remplir la route pour que le décor soit vivant dès le départ
        spawnTimer = 0.5;
        if (cfg.fleet.length) {
            spawnVehicle(cfg.fleet[0], 1, -60 - Math.random() * 40);
            spawnVehicle(cfg.fleet[cfg.fleet.length - 1], -1, 50 + Math.random() * 40);
        }
        heliTimer = 4 + Math.random() * 6;
    }

    function update(dt, t) {
        if (!root || !cfg) return;
        dt = Math.min(dt, 0.1);

        // Véhicules
        scheduleTraffic(dt);
        for (let i = vehicles.length - 1; i >= 0; i--) {
            const v = vehicles[i];
            v.x += v.dir * v.speed * dt;
            const y = terrainHeight(v.x, v.laneZ) + 0.12;
            const hf = terrainHeight(v.x + v.dir * 2, v.laneZ), hb = terrainHeight(v.x - v.dir * 2, v.laneZ);
            v.group.position.set(v.x, y, v.laneZ);
            v.body.rotation.z = Math.atan2(hf - hb, 4);
            v.body.position.y = Math.sin(t * 9 + v.x) * 0.03;
            v.wheels.forEach(w => { w.rotation.z -= v.speed * dt / 0.55; });
            if (v.turret) v.turret.rotation.y = Math.sin(t * 0.3 + v.x * 0.01) * 0.8;
            if (v.honk > 0) {
                v.honk -= dt;
                if (v.headMat) v.headMat.color.setHex(Math.sin(t * 30) > 0 ? 0xffffff : 0x555544);
                if (v.honk <= 0 && v.headMat) v.headMat.color.setHex(0xfff4cc);
            }
            if (cfg.dust) {
                v.puffT -= dt;
                if (v.puffT <= 0) {
                    v.puffT = 0.08;
                    emitPuff(v.x - v.dir * (v.length / 2), y + 0.6, v.laneZ + (Math.random() - 0.5) * 1.5, cfg.dust);
                }
            }
            if (Math.abs(v.x) > ROAD_LEN / 2 + 10) {
                root.remove(v.group);
                v.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
                clickables.splice(clickables.indexOf(v.group), 1);
                vehicles.splice(i, 1);
            }
        }

        // Poussière
        puffs.forEach(p => {
            if (p.life <= 0) return;
            p.life -= dt;
            const k = 1 - p.life / p.max;
            p.sprite.position.y += p.vy * dt;
            p.sprite.position.x += p.vx * dt;
            p.sprite.scale.setScalar(1.2 + k * 4.5);
            p.sprite.material.opacity = Math.max(0, 0.42 * (1 - k));
            if (p.life <= 0) p.sprite.visible = false;
        });

        // Hélicoptère
        if (cfg.heli) {
            if (!heli || !heli.active) {
                heliTimer -= dt;
                if (heliTimer <= 0) launchHeli();
            } else {
                heli.x += heli.dir * heli.speed * dt;
                heli.z += heli.zDrift * heli.speed * dt;
                heli.group.position.set(heli.x, heli.y + Math.sin(t * 1.3) * 0.4, heli.z);
                heli.group.rotation.z = -0.12;
                heli.group.rotation.x = Math.sin(t * 0.8) * 0.04;
                heli.rotor.rotation.y += dt * 28;
                heli.tail.rotation.z += dt * 40;
                heli.strobe.visible = Math.sin(t * 8) > 0.6;
                if (Math.abs(heli.x) > 210) {
                    heli.active = false;
                    heli.group.visible = false;
                    heliTimer = 22 + Math.random() * 25;
                }
            }
        }

        // Oiseaux
        birds.forEach(b => {
            b.a += b.speed * dt;
            const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r;
            b.g.position.set(x, b.y + Math.sin(t * 0.6 + b.r) * 1.5, z);
            const sgn = b.speed > 0 ? 1 : -1;
            b.g.rotation.y = Math.atan2(-Math.cos(b.a) * sgn, -Math.sin(b.a) * sgn);
            b.g.rotation.x = (b.speed > 0 ? 1 : -1) * 0.25;
            const flapping = !b.glide || Math.sin(t * 0.4 + b.r) > 0.6;
            const f = flapping ? Math.sin(t * 9 + b.flap) * 0.6 : 0.08;
            b.wl.rotation.x = f;
            b.wr.rotation.x = -f;
        });

        updateWeather(dt, t);
        updateFlag(t);
        if (radar) {
            radar.head.rotation.y += dt * radar.speed;
            radar.blink.visible = Math.sin(t * 4) > 0.3;
        }
        beacons.forEach(b => {
            const s = Math.max(0, Math.sin(t * 5 + b.phase));
            b.beam.material.opacity = 0.15 + s * 0.7;
            b.light.intensity = s * 1.2;
        });
    }

    // Interaction : renvoie l'objet ambiant touché par le rayon (ou null)
    function pick(raycaster) {
        if (!clickables.length) return null;
        const hits = raycaster.intersectObjects(clickables.filter(c => c.visible !== false), true);
        if (!hits.length) return null;
        return hits[0].object.userData.ambient || null;
    }

    function horn() {
        if (typeof audioCtx === 'undefined') return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;
        [0, 0.28].forEach(off => {
            [349, 440].forEach(f => {
                const o = audioCtx.createOscillator(), g = audioCtx.createGain();
                o.type = 'square';
                o.frequency.value = f;
                g.gain.setValueAtTime(0.0001, now + off);
                g.gain.exponentialRampToValueAtTime(0.04, now + off + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, now + off + 0.22);
                o.connect(g); g.connect(audioCtx.destination);
                o.start(now + off); o.stop(now + off + 0.25);
            });
        });
    }

    function radarPing() {
        if (typeof audioCtx === 'undefined') return;
        const now = audioCtx.currentTime;
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(1400, now);
        o.frequency.exponentialRampToValueAtTime(700, now + 0.6);
        g.gain.setValueAtTime(0.06, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(now); o.stop(now + 0.8);
    }

    function interact(obj) {
        if (!obj) return false;
        const log = (msg, type) => { if (typeof Scoring !== 'undefined') Scoring.logEvent(msg, type || 'info'); };
        if (obj.kind === 'heli') {
            log(`📡 ${obj.name} : « Secteur survolé, aucune menace détectée. »`);
            radarPing();
        } else if (obj.kind === 'radar') {
            obj.ref.speed = obj.ref.speed > 3 ? 1.2 : 5;
            radarPing();
            log(`📡 ${obj.name} : balayage ${obj.ref.speed > 3 ? 'rapide activé' : 'normal'}.`);
        } else if (obj.kind === 'flag') {
            log('🎖 Le drapeau du groupement EDR flotte fièrement. Courage, Sergent !');
        } else {
            obj.honk = 0.9;
            horn();
            const line = CHATTER[Math.floor(Math.random() * CHATTER.length)];
            log(`🚚 ${obj.name} : « ${line} »`);
        }
        return true;
    }

    return { init, setBiome, setSky, update, pick, interact, ROAD_Z };
})();
