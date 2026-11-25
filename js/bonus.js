// ==========================================
// GAME EDR - MODULE QUESTIONS BONUS
// Epreuves supplementaires niveaux 1, 2, 3
// ==========================================

const Bonus = (() => {

    // --- Configuration ---
    const BONUS_LEVELS = [1, 2, 3];
    const BONUS_TIMERS = { 1: 60, 2: 120, 3: 180 };
    const BONUS_SCORE_MISSION = 100;
    const BONUS_SCORE_CORRECT = 50;
    const BONUS_SCORE_PER_SECOND = 1;

    // --- Etat ---
    let bonusTimerInterval = null;
    let bonusTimeLeft = 0;
    let currentQuestion = null;
    let bonusCallback = null;

    // --- Briefings militaires ---
    const BONUS_BRIEFINGS = {
        1: {
            codeName: 'EPREUVE SIGMA',
            content: `
                <div class="brief-header">EPREUVE SIGMA</div>
                <div class="brief-name">IDENTIFICATION D'ADRESSE RESEAU</div>
                <div class="brief-section">
                    <span class="brief-label">SITUATION :</span>
                    Le centre de commandement a intercept&eacute; une transmission ennemie contenant une adresse IP et un masque CIDR.
                    Pour localiser l'unit&eacute; &eacute;mettrice et s&eacute;curiser le p&eacute;rim&egrave;tre, vous devez d&eacute;terminer l'adresse du r&eacute;seau auquel elle appartient.
                </div>
                <div class="brief-section">
                    <span class="brief-label">ORDRE :</span>
                    Sergent, calculez l'adresse r&eacute;seau &agrave; partir de l'adresse IP et du masque fournis.
                    Appliquez l'op&eacute;ration AND binaire entre chaque octet de l'adresse et du masque.
                </div>
                <div class="brief-section">
                    <span class="brief-label">D&Eacute;LAI :</span> 60 secondes. Ne perdez pas de temps.
                </div>
                <div class="brief-objectives">
                    <strong>OBJECTIF :</strong> Saisir l'adresse r&eacute;seau correcte correspondant &agrave; l'IP et au masque donn&eacute;s.
                </div>
            `
        },
        2: {
            codeName: 'EPREUVE KILO',
            content: `
                <div class="brief-header">EPREUVE KILO</div>
                <div class="brief-name">DIVISION EN SOUS-RESEAUX</div>
                <div class="brief-section">
                    <span class="brief-label">SITUATION :</span>
                    Le commandement d&eacute;ploie 4 sections sur le terrain. Chaque section doit disposer de son propre sous-r&eacute;seau,
                    d&eacute;coup&eacute; &agrave; parts &eacute;gales &agrave; partir du r&eacute;seau attribu&eacute; par l'&eacute;tat-major.
                </div>
                <div class="brief-section">
                    <span class="brief-label">ORDRE :</span>
                    Sergent, divisez le r&eacute;seau donn&eacute; en exactement 4 sous-r&eacute;seaux de taille identique.
                    Indiquez l'adresse r&eacute;seau et le nouveau masque CIDR pour chacun (format : adresse/masque).
                </div>
                <div class="brief-section">
                    <span class="brief-label">D&Eacute;LAI :</span> 2 minutes. Soyez pr&eacute;cis.
                </div>
                <div class="brief-objectives">
                    <strong>OBJECTIF :</strong> Saisir les 4 sous-r&eacute;seaux &eacute;gaux au format CIDR (ex: 192.168.10.0/26).
                </div>
            `
        },
        3: {
            codeName: 'EPREUVE OMEGA',
            content: `
                <div class="brief-header">EPREUVE OMEGA</div>
                <div class="brief-name">PLANIFICATION VLSM</div>
                <div class="brief-section">
                    <span class="brief-label">SITUATION :</span>
                    Quatre unit&eacute;s op&eacute;rationnelles doivent &ecirc;tre raccord&eacute;es avec des besoins diff&eacute;rents en nombre de postes.
                    L'&eacute;conomie d'adresses est imp&eacute;rative : chaque sous-r&eacute;seau doit &ecirc;tre dimensionn&eacute; au plus juste selon la m&eacute;thode VLSM.
                </div>
                <div class="brief-section">
                    <span class="brief-label">ORDRE :</span>
                    Sergent, &agrave; partir du r&eacute;seau attribu&eacute;, cr&eacute;ez 4 sous-r&eacute;seaux optimis&eacute;s :<br>
                    &bull; <strong>R&eacute;seau ALPHA</strong> &mdash; Unit&eacute; principale : 50 stations (passerelle comprise)<br>
                    &bull; <strong>R&eacute;seau BRAVO</strong> &mdash; Poste de commandement : 10 stations (passerelle comprise)<br>
                    &bull; <strong>R&eacute;seau CHARLIE</strong> &mdash; Base logistique : 150 stations (passerelle comprise)<br>
                    &bull; <strong>R&eacute;seau DELTA</strong> &mdash; Liaison s&eacute;curis&eacute;e : 2 stations (passerelle comprise)
                </div>
                <div class="brief-section">
                    <span class="brief-label">M&Eacute;THODE :</span>
                    Les r&eacute;seaux ne sont pas list&eacute;s par taille. Effectuez les calculs dans l'ordre <strong>d&eacute;croissant du nombre de stations</strong> :
                    le plus grand r&eacute;seau en premier (&agrave; partir de l'adresse du r&eacute;seau attribu&eacute;), puis le deuxi&egrave;me plus grand
                    juste apr&egrave;s, et ainsi de suite.
                </div>
                <div class="brief-section">
                    <span class="brief-label">D&Eacute;LAI :</span> 3 minutes. Aucun chevauchement tol&eacute;r&eacute;.
                </div>
                <div class="brief-objectives">
                    <strong>OBJECTIF :</strong> Saisir les 4 sous-r&eacute;seaux VLSM au format CIDR, avec le masque optimal, allou&eacute;s du plus grand au plus petit.
                </div>
            `
        }
    };

    // =============================================
    // UTILITAIRES IP
    // =============================================

    function ipToNumber(ipStr) {
        const parts = ipStr.split('.').map(Number);
        return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
    }

    function numberToIP(num) {
        return [
            (num >>> 24) & 0xFF,
            (num >>> 16) & 0xFF,
            (num >>> 8) & 0xFF,
            num & 0xFF
        ].join('.');
    }

    function cidrToMask(cidr) {
        if (cidr === 0) return 0;
        return (0xFFFFFFFF << (32 - cidr)) >>> 0;
    }

    function cidrForHosts(h) {
        let bits = 0;
        let size = 1;
        while (size - 2 < h) { bits++; size *= 2; }
        return 32 - bits;
    }

    // =============================================
    // GENERATEURS DE QUESTIONS
    // =============================================

    function generateNetworkAddressQuestion() {
        const cidrOptions = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29];
        const cidr = cidrOptions[Math.floor(Math.random() * cidrOptions.length)];

        const octet1 = 192;
        const octet2 = 168;
        const octet3 = Math.floor(Math.random() * 256);
        let octet4 = Math.floor(Math.random() * 254) + 1;

        const ip = [octet1, octet2, octet3, octet4];
        const mask = cidrToMask(cidr);
        const maskOctets = [
            (mask >>> 24) & 0xFF,
            (mask >>> 16) & 0xFF,
            (mask >>> 8) & 0xFF,
            mask & 0xFF
        ];
        const networkOctets = ip.map((o, i) => o & maskOctets[i]);

        // S'assurer que l'IP n'est pas l'adresse reseau elle-meme
        const ipNum = ((ip[0] << 24) | (ip[1] << 16) | (ip[2] << 8) | ip[3]) >>> 0;
        const netNum = ((networkOctets[0] << 24) | (networkOctets[1] << 16) | (networkOctets[2] << 8) | networkOctets[3]) >>> 0;
        if (ipNum === netNum) {
            ip[3] = Math.min(ip[3] + 1, 254);
        }

        // Aussi s'assurer que l'IP n'est pas le broadcast
        const broadcastNum = (netNum | (~mask >>> 0)) >>> 0;
        const ipNum2 = ((ip[0] << 24) | (ip[1] << 16) | (ip[2] << 8) | ip[3]) >>> 0;
        if (ipNum2 === broadcastNum) {
            ip[3] = Math.max(ip[3] - 1, 1);
        }

        return {
            type: 'network_address',
            ip: ip.join('.'),
            cidr: cidr,
            mask: maskOctets.join('.'),
            correctAnswer: networkOctets.join('.'),
            display: ip.join('.') + '/' + cidr
        };
    }

    function generateEqualSubnetsQuestion() {
        const options = [
            { cidr: 22, newCidr: 24 },
            { cidr: 23, newCidr: 25 },
            { cidr: 24, newCidr: 26 },
            { cidr: 25, newCidr: 27 },
            { cidr: 26, newCidr: 28 }
        ];
        const chosen = options[Math.floor(Math.random() * options.length)];

        // Generer une adresse reseau valide et alignee
        const octet3 = Math.floor(Math.random() * 256);
        const baseIP = ((192 << 24) | (168 << 16) | (octet3 << 8) | 0) >>> 0;
        const mask = cidrToMask(chosen.cidr);
        const networkIP = (baseIP & mask) >>> 0;

        const netOctets = [
            (networkIP >>> 24) & 0xFF,
            (networkIP >>> 16) & 0xFF,
            (networkIP >>> 8) & 0xFF,
            networkIP & 0xFF
        ];

        // Calculer les 4 sous-reseaux
        const subnetSize = 1 << (32 - chosen.newCidr);
        const subnets = [];
        for (let i = 0; i < 4; i++) {
            const subnetIP = (networkIP + (i * subnetSize)) >>> 0;
            subnets.push(numberToIP(subnetIP) + '/' + chosen.newCidr);
        }

        return {
            type: 'equal_subnets',
            network: netOctets.join('.'),
            cidr: chosen.cidr,
            newCidr: chosen.newCidr,
            correctAnswers: subnets,
            display: netOctets.join('.') + '/' + chosen.cidr
        };
    }

    function generateVLSMQuestion() {
        const requirements = [
            { name: 'CHARLIE', hosts: 150, label: 'Base logistique' },
            { name: 'ALPHA',   hosts: 50,  label: 'Unite principale' },
            { name: 'BRAVO',   hosts: 10,  label: 'Poste de commandement' },
            { name: 'DELTA',   hosts: 2,   label: 'Liaison securisee' }
        ];

        // Reseau de base aligne sur /22 dans 172.16.x.0
        const thirdOctetBase = Math.floor(Math.random() * 64) * 4;
        const baseNetwork = '172.16.' + thirdOctetBase + '.0';
        const baseCidr = 22;
        const baseIP = ipToNumber(baseNetwork);

        // Calculer CIDR requis et taille pour chaque sous-reseau
        const subnetsInfo = requirements.map(r => ({
            name: r.name,
            hosts: r.hosts,
            label: r.label,
            requiredCidr: cidrForHosts(r.hosts),
            minSize: 1 << (32 - cidrForHosts(r.hosts))
        }));

        // Ordre de calcul VLSM : du plus grand nombre de stations au plus petit
        // (l'affichage, lui, garde l'ordre ALPHA, BRAVO, CHARLIE, DELTA qui n'est pas trié)
        const allocationOrder = [...subnetsInfo].sort((a, b) => b.hosts - a.hosts || b.minSize - a.minSize);

        // Allouer sequentiellement a partir de l'adresse du reseau de base
        let currentOffset = 0;
        const sampleAnswer = allocationOrder.map(s => {
            const subnetIP = (baseIP + currentOffset) >>> 0;
            const result = {
                name: s.name,
                hosts: s.hosts,
                network: numberToIP(subnetIP) + '/' + s.requiredCidr
            };
            s.expected = result.network;
            currentOffset += s.minSize;
            return result;
        });

        return {
            type: 'vlsm',
            network: baseNetwork,
            cidr: baseCidr,
            subnets: subnetsInfo,
            sampleAnswer: sampleAnswer,
            display: baseNetwork + '/' + baseCidr
        };
    }

    // =============================================
    // VALIDATEURS
    // =============================================

    function validateNetworkAddress(userAnswer, question) {
        const cleaned = userAnswer.trim();
        return {
            correct: cleaned === question.correctAnswer,
            feedback: cleaned === question.correctAnswer
                ? 'Adresse reseau correcte !'
                : 'Incorrect. L\'adresse reseau attendue etait : ' + question.correctAnswer
        };
    }

    function validateEqualSubnets(userAnswers, question) {
        const normalized = userAnswers.map(a => a.trim()).filter(a => a.length > 0);
        if (normalized.length !== 4) {
            return { correct: false, feedback: 'Vous devez fournir exactement 4 sous-reseaux.' };
        }

        // Verifier le format de chaque reponse
        for (let i = 0; i < 4; i++) {
            const parts = normalized[i].split('/');
            if (parts.length !== 2 || isNaN(parseInt(parts[1]))) {
                return { correct: false, feedback: 'Format invalide pour le sous-reseau ' + (i + 1) + '. Utilisez le format adresse/masque (ex: 192.168.10.0/26).' };
            }
        }

        const sortedCorrect = [...question.correctAnswers].sort();
        const sortedUser = [...normalized].sort();

        const allCorrect = sortedCorrect.every((ans, i) => ans === sortedUser[i]);
        if (allCorrect) {
            return { correct: true, feedback: 'Tous les sous-reseaux sont corrects !' };
        }

        // Feedback detaille
        const missing = sortedCorrect.filter(c => !sortedUser.includes(c));
        if (missing.length > 0) {
            return { correct: false, feedback: 'Sous-reseau(x) manquant(s) ou incorrect(s). Attendu : ' + question.correctAnswers.join(', ') };
        }
        return { correct: false, feedback: 'Reponse incorrecte. Sous-reseaux attendus : ' + question.correctAnswers.join(', ') };
    }

    function validateVLSM(userAnswers, question) {
        const baseIP = ipToNumber(question.network);
        const baseEnd = baseIP + (1 << (32 - question.cidr)) - 1;

        const parsed = [];

        for (const entry of userAnswers) {
            const network = entry.network.trim();
            if (!network) {
                return { correct: false, feedback: 'Le champ pour le reseau ' + entry.name + ' est vide.' };
            }

            const parts = network.split('/');
            if (parts.length !== 2) {
                return { correct: false, feedback: 'Format invalide pour ' + entry.name + '. Utilisez adresse/masque (ex: 172.16.0.0/24).' };
            }

            const ipParts = parts[0].split('.');
            if (ipParts.length !== 4 || ipParts.some(p => isNaN(parseInt(p)) || parseInt(p) < 0 || parseInt(p) > 255)) {
                return { correct: false, feedback: 'Adresse IP invalide pour ' + entry.name + '.' };
            }

            const ip = ipToNumber(parts[0]);
            const cidr = parseInt(parts[1]);

            if (isNaN(cidr) || cidr < 0 || cidr > 32) {
                return { correct: false, feedback: 'Masque CIDR invalide pour ' + entry.name + '.' };
            }

            // Verifier que c'est une adresse reseau valide
            const mask = cidrToMask(cidr);
            if (((ip & mask) >>> 0) !== ip) {
                return { correct: false, feedback: parts[0] + ' n\'est pas une adresse reseau valide pour /' + cidr + ' (reseau ' + entry.name + ').' };
            }

            // Verifier que le sous-reseau est dans le reseau parent
            const subEnd = (ip + (1 << (32 - cidr)) - 1) >>> 0;
            if (ip < baseIP || subEnd > baseEnd) {
                return { correct: false, feedback: 'Le sous-reseau ' + entry.name + ' depasse le reseau parent ' + question.display + '.' };
            }

            // Verifier le nombre d'hotes suffisant
            const req = question.subnets.find(s => s.name === entry.name);
            const usableHosts = (1 << (32 - cidr)) - 2;
            if (usableHosts < req.hosts) {
                return { correct: false, feedback: '/' + cidr + ' ne fournit que ' + usableHosts + ' hotes. ' + entry.name + ' en requiert ' + req.hosts + '. Attendu : ' + question.sampleAnswer.map(a => a.name + ' : ' + a.network).join(' | ') };
            }

            // Verifier le masque optimal (VLSM)
            if (cidr !== req.requiredCidr) {
                return { correct: false, feedback: 'Le masque /' + cidr + ' pour ' + entry.name + ' n\'est pas optimal. Utilisez /' + req.requiredCidr + ' pour ' + req.hosts + ' hotes. Attendu : ' + question.sampleAnswer.map(a => a.name + ' : ' + a.network).join(' | ') };
            }

            parsed.push({ name: entry.name, start: ip, end: subEnd, cidr });
        }

        const orderText = question.sampleAnswer.map(a => a.name + ' (' + a.hosts + ')').join(' > ');
        const expectedText = question.sampleAnswer.map(a => a.name + ' : ' + a.network).join(' | ');

        // Verifier qu'il n'y a pas de chevauchement
        const byStart = [...parsed].sort((a, b) => a.start - b.start);
        for (let i = 0; i < byStart.length - 1; i++) {
            if (byStart[i].end >= byStart[i + 1].start) {
                return { correct: false, feedback: 'Les sous-reseaux ' + byStart[i].name + ' et ' + byStart[i + 1].name + ' se chevauchent. Attendu : ' + expectedText };
            }
        }

        // Verifier l'ordre d'allocation : du plus grand nombre de stations au plus petit
        const wrong = parsed.filter(p => {
            const req = question.subnets.find(s => s.name === p.name);
            return numberToIP(p.start) + '/' + p.cidr !== req.expected;
        });
        if (wrong.length > 0) {
            return {
                correct: false,
                feedback: 'Ordre de calcul incorrect pour ' + wrong.map(w => w.name).join(', ') + '. '
                    + 'En VLSM, on alloue du plus grand reseau au plus petit (nombre de stations) : ' + orderText
                    + ', en partant de ' + question.network + '. Attendu : ' + expectedText
            };
        }

        return { correct: true, feedback: 'Tous les sous-reseaux VLSM sont corrects et alloues dans le bon ordre. Excellent travail, Sergent !' };
    }

    // =============================================
    // RENDU DES QUESTIONS
    // =============================================

    function renderLevel1Question(question) {
        return `
            <div class="bonus-prompt">
                <span class="brief-label">ADRESSE INTERCEPTEE :</span>
                <div class="bonus-ip-display">${question.display}</div>
                <div class="bonus-mask-info">Masque : ${question.mask}</div>
            </div>
            <div class="bonus-instruction">Entrez l'adresse r&eacute;seau correspondante :</div>
        `;
    }

    function renderLevel1Inputs() {
        return `<input type="text" id="bonus-answer-1" class="bonus-input" placeholder="ex: 192.168.14.32" autocomplete="off">`;
    }

    function renderLevel2Question(question) {
        return `
            <div class="bonus-prompt">
                <span class="brief-label">RESEAU A DIVISER :</span>
                <div class="bonus-ip-display">${question.display}</div>
            </div>
            <div class="bonus-instruction">Entrez les 4 sous-r&eacute;seaux &eacute;gaux (format : adresse/masque) :</div>
        `;
    }

    function renderLevel2Inputs() {
        return `
            <div class="bonus-input-group">
                <label class="bonus-input-label">Sous-r&eacute;seau 1 :</label>
                <input type="text" id="bonus-answer-1" class="bonus-input" placeholder="ex: 192.168.10.0/26" autocomplete="off">
            </div>
            <div class="bonus-input-group">
                <label class="bonus-input-label">Sous-r&eacute;seau 2 :</label>
                <input type="text" id="bonus-answer-2" class="bonus-input" placeholder="ex: 192.168.10.64/26" autocomplete="off">
            </div>
            <div class="bonus-input-group">
                <label class="bonus-input-label">Sous-r&eacute;seau 3 :</label>
                <input type="text" id="bonus-answer-3" class="bonus-input" placeholder="ex: 192.168.10.128/26" autocomplete="off">
            </div>
            <div class="bonus-input-group">
                <label class="bonus-input-label">Sous-r&eacute;seau 4 :</label>
                <input type="text" id="bonus-answer-4" class="bonus-input" placeholder="ex: 192.168.10.192/26" autocomplete="off">
            </div>
        `;
    }

    function renderLevel3Question(question) {
        return `
            <div class="bonus-prompt">
                <span class="brief-label">RESEAU DISPONIBLE :</span>
                <div class="bonus-ip-display">${question.display}</div>
            </div>
            <div class="bonus-instruction">Cr&eacute;ez 4 sous-r&eacute;seaux VLSM optimis&eacute;s pour les besoins suivants :</div>
            <div class="bonus-instruction" style="font-size:0.8em;color:#b9a878;">
                &#9888; Calculez dans l'ordre d&eacute;croissant du nombre de stations (le plus grand r&eacute;seau d'abord, &agrave; partir de ${question.network}).
            </div>
        `;
    }

    function renderLevel3Inputs(question) {
        const displayOrder = [
            { name: 'ALPHA',   label: 'Unite principale' },
            { name: 'BRAVO',   label: 'Poste de commandement' },
            { name: 'CHARLIE', label: 'Base logistique' },
            { name: 'DELTA',   label: 'Liaison securisee' }
        ];
        return displayOrder.map(d => {
            const subnet = question.subnets.find(s => s.name === d.name);
            return `
                <div class="bonus-input-group vlsm-group">
                    <label class="bonus-input-label">${d.name} &mdash; ${d.label} (${subnet.hosts} h&ocirc;tes) :</label>
                    <input type="text" id="bonus-answer-${d.name}" class="bonus-input" placeholder="ex: 172.16.0.0/24" autocomplete="off">
                </div>
            `;
        }).join('');
    }

    // =============================================
    // TIMER BONUS
    // =============================================

    function startBonusTimer(seconds, onTimeout) {
        bonusTimeLeft = seconds;
        updateBonusTimerDisplay();
        const timerEl = document.getElementById('bonus-timer');
        if (timerEl) timerEl.classList.remove('danger');

        bonusTimerInterval = setInterval(() => {
            bonusTimeLeft--;
            updateBonusTimerDisplay();

            if (bonusTimeLeft <= 10) {
                const el = document.getElementById('bonus-timer');
                if (el) el.classList.add('danger');
            }

            if (bonusTimeLeft <= 0) {
                clearInterval(bonusTimerInterval);
                bonusTimerInterval = null;
                onTimeout();
            }
        }, 1000);
    }

    function stopBonusTimer() {
        if (bonusTimerInterval) {
            clearInterval(bonusTimerInterval);
            bonusTimerInterval = null;
        }
        return Math.max(0, bonusTimeLeft);
    }

    function updateBonusTimerDisplay() {
        const m = Math.floor(Math.max(0, bonusTimeLeft) / 60).toString().padStart(2, '0');
        const s = (Math.max(0, bonusTimeLeft) % 60).toString().padStart(2, '0');
        const el = document.getElementById('bonus-timer');
        if (el) el.textContent = m + ':' + s;
    }

    // =============================================
    // LOGIQUE PRINCIPALE
    // =============================================

    function hasBonusQuestion(levelId) {
        return BONUS_LEVELS.includes(levelId);
    }

    function showBonusBriefing(levelId, onStart) {
        const briefing = BONUS_BRIEFINGS[levelId];
        if (!briefing) { onStart(); return; }

        document.getElementById('bonus-briefing-content').innerHTML = briefing.content;
        document.getElementById('bonus-briefing-overlay').classList.remove('hidden');

        document.getElementById('btn-start-bonus').onclick = () => {
            document.getElementById('bonus-briefing-overlay').classList.add('hidden');
            onStart();
        };
    }

    function showBonusQuestion(levelId, callback) {
        bonusCallback = callback;

        // Generer la question
        if (levelId === 1) currentQuestion = generateNetworkAddressQuestion();
        else if (levelId === 2) currentQuestion = generateEqualSubnetsQuestion();
        else if (levelId === 3) currentQuestion = generateVLSMQuestion();

        // Rendre le contenu
        const contentEl = document.getElementById('bonus-question-content');
        const inputEl = document.getElementById('bonus-input-area');
        const feedbackEl = document.getElementById('bonus-feedback');
        const validateBtn = document.getElementById('btn-validate-bonus');

        feedbackEl.classList.add('hidden');
        feedbackEl.className = 'bonus-feedback hidden';
        validateBtn.textContent = 'VALIDER';

        if (levelId === 1) {
            contentEl.innerHTML = renderLevel1Question(currentQuestion);
            inputEl.innerHTML = renderLevel1Inputs();
        } else if (levelId === 2) {
            contentEl.innerHTML = renderLevel2Question(currentQuestion);
            inputEl.innerHTML = renderLevel2Inputs();
        } else if (levelId === 3) {
            contentEl.innerHTML = renderLevel3Question(currentQuestion);
            inputEl.innerHTML = renderLevel3Inputs(currentQuestion);
        }

        // Initialiser le timer AVANT d'afficher l'overlay (eviter flash de l'ancienne valeur)
        bonusTimeLeft = BONUS_TIMERS[levelId];
        updateBonusTimerDisplay();

        // Afficher l'overlay
        document.getElementById('bonus-question-overlay').classList.remove('hidden');

        // Focus sur le premier champ
        setTimeout(() => {
            const firstInput = document.querySelector('#bonus-input-area input');
            if (firstInput) firstInput.focus();
        }, 200);

        // Demarrer le decompte
        startBonusTimer(BONUS_TIMERS[levelId], () => onBonusTimeout(levelId));

        // Bouton valider
        validateBtn.onclick = () => validateAndSubmit(levelId);
    }

    function onBonusTimeout(levelId) {
        const feedbackEl = document.getElementById('bonus-feedback');
        feedbackEl.textContent = 'TEMPS ECOULE — Epreuve echouee. La reponse attendue etait : ' + getExpectedAnswer(levelId);
        feedbackEl.className = 'bonus-feedback timeout';

        // Desactiver les inputs
        document.querySelectorAll('#bonus-input-area input').forEach(el => el.disabled = true);

        const validateBtn = document.getElementById('btn-validate-bonus');
        validateBtn.textContent = 'CONTINUER';
        validateBtn.onclick = () => {
            document.getElementById('bonus-question-overlay').classList.add('hidden');
            validateBtn.textContent = 'VALIDER';
            if (bonusCallback) {
                bonusCallback({ correct: false, timeRemaining: 0, bonusPoints: BONUS_SCORE_MISSION });
                bonusCallback = null;
            }
        };
    }

    function getExpectedAnswer(levelId) {
        if (levelId === 1) {
            return currentQuestion.correctAnswer;
        } else if (levelId === 2) {
            return currentQuestion.correctAnswers.join(' | ');
        } else if (levelId === 3) {
            return currentQuestion.sampleAnswer.map(s => s.name + ' (' + s.hosts + ') : ' + s.network).join(' | ');
        }
        return '';
    }

    function validateAndSubmit(levelId) {
        const timeRemaining = stopBonusTimer();
        let result;

        if (levelId === 1) {
            const answer = document.getElementById('bonus-answer-1').value;
            result = validateNetworkAddress(answer, currentQuestion);
        } else if (levelId === 2) {
            const answers = [1, 2, 3, 4].map(i => document.getElementById('bonus-answer-' + i).value);
            result = validateEqualSubnets(answers, currentQuestion);
        } else if (levelId === 3) {
            const names = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA'];
            const answers = names.map(n => ({
                name: n,
                network: document.getElementById('bonus-answer-' + n).value
            }));
            result = validateVLSM(answers, currentQuestion);
        }

        // Afficher le feedback
        const feedbackEl = document.getElementById('bonus-feedback');
        if (result.correct) {
            feedbackEl.textContent = result.feedback;
            feedbackEl.className = 'bonus-feedback success';
        } else {
            feedbackEl.textContent = result.feedback;
            feedbackEl.className = 'bonus-feedback failure';
        }

        // Desactiver les inputs
        document.querySelectorAll('#bonus-input-area input').forEach(el => el.disabled = true);

        // Calculer les points bonus
        const bonusPoints = BONUS_SCORE_MISSION
            + (result.correct ? BONUS_SCORE_CORRECT : 0)
            + (result.correct ? timeRemaining * BONUS_SCORE_PER_SECOND : 0);

        // Changer le bouton en "Continuer"
        const validateBtn = document.getElementById('btn-validate-bonus');
        validateBtn.textContent = 'CONTINUER';
        validateBtn.onclick = () => {
            document.getElementById('bonus-question-overlay').classList.add('hidden');
            validateBtn.textContent = 'VALIDER';
            if (bonusCallback) {
                bonusCallback({
                    correct: result.correct,
                    timeRemaining: result.correct ? timeRemaining : 0,
                    bonusPoints: bonusPoints
                });
                bonusCallback = null;
            }
        };
    }

    function cleanup() {
        stopBonusTimer();
        document.getElementById('bonus-briefing-overlay').classList.add('hidden');
        document.getElementById('bonus-question-overlay').classList.add('hidden');
        bonusCallback = null;
        currentQuestion = null;
    }

    // =============================================
    // API PUBLIQUE
    // =============================================

    return {
        hasBonusQuestion,
        showBonusBriefing,
        showBonusQuestion,
        cleanup,
        BONUS_SCORE_MISSION,
        BONUS_SCORE_CORRECT,
        BONUS_SCORE_PER_SECOND
    };

})();
