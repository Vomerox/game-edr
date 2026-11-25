// ==========================================
// GAME EDR - MODE CALCUL ADRESSE RÉSEAU
// ==========================================

const TrainingNetwork = (() => {

    // --- Configuration ---
    const QUESTIONS_PER_LEVEL = 5;
    const TIMER_PER_LEVEL = { 1: 120, 2: 150, 3: 180, 4: 210 };
    const LEVEL_CONFIGS = {
        1: { cidrs: [8, 16, 24], label: 'FACILE' },
        2: { cidrs: [20, 22, 26], label: 'MOYEN' },
        3: { cidrs: [19, 21, 27, 29], label: 'DIFFICILE' },
        4: { cidrs: null, label: 'EXPERT' }
    };

    // --- State ---
    let currentLevel = 1;
    let currentQuestionIndex = 0;
    let totalScore = 0;
    let currentQuestion = null;
    let timerInterval = null;
    let timeLeft = 0;
    let questionStartTime = 0;

    // --- Préfixes d'overlay ---
    const PREFIX = 'training-network';

    // --- Génération de question ---
    function generateQuestion(level) {
        const config = LEVEL_CONFIGS[level];
        let cidr;

        if (config.cidrs) {
            cidr = config.cidrs[Math.floor(Math.random() * config.cidrs.length)];
        } else {
            cidr = 8 + Math.floor(Math.random() * 23); // 8 à 30
        }

        const ranges = [[10, 0], [172, 16], [192, 168], [172, 20], [10, 10]];
        const r = ranges[Math.floor(Math.random() * ranges.length)];

        let ip, ipNum, netNum, bcastNum, mask;
        do {
            const o3 = Math.floor(Math.random() * 256);
            const o4 = Math.floor(Math.random() * 254) + 1;
            ip = `${r[0]}.${r[1]}.${o3}.${o4}`;
            mask = IPUtils.cidrToMask(cidr);
            ipNum = IPUtils.ipToNumber(ip);
            netNum = (ipNum & mask) >>> 0;
            bcastNum = (netNum | (~mask >>> 0)) >>> 0;
        } while (ipNum === netNum || ipNum === bcastNum);

        return {
            ip: ip,
            cidr: cidr,
            maskStr: IPUtils.cidrToMaskString(cidr),
            answers: {
                network: IPUtils.numberToIP(netNum),
                broadcast: IPUtils.numberToIP(bcastNum),
                firstUsable: IPUtils.numberToIP((netNum + 1) >>> 0),
                lastUsable: IPUtils.numberToIP((bcastNum - 1) >>> 0),
                hosts: IPUtils.hostCount(cidr)
            }
        };
    }

    // --- Rendu question ---
    function renderQuestion(q) {
        return `
            <div class="bonus-prompt">
                <span class="brief-label">ADRESSE INTERCEPTÉE :</span>
                <div class="bonus-ip-display">${q.ip} / ${q.cidr}</div>
                <div class="bonus-mask-info">Masque : ${q.maskStr}</div>
            </div>
            <div class="bonus-instruction">Calculez les informations suivantes :</div>
        `;
    }

    function renderInputs() {
        return `
            <div class="bonus-input-group">
                <label class="bonus-input-label">Adresse réseau :</label>
                <input type="text" id="tn-answer-network" class="bonus-input" placeholder="ex: 192.168.0.0" autocomplete="off">
            </div>
            <div class="bonus-input-group">
                <label class="bonus-input-label">Adresse de broadcast :</label>
                <input type="text" id="tn-answer-broadcast" class="bonus-input" placeholder="ex: 192.168.0.255" autocomplete="off">
            </div>
            <div class="bonus-input-group">
                <label class="bonus-input-label">Première adresse utilisable :</label>
                <input type="text" id="tn-answer-first" class="bonus-input" placeholder="ex: 192.168.0.1" autocomplete="off">
            </div>
            <div class="bonus-input-group">
                <label class="bonus-input-label">Dernière adresse utilisable :</label>
                <input type="text" id="tn-answer-last" class="bonus-input" placeholder="ex: 192.168.0.254" autocomplete="off">
            </div>
            <div class="bonus-input-group">
                <label class="bonus-input-label">Nombre d'hôtes utilisables :</label>
                <input type="text" id="tn-answer-hosts" class="bonus-input" placeholder="ex: 254" autocomplete="off">
            </div>
        `;
    }

    // --- Validation avec feedback pédagogique ---
    function validate() {
        const answers = {
            network: document.getElementById('tn-answer-network').value.trim(),
            broadcast: document.getElementById('tn-answer-broadcast').value.trim(),
            firstUsable: document.getElementById('tn-answer-first').value.trim(),
            lastUsable: document.getElementById('tn-answer-last').value.trim(),
            hosts: document.getElementById('tn-answer-hosts').value.trim()
        };

        const correct = currentQuestion.answers;
        let errors = 0;
        let feedback = [];

        if (answers.network !== correct.network) {
            errors++;
            const mask = currentQuestion.maskStr;
            feedback.push(
                `<strong>Adresse réseau incorrecte.</strong> Attendu : <code>${correct.network}</code><br>` +
                `Méthode : effectuer un AND binaire entre chaque octet de <code>${currentQuestion.ip}</code> ` +
                `et du masque <code>${mask}</code> (/${currentQuestion.cidr} = ${currentQuestion.cidr} bits à 1).`
            );
        }

        if (answers.broadcast !== correct.broadcast) {
            errors++;
            const hostBits = 32 - currentQuestion.cidr;
            feedback.push(
                `<strong>Adresse de broadcast incorrecte.</strong> Attendu : <code>${correct.broadcast}</code><br>` +
                `Méthode : prendre l'adresse réseau (<code>${correct.network}</code>) et mettre ` +
                `les ${hostBits} bits d'hôte à 1.`
            );
        }

        if (answers.firstUsable !== correct.firstUsable) {
            errors++;
            feedback.push(
                `<strong>Première IP utilisable incorrecte.</strong> Attendu : <code>${correct.firstUsable}</code><br>` +
                `C'est l'adresse réseau + 1 : <code>${correct.network}</code> + 1`
            );
        }

        if (answers.lastUsable !== correct.lastUsable) {
            errors++;
            feedback.push(
                `<strong>Dernière IP utilisable incorrecte.</strong> Attendu : <code>${correct.lastUsable}</code><br>` +
                `C'est le broadcast - 1 : <code>${correct.broadcast}</code> - 1`
            );
        }

        if (String(answers.hosts) !== String(correct.hosts)) {
            errors++;
            const hostBits = 32 - currentQuestion.cidr;
            feedback.push(
                `<strong>Nombre d'hôtes incorrect.</strong> Attendu : <code>${correct.hosts}</code><br>` +
                `Formule : 2<sup>${hostBits}</sup> - 2 = ${Math.pow(2, hostBits)} - 2 = ${correct.hosts}`
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
        const correct = currentQuestion.answers;

        feedbackEl.innerHTML =
            `<strong>TEMPS ÉCOULÉ !</strong><br>` +
            `Adresse réseau : <code>${correct.network}</code><br>` +
            `Broadcast : <code>${correct.broadcast}</code><br>` +
            `Première IP : <code>${correct.firstUsable}</code><br>` +
            `Dernière IP : <code>${correct.lastUsable}</code><br>` +
            `Nombre d'hôtes : <code>${correct.hosts}</code>`;
        feedbackEl.className = 'bonus-feedback timeout';

        document.querySelectorAll(`#${PREFIX}-inputs input`).forEach(el => el.disabled = true);

        const btn = document.getElementById(`btn-validate-${PREFIX.split('-').pop()}`);
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
                <div class="brief-name" style="font-size:1.2em;margin-bottom:10px;">CALCUL ADRESSE RÉSEAU</div>
                <div class="bonus-instruction">Sélectionnez le niveau de difficulté :</div>
            </div>
        `;

        inputsEl.innerHTML = `
            <div class="training-level-grid">
                <button class="training-level-pick-btn" data-level="1">
                    <span class="tlp-title">NIVEAU 1 — FACILE</span>
                    <span class="tlp-desc">Masques /8, /16, /24</span>
                </button>
                <button class="training-level-pick-btn" data-level="2">
                    <span class="tlp-title">NIVEAU 2 — MOYEN</span>
                    <span class="tlp-desc">Masques /20, /22, /26</span>
                </button>
                <button class="training-level-pick-btn" data-level="3">
                    <span class="tlp-title">NIVEAU 3 — DIFFICILE</span>
                    <span class="tlp-desc">Masques /19, /21, /27, /29</span>
                </button>
                <button class="training-level-pick-btn" data-level="4">
                    <span class="tlp-title">NIVEAU 4 — EXPERT</span>
                    <span class="tlp-desc">Tout masque /8 à /30</span>
                </button>
            </div>
        `;

        document.getElementById('btn-validate-network').style.display = 'none';
        overlay.classList.remove('hidden');

        inputsEl.querySelectorAll('.training-level-pick-btn').forEach(btn => {
            btn.onclick = () => {
                currentLevel = parseInt(btn.dataset.level);
                currentQuestionIndex = 0;
                totalScore = 0;
                document.getElementById('btn-validate-network').style.display = '';
                document.getElementById('btn-validate-network').textContent = 'VALIDER';
                document.getElementById('btn-validate-network').onclick = onValidate;
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
        document.getElementById(`${PREFIX}-inputs`).innerHTML = renderInputs();
        document.getElementById(`${PREFIX}-feedback`).classList.add('hidden');

        startTimer(TIMER_PER_LEVEL[currentLevel]);

        setTimeout(() => {
            const first = document.getElementById('tn-answer-network');
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

        const btn = document.getElementById('btn-validate-network');
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

        const mention = getMention(totalScore);

        questionEl.innerHTML = `
            <div style="text-align:center">
                <div class="brief-name" style="font-size:1.2em;margin-bottom:10px;">ENTRAÎNEMENT TERMINÉ</div>
                <div class="training-result-mention">${mention}</div>
                <div class="bonus-ip-display">${totalScore} POINTS</div>
                <div style="margin-top:10px;color:#8b7355;font-size:0.85em;">
                    sur ${QUESTIONS_PER_LEVEL * 150} points possibles
                </div>
            </div>
        `;
        inputsEl.innerHTML = '';

        const btn = document.getElementById('btn-validate-network');
        btn.textContent = 'REJOUER';
        btn.style.display = '';
        btn.onclick = () => { showLevelPicker(); };
    }

    function getMention(score) {
        const max = QUESTIONS_PER_LEVEL * 150;
        const pct = score / max;
        if (pct >= 0.9) return 'EXCELLENCE';
        if (pct >= 0.7) return 'TRÈS BIEN';
        if (pct >= 0.5) return 'BIEN';
        if (pct >= 0.3) return 'PASSABLE';
        return 'INSUFFISANT';
    }

    function cleanup() {
        stopTimer();
        document.getElementById(`${PREFIX}-overlay`).classList.add('hidden');
    }

    // --- Init event listeners (quit uniquement, validate géré dynamiquement) ---
    document.getElementById('btn-quit-network').addEventListener('click', () => {
        cleanup();
        if (typeof showMainMenu === 'function') showMainMenu();
    });

    return { start, cleanup };
})();
