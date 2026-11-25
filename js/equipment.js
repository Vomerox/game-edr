// ==========================================
// GAME EDR - ÉQUIPEMENTS 3D
// Routeur tactique en caisse de transport (rack 19")
// Poste de commandement de campagne (PC durci + radio)
// Les écrans et LEDs reflètent la configuration réelle du nœud.
// ==========================================

const Equipment = (() => {

    // ---------- Matériaux partagés ----------
    const cache = {};
    function std(key, params) {
        if (!cache[key]) cache[key] = new THREE.MeshStandardMaterial(params);
        return cache[key];
    }
    function basic(key, params) {
        if (!cache[key]) cache[key] = new THREE.MeshBasicMaterial(params);
        return cache[key];
    }
    const M = {
        get olive()     { return std('olive',     { color: 0x556030, roughness: 0.72, metalness: 0.12 }); },
        get oliveDark() { return std('oliveDark', { color: 0x363d1c, roughness: 0.8,  metalness: 0.1 }); },
        get tan()       { return std('tan',       { color: 0xa08a5c, roughness: 0.85, metalness: 0.05 }); },
        get rack()      { return std('rack',      { color: 0x15171a, roughness: 0.6,  metalness: 0.35 }); },
        get chassis()   { return std('chassis',   { color: 0x2c3035, roughness: 0.42, metalness: 0.55 }); },
        get chassisLt() { return std('chassisLt', { color: 0x4a5058, roughness: 0.4,  metalness: 0.6 }); },
        get alu()       { return std('alu',       { color: 0xb9bdc2, roughness: 0.32, metalness: 0.85 }); },
        get steel()     { return std('steel',     { color: 0x70757b, roughness: 0.4,  metalness: 0.8 }); },
        get rubber()    { return std('rubber',    { color: 0x141414, roughness: 0.95, metalness: 0.0 }); },
        get port()      { return std('port',      { color: 0x050505, roughness: 0.6,  metalness: 0.2 }); },
        get gold()      { return std('gold',      { color: 0xd8b04a, roughness: 0.25, metalness: 0.9 }); },
        get wood()      { return std('wood',      { color: 0x7a5a36, roughness: 0.95, metalness: 0.0 }); },
        get woodDark()  { return std('woodDark',  { color: 0x5a4126, roughness: 0.95, metalness: 0.0 }); },
        get canvas()    { return std('canvas',    { color: 0x6b6a3e, roughness: 1.0,  metalness: 0.0 }); },
        get sandbag()   { return std('sandbag',   { color: 0xb49c6c, roughness: 1.0,  metalness: 0.0, flatShading: true }); },
        get sandbagDk() { return std('sandbagDk', { color: 0x9a845a, roughness: 1.0,  metalness: 0.0, flatShading: true }); },
        get yellow()    { return std('yellow',    { color: 0xd9a92a, roughness: 0.55, metalness: 0.1 }); },
        get blue()      { return std('blue',      { color: 0x3a7bd5, roughness: 0.5,  metalness: 0.1 }); },
        get white()     { return std('white',     { color: 0xe8e6df, roughness: 0.6,  metalness: 0.05 }); },
        get red()       { return std('red',       { color: 0xb02020, roughness: 0.5,  metalness: 0.1 }); },
        get glassDark() { return std('glassDark', { color: 0x0a0f0c, roughness: 0.15, metalness: 0.4 }); },
        get ledOff()    { return basic('ledOff',  { color: 0x1d2a1d }); }
    };

    function box(parent, w, h, d, mat, x, y, z, opts) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        if (opts) {
            if (opts.rx) m.rotation.x = opts.rx;
            if (opts.ry) m.rotation.y = opts.ry;
            if (opts.rz) m.rotation.z = opts.rz;
        }
        m.castShadow = !(opts && opts.noShadow);
        m.receiveShadow = true;
        parent.add(m);
        return m;
    }
    function cyl(parent, rt, rb, h, seg, mat, x, y, z, opts) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
        m.position.set(x, y, z);
        if (opts) {
            if (opts.rx) m.rotation.x = opts.rx;
            if (opts.ry) m.rotation.y = opts.ry;
            if (opts.rz) m.rotation.z = opts.rz;
        }
        m.castShadow = !(opts && opts.noShadow);
        m.receiveShadow = true;
        parent.add(m);
        return m;
    }
    function led(parent, color, x, y, z, size) {
        const s = size || 0.07;
        const mat = new THREE.MeshBasicMaterial({ color: color });
        const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, 0.03), mat);
        m.position.set(x, y, z);
        m.userData.onColor = color;
        parent.add(m);
        return m;
    }
    function setLed(m, on, color) {
        if (!m) return;
        if (color !== undefined) m.userData.onColor = color;
        m.material.color.setHex(on ? m.userData.onColor : 0x1a221a);
    }

    // ---------- Écrans dynamiques (CanvasTexture) ----------
    function makeScreen(w, h, pxW, pxH) {
        const canvas = document.createElement('canvas');
        canvas.width = pxW; canvas.height = pxH;
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        tex.anisotropy = 4;
        const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        return { canvas, ctx: canvas.getContext('2d'), tex, mesh };
    }

    function looksLikeIp(s) { return /^\d{1,3}(\.\d{1,3}){3}$/.test((s || '').trim()); }

    function maskToCidr(mask) {
        if (!looksLikeIp(mask)) return null;
        const bits = mask.split('.').map(n => (+n >>> 0).toString(2).padStart(8, '0')).join('');
        if (!/^1*0*$/.test(bits)) return null;
        return bits.indexOf('0') === -1 ? 32 : bits.indexOf('0');
    }

    function alias(id) {
        return (typeof Missions !== 'undefined' && Missions.getAlias) ? Missions.getAlias(id) : id;
    }

    // Texture "clavier" (une seule texture partagée)
    let keyboardTex = null;
    function getKeyboardTexture() {
        if (keyboardTex) return keyboardTex;
        const c = document.createElement('canvas');
        c.width = 256; c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = '#121314'; g.fillRect(0, 0, 256, 128);
        const rows = [14, 14, 13, 12];
        rows.forEach((n, r) => {
            const kw = 240 / 14;
            const off = (14 - n) * kw / 2;
            for (let i = 0; i < n; i++) {
                g.fillStyle = '#2b2d30';
                g.fillRect(8 + off + i * kw + 1, 8 + r * 22 + 1, kw - 3, 18);
                g.fillStyle = '#3a3d41';
                g.fillRect(8 + off + i * kw + 1, 8 + r * 22 + 1, kw - 3, 3);
            }
        });
        g.fillStyle = '#2b2d30'; g.fillRect(70, 98, 116, 16);   // barre espace
        g.fillStyle = '#1d1f21'; g.fillRect(100, 116, 56, 10);  // touchpad
        keyboardTex = new THREE.CanvasTexture(c);
        return keyboardTex;
    }

    // Texture étiquette (bandeau gravé)
    function makeLabelTexture(text, w, h, opts) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const g = c.getContext('2d');
        g.fillStyle = (opts && opts.bg) || '#c9c4b2';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
        g.fillStyle = (opts && opts.fg) || '#1a1a1a';
        g.font = `bold ${(opts && opts.size) || Math.floor(h * 0.55)}px "Share Tech Mono", monospace`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(text, w / 2, h / 2 + 2);
        const t = new THREE.CanvasTexture(c);
        t.minFilter = THREE.LinearFilter;
        return t;
    }

    // ---------- Sacs de sable ----------
    const bagGeo = new THREE.SphereGeometry(1, 7, 5);
    function sandbag(parent, x, y, z, rotY, dark) {
        const m = new THREE.Mesh(bagGeo, dark ? M.sandbagDk : M.sandbag);
        m.scale.set(0.62, 0.24, 0.34);
        m.position.set(x, y, z);
        m.rotation.y = rotY;
        m.castShadow = true; m.receiveShadow = true;
        parent.add(m);
    }
    function sandbagArc(parent, cx, cz, radius, a0, a1, layers) {
        for (let l = 0; l < layers; l++) {
            const n = Math.round(Math.abs(a1 - a0) * radius / 1.05);
            for (let i = 0; i <= n; i++) {
                const a = a0 + (a1 - a0) * ((i + (l % 2) * 0.5) / Math.max(1, n));
                if (l % 2 && i === n) continue;
                sandbag(parent, cx + Math.sin(a) * radius, 0.22 + l * 0.42, cz + Math.cos(a) * radius, a + Math.PI / 2, (i + l) % 3 === 0);
            }
        }
    }

    // =========================================================
    // ROUTEUR TACTIQUE : caisse de transport + rack 19"
    // =========================================================
    function buildRouter(group, node) {
        const ud = group.userData;
        ud.kind = 'router';
        ud.portLeds = {};
        ud.activityLeds = [];
        ud.anim = [];

        // Palette bois
        const pallet = new THREE.Group();
        for (let i = 0; i < 5; i++) box(pallet, 5.6, 0.12, 0.7, M.wood, 0, 0.36, -1.7 + i * 0.85);
        [-2.4, 0, 2.4].forEach(x => box(pallet, 0.5, 0.3, 4.1, M.woodDark, x, 0.15, 0));
        group.add(pallet);

        const baseY = 0.42;          // dessus de la palette
        const W = 4.6, H = 3.2, D = 3.0;
        const cy = baseY + H / 2;
        const frontZ = D / 2;

        // Coque de la caisse (olive), ouverte à l'avant
        box(group, W, H, D - 0.3, M.olive, 0, cy, -0.15);
        // Cadre frontal (lèvres de la caisse)
        const rim = 0.32;
        box(group, W, rim, 0.35, M.olive, 0, baseY + H - rim / 2, frontZ - 0.17);
        box(group, W, rim, 0.35, M.olive, 0, baseY + rim / 2, frontZ - 0.17);
        box(group, rim, H, 0.35, M.olive, -W / 2 + rim / 2, cy, frontZ - 0.17);
        box(group, rim, H, 0.35, M.olive, W / 2 - rim / 2, cy, frontZ - 0.17);
        // Fond intérieur noir
        box(group, W - 2 * rim, H - 2 * rim, 0.05, M.rack, 0, cy, frontZ - 0.6, { noShadow: true });

        // Coins renforcés (pare-chocs)
        [-1, 1].forEach(sx => [-1, 1].forEach(sy => [-1, 1].forEach(sz => {
            box(group, 0.42, 0.42, 0.42, M.oliveDark,
                sx * (W / 2 - 0.12), cy + sy * (H / 2 - 0.12), (sz > 0 ? frontZ - 0.12 : -D / 2 + 0.12));
        })));
        // Nervures moulées sur les flancs
        [-1, 1].forEach(sx => {
            for (let r = 0; r < 3; r++) {
                box(group, 0.08, 0.14, D - 1.0, M.oliveDark, sx * (W / 2 + 0.03), baseY + 0.8 + r * 0.8, -0.15);
            }
            // Poignée latérale encastrée
            box(group, 0.1, 0.35, 1.0, M.rubber, sx * (W / 2 + 0.06), cy + 0.6, -0.15);
            // Loquets papillon
            [-0.9, 0.9].forEach(dy => {
                box(group, 0.14, 0.38, 0.26, M.steel, sx * (W / 2 + 0.07), cy + dy, frontZ - 0.25);
            });
        });
        // Poignée de transport sur le dessus
        box(group, 0.12, 0.25, 0.12, M.rubber, -0.7, baseY + H + 0.12, -0.15);
        box(group, 0.12, 0.25, 0.12, M.rubber, 0.7, baseY + H + 0.12, -0.15);
        box(group, 1.6, 0.12, 0.16, M.rubber, 0, baseY + H + 0.28, -0.15);
        // Valve de pression
        cyl(group, 0.12, 0.12, 0.08, 10, M.rubber, 1.6, baseY + H + 0.04, -1.0);

        // Plaque d'identification sur le flanc droit
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.45),
            new THREE.MeshStandardMaterial({ map: makeLabelTexture(alias(node.id).toUpperCase(), 256, 72, { bg: '#d8d2bc' }), roughness: 0.6 }));
        plate.position.set(W / 2 + 0.03, baseY + 0.55, -0.15);
        plate.rotation.y = Math.PI / 2;
        group.add(plate);
        // Pochoir "NET-OPS" côté gauche
        const stencil = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.5),
            new THREE.MeshBasicMaterial({ map: makeLabelTexture('NET-OPS', 256, 72, { bg: 'rgba(0,0,0,0)', fg: '#d8d0b0' }), transparent: true, opacity: 0.85 }));
        stencil.position.set(-W / 2 - 0.03, baseY + 2.35, -0.15);
        stencil.rotation.y = -Math.PI / 2;
        group.add(stencil);

        // Couvercle avant déposé, appuyé contre la caisse (côté gauche)
        const lid = new THREE.Group();
        box(lid, 0.3, H - 0.1, D - 0.2, M.olive, 0, 0, 0);
        box(lid, 0.34, 0.36, 0.36, M.oliveDark, 0, (H - 0.1) / 2 - 0.15, (D - 0.2) / 2 - 0.15);
        box(lid, 0.34, 0.36, 0.36, M.oliveDark, 0, -(H - 0.1) / 2 + 0.15, (D - 0.2) / 2 - 0.15);
        box(lid, 0.34, 0.36, 0.36, M.oliveDark, 0, (H - 0.1) / 2 - 0.15, -(D - 0.2) / 2 + 0.15);
        box(lid, 0.34, 0.36, 0.36, M.oliveDark, 0, -(H - 0.1) / 2 + 0.15, -(D - 0.2) / 2 + 0.15);
        lid.position.set(-W / 2 - 0.75, (H - 0.1) / 2 * Math.cos(0.18) + 0.05, 0.2);
        lid.rotation.z = -0.18;
        group.add(lid);

        // ----- Rails de rack (montants alu) -----
        const innerW = W - 2 * rim;           // 3.96
        const railX = innerW / 2 - 0.08;
        const fz = frontZ - 0.22;              // face avant des équipements
        [-railX, railX].forEach(x => box(group, 0.14, H - 2 * rim, 0.06, M.alu, x, cy, fz - 0.02, { noShadow: true }));

        const faceW = innerW - 0.06;
        let y = baseY + H - rim;               // on empile depuis le haut

        // ---- 1) ROUTEUR (2U) ----
        const rH = 0.82;
        y -= rH / 2 + 0.04;
        const routerY = y;
        box(group, faceW, rH, 0.12, M.chassis, 0, routerY, fz, { noShadow: true });
        // Vis d'oreilles de rack
        [-1, 1].forEach(s => [-0.22, 0.22].forEach(dy => cyl(group, 0.035, 0.035, 0.05, 6, M.alu, s * (faceW / 2 - 0.07), routerY + dy, fz + 0.07, { rx: Math.PI / 2, noShadow: true })));
        // Écran LCD (hostname + état des interfaces)
        const lcd = makeScreen(1.15, 0.55, 320, 152);
        lcd.mesh.position.set(-1.2, routerY, fz + 0.065);
        group.add(lcd.mesh);
        ud.lcd = lcd;
        // LEDs PWR / SYS
        ud.ledPwr = led(group, 0x33ff55, -0.45, routerY + 0.2, fz + 0.07, 0.07);
        ud.ledSys = led(group, 0xffaa22, -0.45, routerY + 0.02, fz + 0.07, 0.07);
        // Étiquettes PWR/SYS minuscules (barres)
        box(group, 0.14, 0.025, 0.01, M.white, -0.3, routerY + 0.2, fz + 0.065, { noShadow: true });
        box(group, 0.14, 0.025, 0.01, M.white, -0.3, routerY + 0.02, fz + 0.065, { noShadow: true });

        // Ports Ethernet correspondant aux VRAIES interfaces du niveau
        const ifaces = node.interfaces || [];
        const portStep = 0.46;
        const portX0 = -0.05;
        ifaces.forEach((intf, i) => {
            const px = portX0 + i * portStep;
            box(group, 0.32, 0.28, 0.05, M.chassisLt, px, routerY - 0.08, fz + 0.065, { noShadow: true });
            box(group, 0.24, 0.2, 0.06, M.port, px, routerY - 0.1, fz + 0.075, { noShadow: true });
            box(group, 0.16, 0.03, 0.02, M.gold, px, routerY - 0.03, fz + 0.1, { noShadow: true });
            const lnk = led(group, 0x33ff55, px - 0.09, routerY + 0.12, fz + 0.07, 0.06);
            const act = led(group, 0xffb020, px + 0.09, routerY + 0.12, fz + 0.07, 0.06);
            setLed(lnk, false); setLed(act, false);
            ud.portLeds[intf.name] = { link: lnk, act: act, flash: 0 };
            // étiquette de port
            const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.11),
                new THREE.MeshBasicMaterial({ map: makeLabelTexture(intf.name.toUpperCase(), 128, 36, { bg: '#2c3035', fg: '#e8e8e8', size: 26 }) }));
            lab.position.set(px, routerY + 0.28, fz + 0.065);
            group.add(lab);
        });
        // Port console (bleu) + USB
        const conX = portX0 + Math.max(ifaces.length, 2) * portStep + 0.15;
        box(group, 0.24, 0.2, 0.06, M.blue, conX, routerY - 0.1, fz + 0.075, { noShadow: true });
        box(group, 0.2, 0.08, 0.06, M.port, conX + 0.32, routerY - 0.1, fz + 0.075, { noShadow: true });
        // Grille d'aération
        for (let v = 0; v < 5; v++) box(group, 0.04, 0.5, 0.02, M.rack, faceW / 2 - 0.5 + v * 0.08, routerY, fz + 0.065, { noShadow: true });

        // ---- 2) SWITCH (1U) ----
        const sH = 0.4;
        y -= rH / 2 + 0.06 + sH / 2;
        const swY = y;
        box(group, faceW, sH, 0.12, M.chassisLt, 0, swY, fz, { noShadow: true });
        for (let i = 0; i < 12; i++) {
            const px = -1.35 + i * 0.2 + (i >= 6 ? 0.1 : 0);
            box(group, 0.15, 0.13, 0.05, M.port, px, swY - 0.06, fz + 0.07, { noShadow: true });
            const a = led(group, 0x44ff66, px, swY + 0.1, fz + 0.07, 0.045);
            a.userData.phase = Math.random() * 10;
            a.userData.rate = 4 + Math.random() * 10;
            ud.activityLeds.push(a);
        }
        led(group, 0x44ff66, 1.55, swY, fz + 0.07, 0.06);

        // Câbles de brassage courts (switch -> routeur)
        const patchColors = [0x2f7fd8, 0xd9a92a, 0xcc3333];
        ifaces.forEach((intf, i) => {
            const px = portX0 + i * portStep;
            const sx = -1.35 + (i * 2) * 0.2;
            const p0 = new THREE.Vector3(px, routerY - 0.1, fz + 0.1);
            const p3 = new THREE.Vector3(sx, swY - 0.06, fz + 0.1);
            const curve = new THREE.CubicBezierCurve3(
                p0, new THREE.Vector3(px, routerY - 0.25, fz + 0.45),
                new THREE.Vector3(sx, swY + 0.05, fz + 0.45), p3);
            const t = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.025, 5, false),
                std('patch' + i, { color: patchColors[i % 3], roughness: 0.6 }));
            group.add(t);
        });

        // ---- 3) Panneau passe-câbles brosse (1U) ----
        y -= sH / 2 + 0.06 + 0.2;
        box(group, faceW, 0.36, 0.1, M.rack, 0, y, fz - 0.01, { noShadow: true });
        box(group, faceW - 0.5, 0.06, 0.02, std('brush', { color: 0x050505, roughness: 1 }), 0, y, fz + 0.05, { noShadow: true });

        // ---- 4) Onduleur (UPS 2U) ----
        const uH = 0.78;
        y -= 0.18 + 0.06 + uH / 2;
        const upsY = y;
        box(group, faceW, uH, 0.12, M.chassis, 0, upsY, fz, { noShadow: true });
        const upsLcd = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.26), basic('upsLcd', { color: 0x2a7a8a }));
        upsLcd.position.set(-1.1, upsY + 0.1, fz + 0.065);
        group.add(upsLcd);
        ud.batteryLeds = [];
        for (let b = 0; b < 5; b++) ud.batteryLeds.push(led(group, 0x33ff55, -0.5 + b * 0.13, upsY + 0.1, fz + 0.07, 0.07));
        [0.5, 0.75, 1.0].forEach(bx => cyl(group, 0.07, 0.07, 0.05, 10, M.rubber, bx, upsY + 0.05, fz + 0.07, { rx: Math.PI / 2, noShadow: true }));
        for (let v = 0; v < 14; v++) box(group, 0.16, 0.03, 0.02, M.rack, -0.7 + (v % 7) * 0.24, upsY - 0.22 - Math.floor(v / 7) * 0.08, fz + 0.065, { noShadow: true });

        // ----- Dessus : antenne GPS + fouet radio + gyrophare d'état -----
        const topY = baseY + H;
        cyl(group, 0.28, 0.32, 0.14, 14, M.white, -1.5, topY + 0.07, -0.8);
        cyl(group, 0.16, 0.2, 0.18, 10, M.rubber, 1.5, topY + 0.09, -1.0);
        const whip = cyl(group, 0.025, 0.04, 4.2, 6, M.rubber, 1.5, topY + 2.25, -1.0);
        ud.whip = whip;
        cyl(group, 0.18, 0.2, 0.2, 12, M.rubber, 0.2, topY + 0.1, 0.6);
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff8a00, transparent: true, opacity: 0.9 });
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), beaconMat);
        beacon.position.set(0.2, topY + 0.2, 0.6);
        group.add(beacon);
        ud.beacon = beacon;

        // ----- Groupe électrogène compact à droite -----
        const gen = new THREE.Group();
        gen.position.set(W / 2 + 1.35, 0, 0.6);
        // cadre tubulaire
        [[-0.7, -0.5], [0.7, -0.5], [-0.7, 0.5], [0.7, 0.5]].forEach(([x, z]) => cyl(gen, 0.05, 0.05, 1.3, 6, M.steel, x, 0.65, z));
        [-0.5, 0.5].forEach(z => box(gen, 1.5, 0.08, 0.08, M.steel, 0, 1.3, z));
        [-0.5, 0.5].forEach(z => box(gen, 1.5, 0.08, 0.08, M.steel, 0, 0.05, z));
        box(gen, 1.2, 0.45, 0.85, M.olive, 0, 1.0, 0);          // réservoir
        cyl(gen, 0.1, 0.1, 0.1, 10, M.rubber, 0.35, 1.27, 0.1);  // bouchon
        box(gen, 0.9, 0.55, 0.7, std('engine', { color: 0x2a2a2a, roughness: 0.6, metalness: 0.4 }), -0.1, 0.42, 0);
        cyl(gen, 0.08, 0.08, 0.5, 8, M.steel, 0.6, 0.55, -0.2, { rz: Math.PI / 2 }); // échappement
        box(gen, 0.25, 0.25, 0.08, M.yellow, 0.3, 0.45, 0.4);
        group.add(gen);
        ud.generator = gen;
        // câble d'alimentation au sol (générateur -> caisse)
        const pc = new THREE.CatmullRomCurve3([
            new THREE.Vector3(W / 2 + 0.75, 0.4, 0.8), new THREE.Vector3(W / 2 + 0.3, 0.06, 1.4),
            new THREE.Vector3(W / 2 - 0.2, 0.06, 1.7), new THREE.Vector3(W / 2 - 0.4, 0.5, frontZ - 0.1)]);
        group.add(new THREE.Mesh(new THREE.TubeGeometry(pc, 16, 0.04, 5, false), M.rubber));

        // Jerrican
        const jer = new THREE.Group();
        box(jer, 0.5, 0.75, 0.28, std('jerrican', { color: 0x4a5a2a, roughness: 0.6, metalness: 0.3 }), 0, 0.38, 0);
        box(jer, 0.3, 0.08, 0.08, M.steel, 0, 0.8, 0);
        jer.position.set(W / 2 + 0.95, 0, -1.4);
        jer.rotation.y = 0.4;
        group.add(jer);

        refresh(group, node, {});
    }

    // =========================================================
    // POSTE DE COMMANDEMENT : table de campagne + PC durci + radio
    // =========================================================
    function buildStation(group, node) {
        const ud = group.userData;
        ud.kind = 'pc';
        ud.anim = [];

        const tableY = 1.9;
        // Plateau de table pliante (alu + contreplaqué)
        box(group, 5.2, 0.1, 2.9, M.tan, 0, tableY, 0);
        box(group, 5.3, 0.14, 0.08, M.alu, 0, tableY - 0.02, 1.47);
        box(group, 5.3, 0.14, 0.08, M.alu, 0, tableY - 0.02, -1.47);
        // Pieds en X (pliants)
        [-2.3, 2.3].forEach(x => {
            const len = Math.sqrt(tableY * tableY + 2.4 * 2.4);
            const ang = Math.atan2(2.4, tableY);
            cyl(group, 0.05, 0.05, len, 6, M.alu, x, tableY / 2, 0, { rx: ang });
            cyl(group, 0.05, 0.05, len, 6, M.alu, x, tableY / 2, 0, { rx: -ang });
            box(group, 0.12, 0.08, 2.5, M.rubber, x, 0.04, 0);
        });
        box(group, 4.6, 0.06, 0.06, M.alu, 0, tableY / 2, 0);

        // ---- PC portable durci ----
        const lap = new THREE.Group();
        lap.position.set(-0.35, tableY + 0.05, 0.15);
        group.add(lap);
        const bodyMat = std('rugged', { color: 0x3b3f42, roughness: 0.55, metalness: 0.35 });
        box(lap, 2.7, 0.3, 1.9, bodyMat, 0, 0.15, 0);
        // pare-chocs caoutchouc
        [-1, 1].forEach(sx => [-1, 1].forEach(sz => box(lap, 0.3, 0.34, 0.3, M.rubber, sx * 1.3, 0.17, sz * 0.9)));
        // poignée de transport (avant)
        box(lap, 1.3, 0.1, 0.1, M.rubber, 0, 0.18, 1.12);
        box(lap, 0.08, 0.1, 0.18, M.rubber, -0.6, 0.18, 1.02);
        box(lap, 0.08, 0.1, 0.18, M.rubber, 0.6, 0.18, 1.02);
        // clavier
        const kb = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.15), new THREE.MeshStandardMaterial({ map: getKeyboardTexture(), roughness: 0.8 }));
        kb.rotation.x = -Math.PI / 2;
        kb.position.set(0, 0.305, 0.25);
        lap.add(kb);
        // LEDs de statut
        ud.ledPwr = led(lap, 0x33ff55, 1.0, 0.306, -0.5, 0.06); ud.ledPwr.rotation.x = -Math.PI / 2;
        ud.ledNet = led(lap, 0xffaa22, 1.1, 0.306, -0.5, 0.06); ud.ledNet.rotation.x = -Math.PI / 2;

        // écran (charnière à l'arrière)
        const hinge = new THREE.Group();
        hinge.position.set(0, 0.3, -0.85);
        hinge.rotation.x = -0.22;
        lap.add(hinge);
        box(hinge, 2.7, 1.95, 0.16, bodyMat, 0, 0.98, 0);
        [-1, 1].forEach(sx => [0.1, 1.86].forEach(yy => box(hinge, 0.28, 0.28, 0.2, M.rubber, sx * 1.3, yy, 0)));
        box(hinge, 2.35, 1.6, 0.02, M.glassDark, 0, 0.98, 0.08, { noShadow: true });
        const screen = makeScreen(2.25, 1.5, 512, 340);
        screen.mesh.position.set(0, 0.98, 0.095);
        hinge.add(screen.mesh);
        ud.screen = screen;
        // halo de l'écran
        const glow = new THREE.PointLight(0x66ffaa, 0.5, 7, 2);
        glow.position.set(-0.35, tableY + 1.4, 1.2);
        group.add(glow);
        ud.screenLight = glow;

        // ---- Poste radio de campagne (type sac à dos) ----
        const radio = new THREE.Group();
        radio.position.set(1.85, tableY + 0.05, -0.35);
        radio.rotation.y = -0.25;
        group.add(radio);
        box(radio, 0.85, 1.1, 0.6, M.oliveDark, 0, 0.55, 0);
        box(radio, 0.7, 0.35, 0.05, std('radioFace', { color: 0x222522, roughness: 0.7 }), 0, 0.85, 0.31);
        const rlcd = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.14), basic('radioLcd', { color: 0x9adf6a }));
        rlcd.position.set(-0.12, 0.88, 0.34);
        radio.add(rlcd);
        ud.radioLcd = rlcd;
        [[0.2, 0.92], [0.2, 0.76]].forEach(([x, yy]) => cyl(radio, 0.07, 0.07, 0.08, 10, M.rubber, x, yy, 0.35, { rx: Math.PI / 2 }));
        // fouet
        cyl(radio, 0.05, 0.06, 0.15, 8, M.steel, 0.28, 1.18, -0.15);
        const whip = cyl(radio, 0.02, 0.035, 3.6, 6, M.rubber, 0.28, 3.0, -0.15);
        ud.whip = whip;
        // combiné + cordon spiralé
        const handset = new THREE.Group();
        box(handset, 0.18, 0.62, 0.14, M.rubber, 0, 0, 0);
        box(handset, 0.22, 0.16, 0.18, M.rubber, 0, 0.3, 0.04);
        box(handset, 0.22, 0.16, 0.18, M.rubber, 0, -0.3, 0.04);
        handset.position.set(-0.75, 0.12, 0.45);
        handset.rotation.set(Math.PI / 2, 0, 0.9);
        radio.add(handset);
        const coilPts = [];
        for (let i = 0; i <= 60; i++) {
            const t = i / 60;
            coilPts.push(new THREE.Vector3(-0.45 + t * 0.1 + Math.cos(t * 50) * 0.04, 0.1 + t * 0.35 + Math.sin(t * 50) * 0.04, 0.35 - t * 0.05));
        }
        radio.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coilPts), 60, 0.012, 4, false), M.rubber));

        // ---- Accessoires sur la table ----
        // Porte-bloc + carte
        const mapCanvas = document.createElement('canvas');
        mapCanvas.width = 128; mapCanvas.height = 160;
        const mg = mapCanvas.getContext('2d');
        mg.fillStyle = '#e9e2c8'; mg.fillRect(0, 0, 128, 160);
        mg.strokeStyle = '#9db08a'; mg.lineWidth = 1;
        for (let i = 0; i < 12; i++) { mg.beginPath(); mg.arc(40 + i * 3, 70, 10 + i * 6, 0, Math.PI * 2); mg.stroke(); }
        mg.strokeStyle = '#c03030'; mg.lineWidth = 3;
        mg.beginPath(); mg.moveTo(15, 140); mg.lineTo(60, 90); mg.lineTo(110, 30); mg.stroke();
        mg.fillStyle = '#333'; mg.font = '10px monospace'; mg.fillText('SECTEUR 7', 8, 14);
        const clip = new THREE.Group();
        box(clip, 0.75, 0.04, 0.95, M.woodDark, 0, 0.02, 0);
        const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.84), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(mapCanvas), roughness: 0.9 }));
        paper.rotation.x = -Math.PI / 2; paper.position.y = 0.045;
        clip.add(paper);
        box(clip, 0.3, 0.06, 0.08, M.steel, 0, 0.06, -0.42);
        clip.position.set(-2.15, tableY + 0.05, 0.55);
        clip.rotation.y = 0.35;
        group.add(clip);
        // Tasse
        const mug = cyl(group, 0.14, 0.12, 0.3, 12, std('mug', { color: 0x40553a, roughness: 0.5, metalness: 0.2 }), 1.25, tableY + 0.2, 0.85);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 10), mug.material);
        handle.position.set(1.41, tableY + 0.2, 0.85);
        group.add(handle);
        // Lampe de campagne
        cyl(group, 0.1, 0.16, 0.08, 10, M.rubber, -2.2, tableY + 0.09, -0.85);
        cyl(group, 0.03, 0.03, 0.7, 6, M.rubber, -2.2, tableY + 0.45, -0.85);
        const lampHead = cyl(group, 0.18, 0.08, 0.25, 10, M.oliveDark, -2.05, tableY + 0.82, -0.75, { rx: 0.9 });
        lampHead.rotation.z = -0.4;

        // ---- Tabouret pliant (côté opérateur, vers la caméra) ----
        const stool = new THREE.Group();
        stool.position.set(-0.35, 0, 2.5);
        box(stool, 1.1, 0.06, 0.8, M.canvas, 0, 1.05, 0);
        [-0.45, 0.45].forEach(x => {
            cyl(stool, 0.035, 0.035, 1.35, 6, M.alu, x, 0.52, 0, { rx: 0.65 });
            cyl(stool, 0.035, 0.035, 1.35, 6, M.alu, x, 0.52, 0, { rx: -0.65 });
        });
        stool.rotation.y = 0.15;
        group.add(stool);

        // ---- Caisse à munitions (rangement batteries) ----
        const ammo = new THREE.Group();
        box(ammo, 1.0, 0.6, 0.5, std('ammo', { color: 0x4d5a2c, roughness: 0.55, metalness: 0.45 }), 0, 0.3, 0);
        box(ammo, 1.04, 0.08, 0.54, M.oliveDark, 0, 0.62, 0);
        box(ammo, 0.4, 0.06, 0.08, M.rubber, 0, 0.7, 0);
        ammo.position.set(2.9, 0, 1.0);
        ammo.rotation.y = -0.5;
        group.add(ammo);

        // ---- Muret de sacs de sable en arc derrière le poste ----
        sandbagArc(group, 0, 0.4, 3.9, Math.PI * 0.62, Math.PI * 1.38, 2);

        refresh(group, node, {});
    }

    // =========================================================
    // MISE À JOUR VISUELLE (écrans + LEDs) selon la configuration
    // =========================================================
    function ifaceOk(intf) { return looksLikeIp(intf.ip) && maskToCidr(intf.mask) !== null; }

    function refresh(group, node, state) {
        const ud = group.userData;
        ud.state = Object.assign(ud.state || {}, state || {});
        const linkUp = !!ud.state.linkUp;

        if (ud.kind === 'router') {
            const ifaces = node.interfaces || [];
            const okCount = ifaces.filter(ifaceOk).length;
            ifaces.forEach(intf => {
                const p = ud.portLeds[intf.name];
                if (p) setLed(p.link, ifaceOk(intf));
            });
            const complete = okCount === ifaces.length;
            ud.configured = complete;
            ud.beacon.material.color.setHex(linkUp ? 0x33ff66 : (complete ? 0xffd400 : 0xff5a00));
            setLed(ud.ledSys, true, complete ? 0x33ff55 : 0xffaa22);
            drawRouterLcd(ud.lcd, node, linkUp);
        } else {
            const c = node.config || {};
            const complete = looksLikeIp(c.ip) && maskToCidr(c.mask) !== null && looksLikeIp(c.gw);
            ud.configured = complete;
            setLed(ud.ledNet, true, linkUp ? 0x33ff55 : (complete ? 0xffd400 : 0xff5522));
            ud.radioLcd.material.color.setHex(linkUp ? 0x9adf6a : 0xd8c060);
            drawStationScreen(ud.screen, node, linkUp, true);
        }
    }

    function drawRouterLcd(lcd, node, linkUp) {
        const g = lcd.ctx, W = lcd.canvas.width, H = lcd.canvas.height;
        g.fillStyle = '#06210f'; g.fillRect(0, 0, W, H);
        g.fillStyle = 'rgba(120,255,160,0.06)';
        for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
        g.fillStyle = '#8dffb0';
        g.font = 'bold 26px "Share Tech Mono", monospace';
        g.textBaseline = 'top';
        g.fillText(alias(node.id).toUpperCase().slice(0, 18), 10, 6);
        g.font = '20px "Share Tech Mono", monospace';
        const ifaces = node.interfaces || [];
        ifaces.slice(0, 3).forEach((intf, i) => {
            const ok = ifaceOk(intf);
            g.fillStyle = ok ? '#8dffb0' : '#ff8a6a';
            const cidr = ok ? '/' + maskToCidr(intf.mask) : '';
            g.fillText(`${intf.name} ${ok ? 'UP  ' + intf.ip + cidr : 'DOWN ---'}`, 10, 40 + i * 24);
        });
        g.fillStyle = linkUp ? '#8dffb0' : '#ffd36a';
        const nRoutes = (node.routes || []).filter(r => r.dest && r.mask && r.gw).length;
        g.fillText(`RT:${nRoutes}  ${linkUp ? 'LIAISON OK' : 'EN ATTENTE'}`, 10, H - 26);
        lcd.tex.needsUpdate = true;
    }

    function drawStationScreen(scr, node, linkUp, cursorOn) {
        const g = scr.ctx, W = scr.canvas.width, H = scr.canvas.height;
        const grad = g.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#041a10'); grad.addColorStop(1, '#020c07');
        g.fillStyle = grad; g.fillRect(0, 0, W, H);
        // barre de titre
        g.fillStyle = linkUp ? '#1f6b3a' : '#3a4a2a';
        g.fillRect(0, 0, W, 34);
        g.fillStyle = '#e8ffe8';
        g.font = 'bold 20px "Share Tech Mono", monospace';
        g.textBaseline = 'middle';
        g.fillText(`■ ${alias(node.id).toUpperCase()} — TERMINAL TACTIQUE`, 10, 18);
        g.textBaseline = 'top';
        const c = node.config || {};
        const line = (label, val, y) => {
            g.fillStyle = '#6fd08f'; g.fillText(label, 16, y);
            const ok = label.indexOf('Passerelle') === 0 ? looksLikeIp(val) : (label.indexOf('Masque') === 0 ? maskToCidr(val) !== null : looksLikeIp(val));
            g.fillStyle = ok ? '#d8ffe0' : '#ff7a5a';
            g.fillText(val ? val : '— non défini —', 250, y);
        };
        g.font = '21px "Share Tech Mono", monospace';
        g.fillStyle = '#9dffb8'; g.fillText('C:\\> ipconfig', 12, 48);
        line('Adresse IPv4 . .', c.ip, 84);
        line('Masque . . . . .', c.mask, 114);
        line('Passerelle . . .', c.gw, 144);
        g.fillStyle = '#9dffb8';
        g.fillText('C:\\> ping ' + (linkUp ? 'OK  (4/4 reçus)' : '...'), 12, 186);
        // barre d'état
        g.fillStyle = linkUp ? '#30d060' : '#d08a20';
        g.fillRect(12, H - 70, W - 24, 4);
        g.font = 'bold 22px "Share Tech Mono", monospace';
        g.fillStyle = linkUp ? '#5dff8a' : '#ffbf4a';
        g.fillText(linkUp ? 'LIAISON OPÉRATIONNELLE' : 'LIAISON INTERROMPUE', 12, H - 58);
        // curseur
        if (cursorOn) { g.fillStyle = '#9dffb8'; g.fillRect(12, H - 26, 14, 18); }
        // lignes de balayage
        g.fillStyle = 'rgba(0,0,0,0.18)';
        for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
        scr.tex.needsUpdate = true;
    }

    // Flash d'activité sur un port (passage de paquet)
    function flashPort(group, intfName) {
        const ud = group.userData;
        if (ud.kind === 'router') {
            if (intfName && ud.portLeds[intfName]) ud.portLeds[intfName].flash = 0.6;
            else Object.values(ud.portLeds).forEach(p => p.flash = 0.6);
        } else if (ud.ledNet) {
            ud.netFlash = 0.6;
        }
    }

    // =========================================================
    // ANIMATION (appelée à chaque frame)
    // =========================================================
    function animate(group, t, dt, node) {
        const ud = group.userData;
        if (!ud.kind) return;
        // Oscillation légère des antennes fouet (vent)
        if (ud.whip) ud.whip.rotation.z = Math.sin(t * 1.7 + group.position.x) * 0.035;

        if (ud.kind === 'router') {
            ud.activityLeds.forEach(l => {
                setLed(l, Math.sin(t * l.userData.rate + l.userData.phase) > 0.2);
            });
            const linkUp = ud.state && ud.state.linkUp;
            Object.values(ud.portLeds).forEach(p => {
                if (p.flash > 0) {
                    p.flash -= dt;
                    setLed(p.act, Math.sin(t * 40) > 0);
                } else {
                    setLed(p.act, linkUp && Math.sin(t * 9 + p.link.id) > 0.6);
                }
            });
            setLed(ud.ledSys, Math.sin(t * (ud.configured ? 2 : 6)) > -0.3);
            const pulse = 0.65 + 0.35 * Math.sin(t * (linkUp ? 2 : 5));
            ud.beacon.material.opacity = pulse;
            if (ud.generator) {
                ud.generator.position.y = Math.sin(t * 60) * 0.008;
                ud.generator.rotation.z = Math.sin(t * 47) * 0.003;
            }
            if (ud.batteryLeds) ud.batteryLeds.forEach((b, i) => setLed(b, i < 4 || Math.sin(t * 3) > 0));
        } else {
            if (ud.netFlash > 0) {
                ud.netFlash -= dt;
                setLed(ud.ledNet, Math.sin(t * 40) > 0);
            } else if (ud.ledNet) setLed(ud.ledNet, true);
            // curseur clignotant (redessin à 2 Hz)
            const on = Math.floor(t * 2) % 2 === 0;
            if (on !== ud.cursorOn && node) {
                ud.cursorOn = on;
                drawStationScreen(ud.screen, node, ud.state && ud.state.linkUp, on);
            }
            if (ud.screenLight) ud.screenLight.intensity = 0.45 + Math.sin(t * 13) * 0.03;
        }
    }

    return { buildRouter, buildStation, refresh, animate, flashPort, maskToCidr, looksLikeIp };
})();
