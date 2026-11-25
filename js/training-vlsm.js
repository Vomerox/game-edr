// ==========================================
// GAME EDR - MODE VLSM
// ==========================================

const TrainingVLSM = (() => {

    // --- Configuration ---
    const QUESTIONS_PER_LEVEL = 5;
    const TIMER_PER_LEVEL = { 1: 180, 2: 240, 3: 300, 4: 360 };
    const NAMES = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF'];
    const LABELS = [
        'Unité principale', 'Poste de commandement', 'Base logistique',
        'Liaison sécurisée', 'Centre opérations', 'Avant-poste', 'Réserve'
    ];

    const LEVEL_CONFIGS = {
        1: {
            baseCidrs: [22, 23, 24],
            subnetCount: 4,
            hostRanges: [[50, 80], [20, 40], [5, 15], [2, 5]],
            label: 'FACILE'
        },
        2: {
            baseCidrs: [20, 21, 22],
            subnetCount: 5,
            hostRanges: [[100, 200], [50, 80], [20, 40], [5, 15], [2, 5]],
            label: 'MOYEN'
        },
        3: {
            baseCidrs: [18, 19, 20],
            subnetCount: 6,
            hostRanges: [[200, 500], [100, 200], [50, 80], [20, 40], [5, 15], [2, 5]],
            label: 'DIFFICILE'
        },
        4: {
            baseCidrs: [16, 17, 18],
            subnetCount: 7,
            hostRanges: [[500, 1000], [200, 500], [100, 200], [50, 80], [20, 40], [5, 15], [2, 5]],
            label: 'EXPERT'
        }
    };

    // --- State ---
    let currentLevel = 1;
    let currentQuestionIndex = 0;
    let totalScore = 0;
    let currentQuestion = null;
    let timerInterval = null;
    let timeLeft = 0;
    let questionStartTime = 0;

    const PREFIX = 'training-vlsm';

    // --- Génération ---
    function generateAlignedNetwork(cidr) {
        const ranges = [[10, 0], [172, 16], [192, 168], [10, 10], [172, 20]];
        const r = ranges[Math.floor(Math.random() * ranges.length)];
        const blockSize = 1 << (32 - cidr);

        let o3 = 0;
        if (cidr <= 16) {
            o3 = 0;
        } else if (cidr <= 24) {
            const step = blockSize >> 8;
            const maxBlocks = Math.floor(256 / Math.max(step, 1));
            o3 = Math.floor(Math.random() * maxBlocks) * Math.max(step, 1);
        } else {
            const step4 = blockSize;
            const maxBlocks4 = Math.floor(256 / step4);
            o3 = Math.floor(Math.random() * 256);
        }

        return `${r[0]}.${r[1]}.${o3}.0`;
    }

    function generateQuestion(level) {
        const config = LEVEL_CONFIGS[level];
        const baseCidr = config.baseCidrs[Math.floor(Math.random() * config.baseCidrs.length)];

        // Générer les besoins en hôtes (nombres de machines tous différents)
        const subnets = [];
        for (let i = 0; i < config.subnetCount; i++) {
            const range = config.hostRanges[i];
            const hosts = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
            const reqCidr = IPUtils.cidrForHosts(hosts);
            const minSize = 1 << (32 - reqCidr);

            subnets.push({
                hosts: hosts,
                requiredCidr: reqCidr,
                minSize: minSize
            });
        }
        if (new Set(subnets.map(x => x.hosts)).size !== subnets.length) return generateQuestion(level);

        // Vérifier que tout rentre dans le réseau de base
        const totalNeeded = subnets.reduce((sum, s) => sum + s.minSize, 0);
        const available = 1 << (32 - baseCidr);
        if (totalNeeded > available) return generateQuestion(level);

        // Affichage dans un ordre quelconque (pas forcément trié) : on mélange,
        // puis on nomme les réseaux selon leur position à l'écran.
        for (let i = subnets.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [subnets[i], subnets[j]] = [subnets[j], subnets[i]];
        }
        subnets.forEach((sub, i) => { sub.name = NAMES[i]; sub.label = LABELS[i]; });

        // Générer le réseau de base aligné
        const baseIP = generateAlignedNetwork(baseCidr);
        const baseNum = IPUtils.ipToNumber(baseIP);

        // Réponse de référence : calculs dans l'ordre DÉCROISSANT du nombre de machines
        // (plus grand réseau en premier, à partir de l'adresse du réseau attribué)
        const allocationOrder = [...subnets].sort((a, b) => b.hosts - a.hosts);
        let offset = 0;
        const sampleAnswer = allocationOrder.map(s => {
            const addr = IPUtils.numberToIP((baseNum + offset) >>> 0);
            const result = { name: s.name, hosts: s.hosts, network: `${addr}/${s.requiredCidr}` };
            s.expected = result.network;
            offset += s.minSize;
            return result;
        });

        return {
            network: baseIP,
            cidr: baseCidr,
            subnets: subnets,
            sampleAnswer: sampleAnswer
        };
    }

    // --- Rendu ---
    function renderQuestion(q) {
        let subnetList = q.subnets.map(s =>
            `<div class="vlsm-requirement">
                <span class="vlsm-name">${s.name}</span>
                <span class="vlsm-label">${s.label}</span>
                <span class="vlsm-hosts">${s.hosts} machines</span>
            </div>`
        ).join('');

        return `
            <div class="bonus-prompt">
                <span class="brief-label">RÉSEAU ATTRIBUÉ :</span>
                <div class="bonus-ip-display">${q.network} / ${q.cidr}</div>
                <div class="bonus-mask-info">Masque : ${IPUtils.cidrToMaskString(q.cidr)} — ${(1 << (32 - q.cidr))} adresses disponibles</div>
            </div>
            <div class="bonus-instruction">
                Créez ${q.subnets.length} sous-réseaux optimisés (VLSM) pour accueillir :
            </div>
            <div class="vlsm-requirements">
                ${subnetList}
            </div>
            <div class="bonus-instruction" style="font-size:0.8em;color:#b9a878;margin-top:8px;">
                ⚠ Les besoins ne sont pas listés par taille. Faites les calculs dans l'ordre
                <strong>décroissant du nombre de machines</strong> : le plus grand réseau en premier
                (à partir de ${q.network}), puis le deuxième plus grand, etc.
                Indiquez adresse réseau/masque CIDR.
            </div>
        `;
    }

    function renderInputs(q) {
        let html = '';
        for (let i = 0; i < q.subnets.length; i++) {
            const s = q.subnets[i];
            html += `
                <div class="bonus-input-group">
                    <label class="bonus-input-label">${s.name} (${s.hosts} machines) :</label>
                    <input type="text" id="tv-answer-${i}" class="bonus-input"
                           placeholder="ex: 192.168.0.0/25" autocomplete="off">
                </div>
            `;
        }
        return html;
    }

    // --- Validation ---
    function validate() {
        const subnets = currentQuestion.subnets;
        let errors = 0;
        let feedback = [];
        const parsed = [];

        // Phase 1 : vérifier chaque sous-réseau individuellement
        for (let i = 0; i < subnets.length; i++) {
            const val = document.getElementById(`tv-answer-${i}`).value.trim();
            const s = subnets[i];

            if (!val) {
                errors++;
                feedback.push(`<strong>${s.name} :</strong> champ vide.`);
                parsed.push(null);
                continue;
            }

            const parts = val.split('/');
            if (parts.length !== 2) {
                errors++;
                feedback.push(`<strong>${s.name} :</strong> format invalide. Utilisez adresse/CIDR.`);
                parsed.push(null);
                continue;
            }

            const ipStr = parts[0].trim();
            const cidrStr = parseInt(parts[1].trim(), 10);

            if (!IPUtils.isValidIP(ipStr)) {
                errors++;
                feedback.push(`<strong>${s.name} :</strong> adresse IP invalide (<code>${ipStr}</code>).`);
                parsed.push(null);
                continue;
            }

            if (isNaN(cidrStr) || cidrStr < 0 || cidrStr > 32) {
                errors++;
                feedback.push(`<strong>${s.name} :</strong> masque CIDR invalide (<code>/${parts[1]}</code>).`);
                parsed.push(null);
                continue;
            }

            // Vérifier que c'est une adresse réseau valide
            const ipNum = IPUtils.ipToNumber(ipStr);
            const mask = IPUtils.cidrToMask(cidrStr);
            const netAddr = (ipNum & mask) >>> 0;

            if (ipNum !== netAddr) {
                errors++;
                const correctNet = IPUtils.numberToIP(netAddr);
                feedback.push(
                    `<strong>${s.name} :</strong> <code>${ipStr}</code> n'est pas une adresse réseau valide pour /${cidrStr}. ` +
                    `L'adresse réseau serait <code>${correctNet}</code>.`
                );
                parsed.push(null);
                continue;
            }

            // Vérifier que le sous-réseau est dans le réseau parent
            const parentNum = IPUtils.ipToNumber(currentQuestion.network);
            const parentMask = IPUtils.cidrToMask(currentQuestion.cidr);
            const parentEnd = (parentNum + (1 << (32 - currentQuestion.cidr)) - 1) >>> 0;
            const subnetEnd = (netAddr + (1 << (32 - cidrStr)) - 1) >>> 0;

            if (netAddr < parentNum || subnetEnd > parentEnd) {
                errors++;
                feedback.push(
                    `<strong>${s.name} :</strong> le sous-réseau <code>${val}</code> dépasse les limites ` +
                    `du réseau parent <code>${currentQuestion.network}/${currentQuestion.cidr}</code>.`
                );
                parsed.push(null);
                continue;
            }

            // Vérifier le nombre d'hôtes suffisant
            const hostCapacity = IPUtils.hostCount(cidrStr);
            if (hostCapacity < s.hosts) {
                errors++;
                feedback.push(
                    `<strong>${s.name} :</strong> /${cidrStr} offre ${hostCapacity} hôtes, ` +
                    `insuffisant pour ${s.hosts} machines. ` +
                    `CIDR optimal : /${s.requiredCidr} (${IPUtils.hostCount(s.requiredCidr)} hôtes).`
                );
                parsed.push(null);
                continue;
            }

            // Vérifier le masque optimal
            if (cidrStr !== s.requiredCidr) {
                errors++;
                feedback.push(
                    `<strong>${s.name} :</strong> masque non optimal. /${cidrStr} offre ${hostCapacity} hôtes ` +
                    `pour ${s.hosts} machines demandées. Le masque optimal est /${s.requiredCidr} ` +
                    `(${IPUtils.hostCount(s.requiredCidr)} hôtes). ` +
                    `Formule : il faut au minimum 2<sup>n</sup> - 2 >= ${s.hosts}, ` +
                    `donc n = ${32 - s.requiredCidr} bits hôte → CIDR = /${s.requiredCidr}.`
                );
                parsed.push(null);
                continue;
            }

            parsed.push({
                name: s.name,
                start: netAddr,
                end: subnetEnd,
                cidr: cidrStr,
                value: `${IPUtils.numberToIP(netAddr)}/${cidrStr}`,
                expected: s.expected,
                hosts: s.hosts
            });
        }

        // Phase 2 : vérifier les chevauchements
        const validParsed = parsed.filter(p => p !== null);
        validParsed.sort((a, b) => a.start - b.start);

        for (let i = 0; i < validParsed.length - 1; i++) {
            if (validParsed[i].end >= validParsed[i + 1].start) {
                errors++;
                feedback.push(
                    `<strong>Chevauchement détecté :</strong> ${validParsed[i].name} ` +
                    `(fin: <code>${IPUtils.numberToIP(validParsed[i].end)}</code>) chevauche ` +
                    `${validParsed[i + 1].name} (début: <code>${IPUtils.numberToIP(validParsed[i + 1].start)}</code>). ` +
                    `En VLSM, les sous-réseaux doivent être alloués séquentiellement sans chevauchement.`
                );
            }
        }

        // Phase 3 : vérifier l'ordre d'allocation (nombre de machines décroissant)
        const orderStr = currentQuestion.sampleAnswer.map(a => `${a.name} (${a.hosts})`).join(' → ');
        validParsed.forEach(p => {
            if (p.value !== p.expected) {
                errors++;
                feedback.push(
                    `<strong>${p.name} :</strong> <code>${p.value}</code> est valide mais ne respecte pas l'ordre de calcul. ` +
                    `Adresse attendue : <code>${p.expected}</code>.`
                );
            }
        });

        // Si erreurs, montrer la réponse attendue
        if (errors > 0) {
            const answerStr = currentQuestion.sampleAnswer
                .map(a => `${a.name} (${a.hosts} machines) : <code>${a.network}</code>`)
                .join('<br>');
            feedback.push(`<strong>Réponse attendue (dans l'ordre de calcul) :</strong><br>${answerStr}`);
            feedback.push(
                `<strong>Méthode VLSM :</strong> classer les réseaux par nombre de machines décroissant ` +
                `(${orderStr}), puis allouer séquentiellement en commençant par l'adresse du réseau attribué ` +
                `<code>${currentQuestion.network}/${currentQuestion.cidr}</code>.`
            );
        }

        return { errors, feedback, allCorrect: errors === 0 };
    }

    // --- Scoring ---
    function calculateScore(errors, elapsedSeconds) {
        let base = 0;
        if (errors === 0) base = 100;
        else if (errors === 1) base = 60;
        else if (errors === 2) base = 30;
        else base = 0;

        // Le bonus de vitesse ne récompense qu'une réponse entièrement juste
        if (errors > 0) return base;
        const maxTime = TIMER_PER_LEVEL[currentLevel];
        const speedBonus = Math.max(0, Math.round(50 * (1 - elapsedSeconds / maxTime)));
        return base + speedBonus;
    }

    // --- Timer ---
    function startTimer(seconds) {
        timeLeft = seconds;
        updateTimerDisplay();
        const timerEl = document.getElementById(`${PREFIX}-timer`);
        timerEl.classList.remove('danger');

        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 10) timerEl.classList.add('danger');
            if (timeLeft <= 0) {
                stopTimer();
                onTimeout();
            }
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        return Math.max(0, timeLeft);
    }

    function updateTimerDisplay() {
        const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        document.getElementById(`${PREFIX}-timer`).textContent = `${m}:${s}`;
    }

    function onTimeout() {
        const feedbackEl = document.getElementById(`${PREFIX}-feedback`);
        const answerStr = currentQuestion.sampleAnswer
            .map(a => `${a.name} (${a.hosts} machines) : <code>${a.network}</code>`)
            .join('<br>');

        feedbackEl.innerHTML = `<strong>TEMPS ÉCOULÉ !</strong><br>${answerStr}`;
        feedbackEl.className = 'bonus-feedback timeout';

        document.querySelectorAll(`#${PREFIX}-inputs input`).forEach(el => el.disabled = true);

        const btn = document.getElementById('btn-validate-vlsm');
        btn.textContent = 'SUIVANT';
        btn.onclick = () => {
            btn.textContent = 'VALIDER';
            btn.onclick = onValidate;
            nextQuestion();
        };
    }

    // --- Flux ---
    function start() {
        showLevelPicker();
    }

    function showLevelPicker() {
        const overlay = document.getElementById(`${PREFIX}-overlay`);
        const questionEl = document.getElementById(`${PREFIX}-question`);
        const inputsEl = document.getElementById(`${PREFIX}-inputs`);
        const feedbackEl = document.getElementById(`${PREFIX}-feedback`);
        const timerEl = document.getElementById(`${PREFIX}-timer`);

        feedbackEl.classList.add('hidden');
        timerEl.textContent = '--:--';
        document.getElementById(`${PREFIX}-level`).textContent = '';
        document.getElementById(`${PREFIX}-progress`).textContent = '';
        document.getElementById(`${PREFIX}-score-display`).textContent = '';

        questionEl.innerHTML = `
            <div class="bonus-prompt" style="text-align:center">
                <div class="brief-name" style="font-size:1.2em;margin-bottom:10px;">VLSM</div>
                <div class="bonus-instruction">Sélectionnez le niveau de difficulté :</div>
            </div>
        `;

        inputsEl.innerHTML = `
            <div class="training-level-grid">
                <button class="training-level-pick-btn" data-level="1">
                    <span class="tlp-title">NIVEAU 1 — FACILE</span>
                    <span class="tlp-desc">4 sous-réseaux, réseaux /22 à /24</span>
                </button>
                <button class="training-level-pick-btn" data-level="2">
                    <span class="tlp-title">NIVEAU 2 — MOYEN</span>
                    <span class="tlp-desc">5 sous-réseaux, réseaux /20 à /22</span>
                </button>
                <button class="training-level-pick-btn" data-level="3">
                    <span class="tlp-title">NIVEAU 3 — DIFFICILE</span>
                    <span class="tlp-desc">6 sous-réseaux, réseaux /18 à /20</span>
                </button>
                <button class="training-level-pick-btn" data-level="4">
                    <span class="tlp-title">NIVEAU 4 — EXPERT</span>
                    <span class="tlp-desc">7 sous-réseaux, réseaux /16 à /18</span>
                </button>
            </div>
        `;

        document.getElementById('btn-validate-vlsm').style.display = 'none';
        overlay.classList.remove('hidden');

        inputsEl.querySelectorAll('.training-level-pick-btn').forEach(btn => {
            btn.onclick = () => {
                currentLevel = parseInt(btn.dataset.level);
                currentQuestionIndex = 0;
                totalScore = 0;
                document.getElementById('btn-validate-vlsm').style.display = '';
                document.getElementById('btn-validate-vlsm').textContent = 'VALIDER';
                document.getElementById('btn-validate-vlsm').onclick = onValidate;
                nextQuestion();
            };
        });
    }

    function nextQuestion() {
        if (currentQuestionIndex >= QUESTIONS_PER_LEVEL) {
            showResults();
            return;
        }

        currentQuestion = generateQuestion(currentLevel);
        currentQuestionIndex++;
        questionStartTime = Date.now();

        const levelLabel = LEVEL_CONFIGS[currentLevel].label;
        document.getElementById(`${PREFIX}-level`).textContent = `NIVEAU ${currentLevel} — ${levelLabel}`;
        document.getElementById(`${PREFIX}-progress`).textContent = `Question ${currentQuestionIndex}/${QUESTIONS_PER_LEVEL}`;
        document.getElementById(`${PREFIX}-score-display`).textContent = `Score: ${totalScore}`;

        document.getElementById(`${PREFIX}-question`).innerHTML = renderQuestion(currentQuestion);
        document.getElementById(`${PREFIX}-inputs`).innerHTML = renderInputs(currentQuestion);
        document.getElementById(`${PREFIX}-feedback`).classList.add('hidden');

        startTimer(TIMER_PER_LEVEL[currentLevel]);

        setTimeout(() => {
            const first = document.getElementById('tv-answer-0');
            if (first) first.focus();
        }, 200);
    }

    function onValidate() {
        const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
        stopTimer();

        const result = validate();
        const points = calculateScore(result.errors, elapsed);
        totalScore += points;

        const feedbackEl = document.getElementById(`${PREFIX}-feedback`);
        if (result.allCorrect) {
            feedbackEl.innerHTML = `<strong>Parfait ! +${points} points</strong>`;
            feedbackEl.className = 'bonus-feedback success';
        } else {
            feedbackEl.innerHTML =
                `<strong>${result.errors} erreur(s) — +${points} points</strong><br>` +
                result.feedback.map(f => `<div style="margin-top:8px">${f}</div>`).join('');
            feedbackEl.className = 'bonus-feedback failure';
        }

        document.querySelectorAll(`#${PREFIX}-inputs input`).forEach(el => el.disabled = true);
        document.getElementById(`${PREFIX}-score-display`).textContent = `Score: ${totalScore}`;

        const btn = document.getElementById('btn-validate-vlsm');
        btn.textContent = 'SUIVANT';
        btn.onclick = () => {
            btn.textContent = 'VALIDER';
            btn.onclick = onValidate;
            nextQuestion();
        };
    }

    function showResults() {
        stopTimer();
        const questionEl = document.getElementById(`${PREFIX}-question`);
        const inputsEl = document.getElementById(`${PREFIX}-inputs`);
        const feedbackEl = document.getElementById(`${PREFIX}-feedback`);

        feedbackEl.classList.add('hidden');
        document.getElementById(`${PREFIX}-timer`).textContent = '--:--';
        document.getElementById(`${PREFIX}-progress`).textContent = 'TERMINÉ';

        const max = QUESTIONS_PER_LEVEL * 150;
        const pct = totalScore / max;
        let mention = 'INSUFFISANT';
        if (pct >= 0.9) mention = 'EXCELLENCE';
        else if (pct >= 0.7) mention = 'TRÈS BIEN';
        else if (pct >= 0.5) mention = 'BIEN';
        else if (pct >= 0.3) mention = 'PASSABLE';

        questionEl.innerHTML = `
            <div style="text-align:center">
                <div class="brief-name" style="font-size:1.2em;margin-bottom:10px;">ENTRAÎNEMENT TERMINÉ</div>
                <div class="training-result-mention">${mention}</div>
                <div class="bonus-ip-display">${totalScore} POINTS</div>
                <div style="margin-top:10px;color:#8b7355;font-size:0.85em;">
                    sur ${max} points possibles
                </div>
            </div>
        `;
        inputsEl.innerHTML = '';

        const btn = document.getElementById('btn-validate-vlsm');
        btn.textContent = 'REJOUER';
        btn.style.display = '';
        btn.onclick = () => { showLevelPicker(); };
    }

    function cleanup() {
        stopTimer();
        document.getElementById(`${PREFIX}-overlay`).classList.add('hidden');
    }

    // --- Init event listeners (quit uniquement, validate géré dynamiquement) ---
    document.getElementById('btn-quit-vlsm').addEventListener('click', () => {
        cleanup();
        if (typeof showMainMenu === 'function') showMainMenu();
    });

    return { start, cleanup };
})();
