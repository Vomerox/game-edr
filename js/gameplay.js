// ==========================================
// GAME EDR - JOUABILITÉ
// Caméra libre (zoom / rotation / déplacement), plaques d'identification
// des équipements, anneau de sélection, animation des paquets du ping,
// signalement visuel des câbles en défaut, flux de données en cas de succès.
// (Utilise les globales de game.js : scene, camera, nodes3D, levelData, linkLines)
// ==========================================

// ---------- CAMÉRA ----------
const CameraRig = (() => {
    const cur = { yaw: 0, pitch: 0.58, dist: 60, tx: 0, tz: -4 };
    const want = Object.assign({}, cur);
    const LIM = { pitchMin: 0.28, pitchMax: 1.35, distMin: 22, distMax: 115, pan: 55 };

    // Cadrage par défaut : s'adapte à l'emprise du niveau et au format d'écran
    const frameBox = { minX: -40, maxX: 40, minZ: -15, maxZ: 15 };
    function defaultDist() {
        const aspect = window.innerWidth / window.innerHeight;
        const halfH = Math.tan(THREE.MathUtils.degToRad(30));
        const halfW = halfH * aspect;
        const needW = (frameBox.maxX - frameBox.minX) / 2 + 11;
        const needH = (frameBox.maxZ - frameBox.minZ) / 2 + 12;
        return THREE.MathUtils.clamp(Math.max(needW / halfW, needH / (halfH * 0.75)), 34, 95);
    }

    function frame(nodes) {
        if (!nodes || !nodes.length) return;
        frameBox.minX = Math.min(...nodes.map(n => n.pos.x));
        frameBox.maxX = Math.max(...nodes.map(n => n.pos.x));
        frameBox.minZ = Math.min(...nodes.map(n => n.pos.z));
        frameBox.maxZ = Math.max(...nodes.map(n => n.pos.z));
    }

    function reset(immediate) {
        want.yaw = 0; want.pitch = 0.58; want.dist = defaultDist();
        want.tx = (frameBox.minX + frameBox.maxX) / 2;
        want.tz = (frameBox.minZ + frameBox.maxZ) / 2 - 1;
        if (immediate) Object.assign(cur, want);
    }

    // Lent panoramique quand aucune mission n'est en cours (fond des menus)
    function idle(dt) {
        want.yaw += dt * 0.04;
        cur.yaw = want.yaw;
    }

    function intro() {
        if (typeof levelData !== 'undefined' && levelData) frame(levelData.nodes);
        reset(false);
        cur.yaw = -0.9; cur.pitch = 1.2; cur.dist = want.dist * 1.9; cur.tx = 0; cur.tz = -10;
    }

    function apply(cam) {
        const cp = Math.cos(cur.pitch);
        cam.position.set(
            cur.tx + Math.sin(cur.yaw) * cp * cur.dist,
            Math.sin(cur.pitch) * cur.dist,
            cur.tz + Math.cos(cur.yaw) * cp * cur.dist);
        cam.lookAt(cur.tx, 0, cur.tz);
    }

    function update(dt, cam) {
        const k = 1 - Math.exp(-dt * 5.5);
        ['yaw', 'pitch', 'dist', 'tx', 'tz'].forEach(p => { cur[p] += (want[p] - cur[p]) * k; });
        apply(cam);
    }

    function zoom(deltaY) {
        want.dist = THREE.MathUtils.clamp(want.dist * (1 + Math.sign(deltaY) * 0.12), LIM.distMin, LIM.distMax);
    }
    function rotate(dx, dy) {
        want.yaw -= dx * 0.006;
        want.pitch = THREE.MathUtils.clamp(want.pitch + dy * 0.004, LIM.pitchMin, LIM.pitchMax);
    }
    function pan(dx, dy) {
        const s = want.dist * 0.0016;
        const cy = Math.cos(want.yaw), sy = Math.sin(want.yaw);
        want.tx = THREE.MathUtils.clamp(want.tx - (dx * cy + dy * sy) * s, -LIM.pan, LIM.pan);
        want.tz = THREE.MathUtils.clamp(want.tz - (-dx * sy + dy * cy) * s, -LIM.pan, LIM.pan);
    }
    function focus(x, z) {
        want.tx = x; want.tz = z;
        want.dist = Math.min(want.dist, 34);
    }

    reset(true);
    return { reset, intro, update, zoom, rotate, pan, focus, apply, frame, idle };
})();

// ---------- JEU : visuels réactifs ----------
const Gameplay = (() => {
    let plates = {};
    let hoverRing = null, selectRing = null;
    let packets = [];       // paquets animés en cours
    let trails = [];
    let streams = [];       // flux de données après succès
    let flashes = [];       // câbles en défaut qui clignotent
    let pulses = [];        // ondes au sol
    let sparks = [];        // gerbes de particules
    let markers = [];       // sprites flottants (✕ / ✓)

    let glowTex = null;
    function glowTexture() {
        if (glowTex) return glowTex;
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.25, 'rgba(255,255,255,0.8)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
        glowTex = new THREE.CanvasTexture(c);
        return glowTex;
    }

    function aliasOf(id) { return (typeof Missions !== 'undefined') ? Missions.getAlias(id) : id; }

    // ===== Plaques d'identification flottantes =====
    function plateInfo(node) {
        const okIp = s => Equipment.looksLikeIp(s);
        if (node.type === 'pc') {
            const c = node.config;
            const cidr = Equipment.maskToCidr(c.mask);
            const done = okIp(c.ip) && cidr !== null && okIp(c.gw);
            const some = c.ip || c.mask || c.gw;
            return {
                title: aliasOf(node.id),
                line: done ? `${c.ip}/${cidr}  →  gw ${c.gw}` : (some ? 'configuration incomplète' : 'NON CONFIGURÉ'),
                state: done ? 'ok' : (some ? 'partial' : 'none'),
                kind: 'POSTE'
            };
        }
        const total = node.interfaces.length;
        const ok = node.interfaces.filter(i => okIp(i.ip) && Equipment.maskToCidr(i.mask) !== null).length;
        const routes = node.routes.filter(r => r.dest && r.mask && r.gw).length;
        return {
            title: aliasOf(node.id),
            line: `${ok}/${total} interfaces · ${routes} route${routes > 1 ? 's' : ''}`,
            state: ok === total ? 'ok' : (ok > 0 || routes > 0 ? 'partial' : 'none'),
            kind: 'RELAIS'
        };
    }

    function drawPlate(p, info, linkUp) {
        const g = p.ctx, W = p.canvas.width, H = p.canvas.height;
        g.clearRect(0, 0, W, H);
        const colors = { ok: '#5ee07a', partial: '#ffc23a', none: '#ff6a4a' };
        const col = linkUp ? '#5ee07a' : colors[info.state];
        g.fillStyle = 'rgba(14,16,10,0.82)';
        g.beginPath(); g.roundRect(6, 6, W - 12, H - 12, 18); g.fill();
        g.lineWidth = 4; g.strokeStyle = col;
        g.beginPath(); g.roundRect(6, 6, W - 12, H - 12, 18); g.stroke();
        // pastille
        g.fillStyle = col;
        g.beginPath(); g.arc(40, 48, 12, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#9b927a';
        g.font = 'bold 22px "Share Tech Mono", monospace';
        g.textBaseline = 'middle';
        g.fillText(info.kind, 64, 34);
        const fit = (text, x, y, maxW, size, family) => {
            let s = size;
            do { g.font = `bold ${s}px ${family}`; s -= 1; } while (g.measureText(text).width > maxW && s > 12);
            g.fillText(text, x, y);
        };
        g.fillStyle = '#f1e4bf';
        fit(info.title.toUpperCase(), 64, 70, W - 90, 34, '"Black Ops One", "Share Tech Mono", monospace');
        g.fillStyle = col;
        fit(info.line, 24, 108, W - 48, 26, '"Share Tech Mono", monospace');
        // pointe
        g.fillStyle = 'rgba(14,16,10,0.82)';
        g.beginPath(); g.moveTo(W / 2 - 14, H - 8); g.lineTo(W / 2 + 14, H - 8); g.lineTo(W / 2, H); g.fill();
        p.tex.needsUpdate = true;
    }

    function createPlate(node) {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 140;
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
        sprite.scale.set(9.6, 2.63, 1);
        sprite.renderOrder = 20;
        const p = { sprite, canvas, ctx: canvas.getContext('2d'), tex };
        drawPlate(p, plateInfo(node), false);
        return p;
    }

    function buildPlates() {
        Object.values(plates).forEach(p => { if (p.sprite.parent) p.sprite.parent.remove(p.sprite); p.tex.dispose(); });
        plates = {};
        levelData.nodes.forEach(n => {
            const p = createPlate(n);
            p.sprite.position.set(0, n.type === 'router' ? 8.6 : 7.4, 0);
            nodes3D[n.id].add(p.sprite);
            plates[n.id] = p;
        });
    }

    function refreshNode(id, linkUp) {
        const node = levelData && levelData.nodes.find(n => n.id === id);
        if (!node || !nodes3D[id]) return;
        Equipment.refresh(nodes3D[id], node, { linkUp: !!linkUp });
        if (plates[id]) drawPlate(plates[id], plateInfo(node), !!linkUp);
    }

    function refreshAll(linkUp) {
        if (!levelData) return;
        levelData.nodes.forEach(n => refreshNode(n.id, linkUp));
    }

    // ===== Anneaux de survol / sélection =====
    function makeRing(color, opacity) {
        const m = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.7, 48),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.08;
        m.visible = false;
        m.renderOrder = 2;
        scene.add(m);
        return m;
    }

    function setHover(id) {
        if (!hoverRing) hoverRing = makeRing(0xffd27a, 0.55);
        if (id && nodes3D[id]) {
            hoverRing.visible = true;
            hoverRing.position.x = nodes3D[id].position.x;
            hoverRing.position.z = nodes3D[id].position.z;
            hoverRing.userData.id = id;
        } else hoverRing.visible = false;
    }

    function setSelected(id) {
        if (!selectRing) selectRing = makeRing(0x6ff58a, 0.8);
        selectRing.userData.id = id || null;
        selectRing.visible = !!(id && nodes3D[id]);
    }

    // ===== Animation des paquets =====
    function findLink(a, b) {
        for (const l of linkLines) {
            if (l.n1 === a && l.n2 === b) return { l, rev: false };
            if (l.n1 === b && l.n2 === a) return { l, rev: true };
        }
        return null;
    }

    function hopCurve(a, b) {
        const f = findLink(a, b);
        if (f && f.l.curve) {
            if (!f.rev) return { curve: f.l.curve, link: f.l, rev: false };
            const pts = f.l.curve.getPoints(30).reverse();
            return { curve: new THREE.CatmullRomCurve3(pts), link: f.l, rev: true };
        }
        const pa = nodes3D[a].position.clone(); pa.y = 2;
        const pb = nodes3D[b].position.clone(); pb.y = 2;
        const mid = pa.clone().add(pb).multiplyScalar(0.5); mid.y = 6;
        return { curve: new THREE.QuadraticBezierCurve3(pa, mid, pb), link: null };
    }

    function linkIntf(link, nodeId) {
        if (!link) return null;
        const src = levelData.links.find(k => (k.n1 === link.n1 && k.n2 === link.n2));
        if (!src) return null;
        return src.n1 === nodeId ? src.int1 : (src.n2 === nodeId ? src.int2 : null);
    }

    function packetBeep(freq) {
        if (typeof audioCtx === 'undefined') return;
        const now = audioCtx.currentTime;
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(0.035, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(now); o.stop(now + 0.13);
    }

    // trace : liste d'IDs de nœuds traversés. ok : le paquet arrive-t-il ?
    function animatePacket(trace, ok, color) {
        return new Promise(resolve => {
            const hops = [];
            const path = trace.slice(0, 14);
            for (let i = 0; i < path.length - 1; i++) {
                if (!nodes3D[path[i]] || !nodes3D[path[i + 1]]) continue;
                hops.push(Object.assign({ from: path[i], to: path[i + 1] }, hopCurve(path[i], path[i + 1])));
            }
            const head = new THREE.Group();
            const core = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            head.add(core);
            const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
            glow.scale.set(4.6, 4.6, 1);
            head.add(glow);
            scene.add(head);
            const startNode = path[0];
            if (nodes3D[startNode]) {
                pulse(nodes3D[startNode].position, color);
                Equipment.flashPort(nodes3D[startNode], null);
            }
            if (!hops.length) {
                scene.remove(head);
                if (!ok && nodes3D[startNode]) failBurst(nodes3D[startNode].position);
                setTimeout(resolve, ok ? 100 : 700);
                return;
            }
            packets.push({ head, glow, hops, i: 0, t: 0, ok, color, resolve, trailT: 0 });
        });
    }

    function pulse(pos, color) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.0, 40),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(pos.x, 0.12, pos.z);
        scene.add(m);
        pulses.push({ m, life: 0.9 });
    }

    function burst(pos, color, n, speed) {
        const geo = new THREE.BufferGeometry();
        const arr = new Float32Array(n * 3);
        const vel = [];
        for (let i = 0; i < n; i++) {
            arr[i * 3] = pos.x; arr[i * 3 + 1] = pos.y; arr[i * 3 + 2] = pos.z;
            const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.5;
            const s = speed * (0.5 + Math.random() * 0.7);
            vel.push(new THREE.Vector3(Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + speed * 0.4, Math.sin(a) * Math.cos(e) * s));
        }
        geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.7, map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        scene.add(pts);
        sparks.push({ pts, vel, life: 1.4, max: 1.4 });
    }

    function marker(pos, text, color) {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = color; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
        g.lineWidth = 8; g.strokeStyle = '#fff'; g.stroke();
        g.fillStyle = '#fff'; g.font = 'bold 72px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(text, 64, 70);
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
        s.renderOrder = 30;
        s.scale.set(2.6, 2.6, 1);
        s.position.set(pos.x, 10.5, pos.z);
        scene.add(s);
        markers.push({ s, life: 2.2, y0: 10.5 });
    }

    function failBurst(pos) {
        const p = pos.clone(); p.y = 3;
        burst(p, 0xff4a2a, 60, 7);
        pulse(pos, 0xff3a2a);
        marker(pos, '✕', '#c42a1a');
    }

    function successBurst(pos) {
        const p = pos.clone(); p.y = 3;
        burst(p, 0x6aff8a, 50, 6);
        pulse(pos, 0x6aff8a);
        marker(pos, '✓', '#2a9a44');
    }

    // ===== Câbles en défaut (clignotement rouge) =====
    function flashLinks(badPairs) {
        badPairs.forEach(([a, b]) => {
            const f = findLink(a, b);
            if (f) flashes.push({ l: f.l, life: 3.0, base: f.l.tubeMat.color.getHex() });
        });
    }

    // ===== Flux de données continu (liaison opérationnelle) =====
    function startStreams() {
        stopStreams();
        linkLines.forEach(l => {
            if (!l.curve) return;
            for (let k = 0; k < 3; k++) {
                const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: k % 2 ? 0x9affb0 : 0x3aff6a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
                s.scale.set(1.3, 1.3, 1);
                scene.add(s);
                streams.push({ s, curve: l.curve, t: k / 3, dir: k % 2 ? -1 : 1 });
            }
        });
    }
    function stopStreams() {
        streams.forEach(st => scene.remove(st.s));
        streams = [];
    }

    function celebrate() {
        levelData.nodes.forEach((n, i) => {
            setTimeout(() => successBurst(nodes3D[n.id].position), i * 180);
        });
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const p = new THREE.Vector3((Math.random() - 0.5) * 50, 16 + Math.random() * 8, (Math.random() - 0.5) * 20);
                burst(p, [0xffd24a, 0x6aff8a, 0x5ab4ff, 0xff7a4a][i % 4], 90, 9);
            }, 300 + i * 260);
        }
    }

    function reset() {
        packets.forEach(p => { scene.remove(p.head); p.resolve(); });
        packets = [];
        trails.forEach(t => scene.remove(t.m)); trails = [];
        pulses.forEach(p => scene.remove(p.m)); pulses = [];
        sparks.forEach(s => scene.remove(s.pts)); sparks = [];
        markers.forEach(m => scene.remove(m.s)); markers = [];
        flashes = [];
        stopStreams();
        setHover(null);
        setSelected(null);
    }

    // ===== Boucle =====
    const tmp = new THREE.Vector3();
    function update(dt, t) {
        // anneaux
        if (hoverRing && hoverRing.visible && nodes3D[hoverRing.userData.id]) {
            const p = nodes3D[hoverRing.userData.id].position;
            hoverRing.position.set(p.x, 0.08, p.z);
            hoverRing.rotation.z += dt * 0.6;
        }
        if (selectRing && selectRing.visible && nodes3D[selectRing.userData.id]) {
            const p = nodes3D[selectRing.userData.id].position;
            selectRing.position.set(p.x, 0.1, p.z);
            const s = 1 + Math.sin(t * 4) * 0.05;
            selectRing.scale.set(s, s, s);
            selectRing.material.opacity = 0.55 + Math.sin(t * 4) * 0.25;
        }
        // flottement des plaques
        Object.entries(plates).forEach(([id, p], i) => {
            const base = nodes3D[id] && nodes3D[id].userData.type === 'router' ? 8.6 : 7.4;
            p.sprite.position.y = base + Math.sin(t * 1.6 + i) * 0.15;
        });

        // paquets
        for (let k = packets.length - 1; k >= 0; k--) {
            const pk = packets[k];
            const hop = pk.hops[pk.i];
            const len = hop.curve.getLength();
            pk.t += dt * (22 / Math.max(len, 6));
            const tt = Math.min(1, pk.t);
            hop.curve.getPoint(tt, tmp);
            pk.head.position.copy(tmp);
            pk.head.position.y += 0.35;
            pk.glow.scale.setScalar(4.2 + Math.sin(t * 20) * 0.6);
            pk.trailT -= dt;
            if (pk.trailT <= 0) {
                pk.trailT = 0.025;
                const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: pk.color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
                m.position.copy(pk.head.position);
                m.scale.set(1.9, 1.9, 1);
                scene.add(m);
                trails.push({ m, life: 0.45 });
            }
            if (tt >= 1) {
                const nodeTo = nodes3D[hop.to];
                if (nodeTo) {
                    pulse(nodeTo.position, pk.color);
                    Equipment.flashPort(nodeTo, linkIntf(hop.link, hop.to));
                }
                packetBeep(660 + pk.i * 90);
                pk.i++;
                pk.t = 0;
                if (pk.i < pk.hops.length) {
                    const nf = nodes3D[pk.hops[pk.i].from];
                    if (nf) Equipment.flashPort(nf, linkIntf(pk.hops[pk.i].link, pk.hops[pk.i].from));
                }
                if (pk.i >= pk.hops.length) {
                    scene.remove(pk.head);
                    const last = nodes3D[hop.to];
                    if (!pk.ok && last) failBurst(last.position);
                    packets.splice(k, 1);
                    setTimeout(pk.resolve, pk.ok ? 150 : 650);
                }
            }
        }
        for (let k = trails.length - 1; k >= 0; k--) {
            const tr = trails[k];
            tr.life -= dt;
            tr.m.material.opacity = Math.max(0, tr.life / 0.45 * 0.7);
            tr.m.scale.setScalar(0.4 + tr.life * 2.2);
            if (tr.life <= 0) { scene.remove(tr.m); tr.m.material.dispose(); trails.splice(k, 1); }
        }
        for (let k = pulses.length - 1; k >= 0; k--) {
            const p = pulses[k];
            p.life -= dt;
            const s = 1 + (0.9 - p.life) * 7;
            p.m.scale.set(s, s, s);
            p.m.material.opacity = Math.max(0, p.life / 0.9);
            if (p.life <= 0) { scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); pulses.splice(k, 1); }
        }
        for (let k = sparks.length - 1; k >= 0; k--) {
            const s = sparks[k];
            s.life -= dt;
            const arr = s.pts.geometry.attributes.position.array;
            s.vel.forEach((v, i) => {
                v.y -= 9.8 * dt * 0.8;
                arr[i * 3] += v.x * dt; arr[i * 3 + 1] += v.y * dt; arr[i * 3 + 2] += v.z * dt;
            });
            s.pts.geometry.attributes.position.needsUpdate = true;
            s.pts.material.opacity = Math.max(0, s.life / s.max);
            if (s.life <= 0) { scene.remove(s.pts); s.pts.geometry.dispose(); s.pts.material.dispose(); sparks.splice(k, 1); }
        }
        for (let k = markers.length - 1; k >= 0; k--) {
            const m = markers[k];
            m.life -= dt;
            m.s.position.y = m.y0 + (2.2 - m.life) * 0.8;
            m.s.material.opacity = Math.min(1, m.life * 1.5);
            if (m.life <= 0) { scene.remove(m.s); markers.splice(k, 1); }
        }
        for (let k = flashes.length - 1; k >= 0; k--) {
            const f = flashes[k];
            f.life -= dt;
            const on = Math.sin(t * 14) > 0;
            f.l.tubeMat.color.setHex(on ? 0xff2a1a : f.base);
            f.l.tubeMat.emissive = new THREE.Color(on ? 0x550000 : 0x000000);
            if (f.life <= 0) {
                f.l.tubeMat.color.setHex(f.base);
                f.l.tubeMat.emissive = new THREE.Color(0x000000);
                flashes.splice(k, 1);
            }
        }
        streams.forEach(st => {
            st.t += dt * 0.45 * st.dir;
            if (st.t > 1) st.t -= 1;
            if (st.t < 0) st.t += 1;
            st.curve.getPoint(st.t, tmp);
            st.s.position.set(tmp.x, tmp.y + 0.3, tmp.z);
        });
    }

    return {
        buildPlates, refreshNode, refreshAll, setHover, setSelected,
        animatePacket, flashLinks, startStreams, stopStreams, celebrate, reset, update,
        failBurst, successBurst
    };
})();
