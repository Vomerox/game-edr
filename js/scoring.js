// ==========================================
// GAME EDR - MOTEUR DE SCORING & PROGRESSION
// ==========================================

const Scoring = (() => {
    // --- ÉTAT DU SCORING ---
    let state = {
        score: 0,
        combo: 0,
        maxCombo: 0,
        errors: 0,
        pingAttempts: 0,
        actionsCorrect: 0,
        hintsUsed: 0,
        configChanges: 0,
        routeAdds: 0,
        routeDeletes: 0,
        missionStartTime: 0,
        missionEndTime: 0,
        penalties: 0,
        bonusSpeed: 0,
        bonusPrecision: 0,
        bonusTactical: 0,
        bonusCombo: 0,
        bonusFirstTry: 0,
        missionBase: 0,
        totalScore: 0,
        isFirstAttempt: true
    };

    // --- CONSTANTES DE SCORING ---
    const SCORE = {
        MISSION_BASE: 1000,
        SPEED_MULTIPLIER: 15,        // pts par seconde restante
        COMBO_MULTIPLIER: 50,         // pts par combo
        MAX_PRECISION_BONUS: 500,
        TACTICAL_NO_HINT: 200,
        TACTICAL_OPTIMAL_ROUTE: 150,
        TACTICAL_CLEAN_CONFIG: 100,
        FIRST_TRY_BONUS: 300,
        STREAK_BONUS_PER: 100,        // par mission réussie d'affilée
        PENALTY_BAD_PING: -80,
        PENALTY_BAD_CONFIG: -40,
        PENALTY_EXCESS_ROUTES: -30,
        PENALTY_EMPTY_FIELD: -20
    };

    // --- MENTIONS ---
    const MENTIONS = [
        { id: 'passable',   label: 'PASSABLE',   min: 0,    icon: '▬' },
        { id: 'correct',    label: 'CORRECT',     min: 800,  icon: '◆' },
        { id: 'bien',       label: 'BIEN',        min: 1400, icon: '★' },
        { id: 'tresbien',   label: 'TRÈS BIEN',   min: 2000, icon: '★★' },
        { id: 'excellence', label: 'EXCELLENCE',   min: 2800, icon: '★★★' }
    ];

    // --- MÉDAILLES ---
    const MEDALS = {
        bronze:      { label: 'BRONZE',      min: 800,  icon: '🥉' },
        argent:      { label: 'ARGENT',      min: 1500, icon: '🥈' },
        or:          { label: 'OR',          min: 2200, icon: '🥇' },
        distinction: { label: 'DISTINCTION', min: 3000, icon: '🎖️' }
    };

    // --- RANGS DE PROGRESSION ---
    const RANKS = [
        { id: 'operateur',     label: 'Opérateur Réseau',            minCumul: 0,     minMissions: 0 },
        { id: 'chef_liaison',  label: 'Chef de Liaison',             minCumul: 3000,  minMissions: 2 },
        { id: 'coordinateur',  label: 'Coordinateur Transmissions',  minCumul: 8000,  minMissions: 4 },
        { id: 'controleur',    label: 'Contrôleur EDR',              minCumul: 15000, minMissions: 7 },
        { id: 'expert',        label: 'Expert Interconnexion',       minCumul: 25000, minMissions: 10 }
    ];

    // --- PERSISTENCE (localStorage) ---
    function loadProfile() {
        try {
            const saved = localStorage.getItem('gameedr_profile');
            if (saved) return JSON.parse(saved);
        } catch(e) {}
        return {
            cumulScore: 0,
            missionsCompleted: 0,
            missionsAttempted: 0,
            currentStreak: 0,
            bestStreak: 0,
            bestScores: {},
            bestTimes: {},
            medals: {},
            rank: 'operateur'
        };
    }

    function saveProfile(profile) {
        try { localStorage.setItem('gameedr_profile', JSON.stringify(profile)); } catch(e) {}
    }

    let profile = loadProfile();

    // --- EVENT LOG ---
    let eventLog = [];

    function logEvent(msg, type) {
        type = type || 'info';
        const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        eventLog.push({ time, msg, type });
        if (eventLog.length > 50) eventLog.shift();
        updateEventLogUI();
    }

    function updateEventLogUI() {
        const el = document.getElementById('event-log-content');
        if (!el) return;
        const last8 = eventLog.slice(-8);
        el.innerHTML = last8.map(e => {
            const cls = e.type === 'error' ? 'log-error' : e.type === 'success' ? 'log-success' : e.type === 'warning' ? 'log-warning' : 'log-info';
            return `<div class="log-entry ${cls}"><span class="log-time">${e.time}</span> ${e.msg}</div>`;
        }).join('');
        el.scrollTop = el.scrollHeight;
    }

    // --- INIT MISSION ---
    function startMission(missionId) {
        state = {
            score: 0, combo: 0, maxCombo: 0, errors: 0, pingAttempts: 0,
            actionsCorrect: 0, hintsUsed: 0, configChanges: 0, routeAdds: 0,
            routeDeletes: 0, missionStartTime: Date.now(), missionEndTime: 0,
            penalties: 0, bonusSpeed: 0, bonusPrecision: 0, bonusTactical: 0,
            bonusCombo: 0, bonusFirstTry: 0, missionBase: 0, totalScore: 0,
            isFirstAttempt: !profile.bestScores[missionId]
        };
        eventLog = [];
        logEvent('Initialisation des systèmes de communication...', 'info');
        logEvent('Attente des ordres du Sergent.', 'info');
        updateHUD();
    }

    // --- ACTIONS DE SCORING ---
    function onConfigSaved(nodeId, isValid) {
        state.configChanges++;
        if (isValid) {
            state.combo++;
            state.actionsCorrect++;
            if (state.combo > state.maxCombo) state.maxCombo = state.combo;
            state.score += 50 + state.combo * 10;
            logEvent(`Configuration de ${Missions.getAlias(nodeId)} enregistrée.`, 'success');
        } else {
            state.combo = 0;
            state.errors++;
            state.penalties += Math.abs(SCORE.PENALTY_BAD_CONFIG);
            state.score += SCORE.PENALTY_BAD_CONFIG;
            logEvent(`Erreur de configuration sur ${Missions.getAlias(nodeId)}.`, 'error');
        }
        updateHUD();
    }

    function onRouteAdded(routerId) {
        state.routeAdds++;
        state.combo++;
        state.actionsCorrect++;
        if (state.combo > state.maxCombo) state.maxCombo = state.combo;
        state.score += 30 + state.combo * 5;
        logEvent(`Route ajoutée sur ${Missions.getAlias(routerId)}.`, 'info');
        updateHUD();
    }

    function onPingAttempt(success, reason) {
        state.pingAttempts++;
        if (success) {
            state.combo++;
            state.actionsCorrect++;
            if (state.combo > state.maxCombo) state.maxCombo = state.combo;
            logEvent('Connectivité confirmée ! Liaison opérationnelle.', 'success');
        } else {
            state.combo = 0;
            state.errors++;
            state.penalties += Math.abs(SCORE.PENALTY_BAD_PING);
            state.score += SCORE.PENALTY_BAD_PING;
            logEvent('Échec du diagnostic : ' + (reason || 'liaison interrompue'), 'error');
        }
        updateHUD();
    }

    function onFieldError(nodeId, fieldName) {
        state.errors++;
        state.combo = 0;
        state.penalties += Math.abs(SCORE.PENALTY_EMPTY_FIELD);
        state.score += SCORE.PENALTY_EMPTY_FIELD;
        logEvent(`Champ ${fieldName} invalide sur ${Missions.getAlias(nodeId)}.`, 'warning');
        updateHUD();
    }

    // --- CALCUL FINAL ---
    function completeMission(missionId, timeLeft, totalTime) {
        state.missionEndTime = Date.now();
        const timeUsed = totalTime - timeLeft;
        const timeRatio = timeLeft / totalTime;

        // Score de base
        state.missionBase = SCORE.MISSION_BASE;

        // Bonus vitesse
        state.bonusSpeed = Math.round(timeLeft * SCORE.SPEED_MULTIPLIER * (1 + timeRatio));

        // Bonus précision (0 erreur = max, dégressif)
        if (state.errors === 0) {
            state.bonusPrecision = SCORE.MAX_PRECISION_BONUS;
        } else if (state.errors <= 2) {
            state.bonusPrecision = Math.round(SCORE.MAX_PRECISION_BONUS * 0.6);
        } else if (state.errors <= 5) {
            state.bonusPrecision = Math.round(SCORE.MAX_PRECISION_BONUS * 0.2);
        } else {
            state.bonusPrecision = 0;
        }

        // Bonus tactique
        state.bonusTactical = 0;
        if (state.hintsUsed === 0) state.bonusTactical += SCORE.TACTICAL_NO_HINT;
        if (state.pingAttempts <= 1) state.bonusTactical += SCORE.TACTICAL_OPTIMAL_ROUTE;
        if (state.errors === 0) state.bonusTactical += SCORE.TACTICAL_CLEAN_CONFIG;

        // Bonus combo
        state.bonusCombo = state.maxCombo * SCORE.COMBO_MULTIPLIER;

        // Bonus premier essai
        state.bonusFirstTry = state.isFirstAttempt ? SCORE.FIRST_TRY_BONUS : 0;

        // Score total
        state.totalScore = Math.max(0,
            state.missionBase +
            state.bonusSpeed +
            state.bonusPrecision +
            state.bonusTactical +
            state.bonusCombo +
            state.bonusFirstTry -
            state.penalties
        );

        // Mise à jour profil
        profile.cumulScore += state.totalScore;
        profile.missionsCompleted++;
        profile.currentStreak++;
        if (profile.currentStreak > profile.bestStreak) profile.bestStreak = profile.currentStreak;

        const prevBest = profile.bestScores[missionId] || 0;
        if (state.totalScore > prevBest) profile.bestScores[missionId] = state.totalScore;

        const prevTime = profile.bestTimes[missionId] || Infinity;
        if (timeUsed < prevTime) profile.bestTimes[missionId] = timeUsed;

        // Médaille
        let medal = null;
        if (state.totalScore >= MEDALS.distinction.min) medal = 'distinction';
        else if (state.totalScore >= MEDALS.or.min) medal = 'or';
        else if (state.totalScore >= MEDALS.argent.min) medal = 'argent';
        else if (state.totalScore >= MEDALS.bronze.min) medal = 'bronze';
        if (medal) {
            const prev = profile.medals[missionId];
            const order = ['bronze', 'argent', 'or', 'distinction'];
            if (!prev || order.indexOf(medal) > order.indexOf(prev)) {
                profile.medals[missionId] = medal;
            }
        }

        // Rang
        profile.rank = computeRank();
        saveProfile(profile);

        return buildDebriefData(missionId, timeUsed, timeLeft, totalTime, prevBest);
    }

    function failMission() {
        profile.missionsAttempted++;
        profile.currentStreak = 0;
        saveProfile(profile);
    }

    // --- DEBRIEF ---
    function buildDebriefData(missionId, timeUsed, timeLeft, totalTime, prevBest) {
        const mention = getMention(state.totalScore);
        const medal = getMedal(state.totalScore);
        const isNewBest = state.totalScore > prevBest;
        const mission = Missions.get(missionId);

        // Feedback pédagogique
        let strength = 'Bonne maîtrise de la configuration réseau.';
        let weakness = '';
        let advice = '';

        if (state.errors === 0 && state.pingAttempts <= 1) {
            strength = 'Configuration sans erreur au premier essai. Excellent diagnostic réseau.';
        } else if (state.errors === 0) {
            strength = 'Aucune erreur de configuration. Méthodologie rigoureuse.';
        }

        if (state.errors > 3) {
            weakness = 'Nombre élevé d\'erreurs de configuration.';
            advice = 'Revoir les fondamentaux de l\'adressage IP et du masquage.';
        } else if (state.pingAttempts > 3) {
            weakness = 'Trop de tentatives de diagnostic nécessaires.';
            advice = 'Vérifier chaque configuration avant de lancer un test de connectivité.';
        } else if (timeLeft < totalTime * 0.15) {
            weakness = 'Délai critique. Intervention trop lente.';
            advice = 'S\'entraîner à planifier l\'adressage avant de configurer.';
        }

        if (!weakness) weakness = 'Aucun point faible majeur identifié.';
        if (!advice) advice = 'Maintenir ce niveau de performance.';

        return {
            missionName: mission ? mission.name : `Mission ${missionId}`,
            timeUsed, timeLeft, totalTime,
            base: state.missionBase,
            bonusSpeed: state.bonusSpeed,
            bonusPrecision: state.bonusPrecision,
            bonusTactical: state.bonusTactical,
            bonusCombo: state.bonusCombo,
            bonusFirstTry: state.bonusFirstTry,
            penalties: state.penalties,
            totalScore: state.totalScore,
            errors: state.errors,
            maxCombo: state.maxCombo,
            pingAttempts: state.pingAttempts,
            mention, medal, isNewBest, prevBest,
            rank: RANKS.find(r => r.id === profile.rank),
            strength, weakness, advice,
            streak: profile.currentStreak,
            cumulScore: profile.cumulScore
        };
    }

    // --- UTILITAIRES ---
    function getMention(score) {
        let m = MENTIONS[0];
        for (const mention of MENTIONS) {
            if (score >= mention.min) m = mention;
        }
        return m;
    }

    function getMedal(score) {
        if (score >= MEDALS.distinction.min) return MEDALS.distinction;
        if (score >= MEDALS.or.min) return MEDALS.or;
        if (score >= MEDALS.argent.min) return MEDALS.argent;
        if (score >= MEDALS.bronze.min) return MEDALS.bronze;
        return null;
    }

    function computeRank() {
        let r = RANKS[0];
        for (const rank of RANKS) {
            if (profile.cumulScore >= rank.minCumul && profile.missionsCompleted >= rank.minMissions) r = rank;
        }
        return r.id;
    }

    function getMentionProvisoire() {
        return getMention(state.score + state.missionBase);
    }

    // --- HUD UPDATE ---
    function updateHUD() {
        const el = (id) => document.getElementById(id);
        if (el('hud-score-value')) el('hud-score-value').textContent = Math.max(0, state.score);
        if (el('hud-combo-value')) el('hud-combo-value').textContent = state.combo > 0 ? 'x' + state.combo : '-';
        if (el('hud-errors-value')) el('hud-errors-value').textContent = state.errors;
        if (el('hud-mention-value')) {
            const m = getMentionProvisoire();
            el('hud-mention-value').textContent = m.label;
        }
        if (el('hud-rank-value')) {
            const r = RANKS.find(rk => rk.id === profile.rank);
            if (r) el('hud-rank-value').textContent = r.label;
        }

        // Animation combo si élevé
        const comboEl = el('hud-combo-value');
        if (comboEl && state.combo >= 3) {
            comboEl.classList.add('combo-hot');
            setTimeout(() => comboEl.classList.remove('combo-hot'), 400);
        }
    }

    // --- BONUS ---
    function addBonusToProfile(amount) {
        if (amount > 0) {
            profile.cumulScore += amount;
            state.totalScore += amount;
            saveProfile(profile);
        }
    }

    // --- API PUBLIQUE ---
    return {
        startMission,
        completeMission,
        failMission,
        onConfigSaved,
        onRouteAdded,
        onPingAttempt,
        onFieldError,
        logEvent,
        updateHUD,
        addBonusToProfile,
        getState: () => state,
        getProfile: () => profile,
        getMention,
        getMedal,
        MENTIONS,
        MEDALS,
        RANKS
    };
})();
