// ==========================================
// GAME EDR - MODULE HIGH SCORES (Arcade)
// Style: Borne d'arcade rétro années 80
// ==========================================

const HighScores = (() => {

    // --- Configuration ---
    const API_URL = 'score/api.php';
    const FALLBACK_KEY = 'gameedr_highscores';
    const MEDAL_ICONS = {
        bronze: '\u25C6',       // ◆
        argent: '\u2605',       // ★
        or: '\u2605\u2605',     // ★★
        distinction: '\u2605\u2605\u2605' // ★★★
    };

    // --- État ---
    let useLocalStorage = false;

    // =============================================
    // API COMMUNICATION
    // =============================================

    function init() {
        // Tester la disponibilité du PHP
        fetch(API_URL + '?action=ping', { method: 'GET' })
            .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(data => {
                if (data.success) {
                    useLocalStorage = false;
                    console.log('[HighScores] API PHP disponible.');
                } else {
                    throw new Error('API error');
                }
            })
            .catch(() => {
                useLocalStorage = true;
                console.warn('[HighScores] API PHP indisponible. Fallback localStorage.');
            });
    }

    function fetchScores(levelId) {
        if (useLocalStorage) {
            return Promise.resolve(getLocalScores(levelId));
        }
        return fetch(API_URL + '?action=get&level=' + levelId)
            .then(r => r.json())
            .then(data => {
                if (data.success) return data.scores;
                return [];
            })
            .catch(() => {
                console.warn('[HighScores] Erreur fetch, fallback localStorage.');
                return getLocalScores(levelId);
            });
    }

    function submitScore(levelId, name, score, medal, accountLogin) {
        if (useLocalStorage) {
            return Promise.resolve(saveLocalScore(levelId, name, score, medal, accountLogin));
        }
        return fetch(API_URL + '?action=save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                level: levelId,
                name: name,
                score: score,
                medal: medal,
                account_login: accountLogin || null
            })
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                return {
                    rank: data.rank,
                    isHighScore: data.isHighScore,
                    scores: data.scores
                };
            }
            throw new Error(data.error);
        })
        .catch((err) => {
            console.warn('[HighScores] Erreur submit, fallback localStorage.', err);
            return saveLocalScore(levelId, name, score, medal);
        });
    }

    // =============================================
    // LOCALSTORAGE FALLBACK
    // =============================================

    function getLocalData() {
        try {
            const raw = localStorage.getItem(FALLBACK_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function saveLocalData(data) {
        localStorage.setItem(FALLBACK_KEY, JSON.stringify(data));
    }

    function getLocalScores(levelId) {
        const data = getLocalData();
        const key = String(levelId);
        const scores = data[key] || [];
        return scores.map((s, i) => ({ ...s, rank: i + 1 }));
    }

    function saveLocalScore(levelId, name, score, medal, accountLogin) {
        const data = getLocalData();
        const key = String(levelId);
        if (!data[key]) data[key] = [];

        const newEntry = {
            name: name,
            score: score,
            date: new Date().toISOString(),
            medal: medal,
            account_login: accountLogin || null
        };

        data[key].push(newEntry);

        // Trier : score DESC, date ASC
        data[key].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.date.localeCompare(b.date);
        });

        // Tronquer à 20
        data[key] = data[key].slice(0, 20);

        saveLocalData(data);

        // Trouver le rang
        let rank = -1;
        let isHighScore = false;
        for (let i = 0; i < data[key].length; i++) {
            if (data[key][i].name === name && data[key][i].score === score && data[key][i].date === newEntry.date) {
                rank = i + 1;
                isHighScore = true;
                break;
            }
        }

        return {
            rank: rank > 0 ? rank : 21,
            isHighScore: isHighScore,
            scores: data[key].map((s, i) => ({ ...s, rank: i + 1 }))
        };
    }

    // =============================================
    // CLASSEMENT / LEADERBOARD
    // =============================================

    function showLeaderboard(levelId, highlightName, highlightScore) {
        const overlay = document.getElementById('leaderboard-overlay');
        const tableEl = document.getElementById('lb-table');
        const titleEl = document.getElementById('lb-level-title');

        // Titre de mission
        if (typeof Missions !== 'undefined') {
            const mission = Missions.get(levelId);
            titleEl.textContent = mission ? mission.codeName : ('MISSION ' + levelId);
        } else {
            titleEl.textContent = 'MISSION ' + levelId;
        }

        // Charger et afficher
        tableEl.innerHTML = '<div class="lb-loading">CHARGEMENT...</div>';
        overlay.classList.remove('hidden');

        fetchScores(levelId).then(scores => {
            tableEl.innerHTML = renderLeaderboardRows(scores, highlightName, highlightScore);
        });

        // Bouton retour
        document.getElementById('btn-close-leaderboard').onclick = () => {
            hideLeaderboard();
        };
    }

    function hideLeaderboard() {
        document.getElementById('leaderboard-overlay').classList.add('hidden');
    }

    function renderLeaderboardRows(scores, highlightName, highlightScore) {
        if (!scores || scores.length === 0) {
            return '<div class="lb-empty">AUCUN SCORE ENREGISTR\u00C9</div>';
        }

        let html = '';
        const maxShow = Math.min(scores.length, 10);

        for (let i = 0; i < maxShow; i++) {
            const entry = scores[i];
            const entryDisplayName = entry.account_login ? entry.account_login.toUpperCase() : entry.name;
            const isHL = highlightName && highlightScore
                && (entry.name === highlightName || entryDisplayName === highlightName)
                && entry.score === highlightScore;

            // Nom affiché : login du compte ou nom arcade
            const displayName = entry.account_login ? entry.account_login.toUpperCase() : entry.name;

            // Dots entre nom et score
            const scoreStr = entry.score.toLocaleString('fr-FR');
            const dotsCount = Math.max(2, 28 - displayName.length - scoreStr.length);
            const dots = '.'.repeat(dotsCount);

            // Icône médaille
            const medalHTML = entry.medal && MEDAL_ICONS[entry.medal]
                ? MEDAL_ICONS[entry.medal]
                : '';

            // Couleur du rang (top 3 spécial)
            let rankClass = '';
            if (i === 0) rankClass = 'lb-rank-1';
            else if (i === 1) rankClass = 'lb-rank-2';
            else if (i === 2) rankClass = 'lb-rank-3';

            html += `<div class="lb-row ${isHL ? 'lb-highlight' : ''}" style="animation-delay:${i * 0.1}s">`;
            html += `<span class="lb-rank ${rankClass}">${String(i + 1).padStart(2, ' ')}.</span>`;
            html += `<span class="lb-name">${displayName}</span>`;
            html += `<span class="lb-dots">${dots}</span>`;
            html += `<span class="lb-score-val">${scoreStr}</span>`;
            html += `<span class="lb-medal">${medalHTML}</span>`;
            html += '</div>';
        }

        // "NEW HIGH SCORE" si dans le top 3
        if (highlightName && highlightScore) {
            const playerIdx = scores.findIndex(s => {
                const sName = s.account_login ? s.account_login.toUpperCase() : s.name;
                return (s.name === highlightName || sName === highlightName) && s.score === highlightScore;
            });
            if (playerIdx >= 0 && playerIdx < 3) {
                html += '<div class="lb-new-record">\u2605 NEW HIGH SCORE \u2605</div>';
            }
        }

        return html;
    }

    // Génère le HTML du classement arcade pour l'intégrer dans le debrief
    function renderLeaderboardHTML(scores, highlightName, highlightScore) {
        let html = '<div class="debrief-leaderboard">';
        html += '<div class="scanlines"></div>';
        html += '<div class="debrief-lb-title">\u2605 HIGH SCORES \u2605</div>';
        html += '<div class="lb-table">';
        html += renderLeaderboardRows(scores, highlightName, highlightScore);
        html += '</div></div>';
        return html;
    }

    // =============================================
    // API PUBLIQUE
    // =============================================

    return {
        init,
        fetchScores,
        submitScore,
        showLeaderboard,
        hideLeaderboard,
        renderLeaderboardHTML
    };

})();
