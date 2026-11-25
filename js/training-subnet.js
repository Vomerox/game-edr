// ==========================================
// GAME EDR - MODE SOUS-RÉSEAU
// ==========================================

const TrainingSubnet = (() => {

    // --- Configuration ---
    const QUESTIONS_PER_LEVEL = 5;
    const TIMER_PER_LEVEL = { 1: 120, 2: 150, 3: 240, 4: 300 };
    const LEVEL_CONFIGS = {
        1: { baseCidrs: [24], subnetCounts: [2], label: 'FACILE' },
        2: { baseCidrs: [24], subnetCounts: [4], label: 'MOYEN' },
        3: { baseCidrs: [16, 20, 22, 24], subnetCounts: [4, 8], label: 'DIFFICILE' },
        4: { baseCidrs: [8, 12, 16, 20, 24], subnetCounts: [8, 16], label: 'EXPERT' }
    };

    // --- State ---
    let currentLevel = 1;
    let currentQuestionIndex = 0;
    let totalScore = 0;
    let currentQuestion = null;
    let timerInterval = null;
    let timeLeft = 0;
    let questionStartTime = 0;

    const PREFIX = 'training-subnet';

    // --- Génération ---
    function generateAlignedNetwork(cidr) {
        const ranges = [
            [10, 0], [172, 16], [192, 168], [10, 10], [172, 20]
        ];
        const r = ranges[Math.floor(Math.random() * ranges.length)];
        const blockSize = 1 << (32 - cidr);

        // Générer un 3e octet aligné
        let o3 = 0;
        if (cidr <= 16) {
            o3 = 0;
        } else if (cidr <= 24) {
            const step = blockSize >> 8; // blocs dans le 3e octet
            const maxBlocks = Math.floor(256 / step);
            o3 = Math.floor(Math.random() * maxBlocks) * step;
        } else {
            o3 = Math.floor(Math.random() * 256);
        }

        return `${r[0]}.${r[1]}.${o3}.0`;
    }

    function generateQuestion(level) {
        const config = LEVEL_CONFIGS[level];
        const baseCidr = config.baseCidrs[Math.floor(Math.random() * config.baseCidrs.length)];
        const subnetCount = config.subnetCounts[Math.floor(Math.random() * config.subnetCounts.length)];

        const extraBits = Math.round(Math.log2(subnetCount));
        const newCidr = baseCidr + extraBits;

        if (newCidr > 30) return generateQuestion(level); // Sécurité

        const baseIP = generateAlignedNetwork(baseCidr);
        const baseNum = IPUtils.ipToNumber(baseIP);
        const subnetSize = 1 << (32 - newCidr);

        const subnets = [];
        for (let i = 0; i < subnetCount; i++) {
            const addr = IPUtils.numberToIP((baseNum + i * subnetSize) >>> 0);
            subnets.push(`${addr}/${newCidr}`);
        }

        return {
            network: baseIP,
            cidr: baseCidr,
            subnetCount: subnetCount,
            newCidr: newCidr,
            subnetSize: subnetSize,
            correctSubnets: subnets
        };
    }

    // --- Rendu ---
    function renderQuestion(q) {
        return `
            <div class="bonus-prompt">
                <span class="brief-label">RÉSEAU À DÉCOUPER :</span>
                <div class="bonus-ip-display">${q.network} / ${q.cidr}</div>
                <div class="bonus-mask-info">Masque : ${IPUtils.cidrToMaskString(q.cidr)}</div>
            </div>
            <div class="bonus-instruction">
                Divisez ce réseau en <strong>${q.subnetCount} sous-réseaux identiques</strong>.<br>
                Pour chaque sous-réseau, indiquez l'adresse réseau et le masque CIDR.
            </div>
        `;
    }

    function renderInputs(q) {
        let html = '';
        for (let i = 0; i < q.subnetCount; i++) {
            html += `
                <div class="bonus-input-group">
                    <label class="bonus-input-label">Sous-réseau ${i + 1} :</label>
                    <input type="text" id="ts-answer-${i}" class="bonus-input"
                           placeholder="ex: 192.168.0.0/26" autocomplete="off">
                </div>
            `;
        }
        return html;
    }

    // --- Validation ---
    function validate() {
        const userAnswers = [];
        for (let i = 0; i < currentQuestion.subnetCount; i++) {
            userAnswers.push(document.getElementById(`ts-answer-${i}`).value.trim());
        }

        let errors = 0;
        let feedback = [];

        // Vérifier le format de chaque réponse
        for (let i = 0; i < userAnswers.length; i++) {
            if (!userAnswers[i]) {
                errors++;
                feedback.push(`Sous-réseau ${i + 1} : champ vide.`);
            } else {
                const parts = userAnswers[i].split('/');
                if (parts.length !== 2 || !IPUtils.isValidIP(parts[0]) || isNaN(parseInt(parts[1]))) {
                    errors++;
                    feedback.push(`Sous-réseau ${i + 1} : format invalide. Utilisez adresse/masque (ex: 192.168.0.0/26).`);
                }
            }
        }

        if (errors === 0) {
            // Comparer les réponses (indépendant de l'ordre)
            const sortedCorrect = [...currentQuestion.correctSubnets].sort();
            const sortedUser = [...userAnswers].sort();

            let mismatch = false;
            for (let i = 0; i < sortedCorrect.length; i++) {
                if (sortedCorrect[i] !== sortedUser[i]) {
                    mismatch = true;
                    break;
                }
            }

            if (mismatch) {
                errors = 0;
                // Compter les erreurs individuelles
                for (let i = 0; i < sortedUser.length; i++) {
                    if (!sortedCorrect.includes(sortedUser[i])) {
                        errors++;
                    }
                }
                if (errors === 0) errors = 1; // Au moins une erreur si mismatch
            }
        }

        if (errors > 0) {
            const extraBits = Math.round(Math.log2(currentQuestion.subnetCount));
            const hostsPerSubnet = (1 << (32 - currentQuestion.newCidr)) - 2;

            feedback.push(
                `<strong>Sous-réseaux attendus :</strong> ${currentQuestion.correctSubnets.join(', ')}`
            );
            feedback.push(
                `<strong>Méthode :</strong> Pour diviser en ${currentQuestion.subnetCount} sous-réseaux, ` +
                `il faut emprunter ${extraBits} bit(s) à la partie hôte ` +
                `(2<sup>${extraBits}</sup> = ${currentQuestion.subnetCount}).`
            );
            feedback.push(
                `Le masque passe de /${currentQuestion.cidr} à /${currentQuestion.newCidr}. ` +
                `Chaque sous-réseau contient ${currentQuestion.subnetSize} adresses ` +
                `(${hostsPerSubnet} hôtes utilisables).`
            );
        }

        // Nombre de sous-réseaux réellement justes (doublons comptés une seule fois)
        const correctCount = new Set(userAnswers.filter(a => currentQuestion.correctSubnets.includes(a))).size;

        return { errors, feedback, allCorrect: errors === 0, correctCount };
    }

    // --- Scoring ---
    function calculateScore(errors, elapsedSeconds, correctCount) {
        // Réponse vide ou entièrement fausse : aucun point
        if (correctCount === 0) return 0;
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
        feedbackEl.innerHTML =
            `<strong>TEMPS ÉCOULÉ !</strong><br>` +
            `Sous-réseaux attendus : ${currentQuestion.correctSubnets.join(', ')}`;
        feedbackEl.className = 'bonus-feedback timeout';

        document.querySelectorAll(`#${PREFIX}-inputs input`).forEach(el => el.disabled = true);

        const btn = document.getElementById('btn-validate-subnet');
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
                <div class="brief-name" style="font-size:1.2em;margin-bottom:10px;">SOUS-RÉSEAU</div>
                <div class="bonus-instruction">Sélectionnez le niveau de difficulté :</div>
            </div>
        `;

        inputsEl.innerHTML = `
            <div class="training-level-grid">
                <button class="training-level-pick-btn" data-level="1">
                    <span class="tlp-title">NIVEAU 1 — FACILE</span>
                    <span class="tlp-desc">Réseau /24, 2 sous-réseaux</span>
                </button>
                <button class="training-level-pick-btn" data-level="2">
                    <span class="tlp-title">NIVEAU 2 — MOYEN</span>
                    <span class="tlp-desc">Réseau /24, 4 sous-réseaux</span>
                </button>
                <button class="training-level-pick-btn" data-level="3">
                    <span class="tlp-title">NIVEAU 3 — DIFFICILE</span>
                    <span class="tlp-desc">Réseaux /16 à /24, 4-8 sous-réseaux</span>
                </button>
                <button class="training-level-pick-btn" data-level="4">
                    <span class="tlp-title">NIVEAU 4 — EXPERT</span>
                    <span class="tlp-desc">Tout réseau, 8-16 sous-réseaux</span>
                </button>
            </div>
        `;

        document.getElementById('btn-validate-subnet').style.display = 'none';
        overlay.classList.remove('hidden');

        inputsEl.querySelectorAll('.training-level-pick-btn').forEach(btn => {
            btn.onclick = () => {
                currentLevel = parseInt(btn.dataset.level);
                currentQuestionIndex = 0;
                totalScore = 0;
                document.getElementById('btn-validate-subnet').style.display = '';
                document.getElementById('btn-validate-subnet').textContent = 'VALIDER';
                document.getElementById('btn-validate-subnet').onclick = onValidate;
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
            const first = document.getElementById('ts-answer-0');
            if (first) first.focus();
        }, 200);
    }

    function onValidate() {
        const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
        stopTimer();

        const result = validate();
        const points = calculateScore(result.errors, elapsed, result.correctCount);
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

        const btn = document.getElementById('btn-validate-subnet');
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

        const btn = document.getElementById('btn-validate-subnet');
        btn.textContent = 'REJOUER';
        btn.style.display = '';
        btn.onclick = () => { showLevelPicker(); };
    }

    function cleanup() {
        stopTimer();
        document.getElementById(`${PREFIX}-overlay`).classList.add('hidden');
    }

    // --- Init event listeners (quit uniquement, validate géré dynamiquement) ---
    document.getElementById('btn-quit-subnet').addEventListener('click', () => {
        cleanup();
        if (typeof showMainMenu === 'function') showMainMenu();
    });

    return { start, cleanup };
})();
