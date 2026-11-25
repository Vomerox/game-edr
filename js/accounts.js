// ==========================================
// GAME EDR - SYSTÈME DE COMPTES UTILISATEURS
// ==========================================

const Accounts = (() => {
    const API_URL = 'accounts/api.php';
    const LS_KEY = 'gameedr_accounts';

    // --- État courant ---
    let currentUser = null;   // null = anonyme, sinon { login, last_unlocked_level, validated_levels, progression_data, score }
    let useLocalStorage = false; // true si le serveur PHP est indisponible

    // =====================
    // FALLBACK localStorage
    // =====================

    function lsLoadUsers() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return { users: [] };
    }

    function lsSaveUsers(data) {
        try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) {}
    }

    // SHA-256 côté client (fallback quand PHP indisponible)
    async function sha256(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // =====================
    // API SERVEUR
    // =====================

    async function apiCall(action, body) {
        try {
            const url = body && action !== 'load_progress'
                ? `${API_URL}?action=${action}`
                : `${API_URL}?action=${action}${body && body.login ? '&login=' + encodeURIComponent(body.login) : ''}`;

            const opts = action === 'load_progress'
                ? { method: 'GET' }
                : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };

            const resp = await fetch(url, opts);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            return await resp.json();
        } catch (e) {
            return null; // serveur indisponible
        }
    }

    // Teste si le serveur PHP est joignable
    async function checkServer() {
        const result = await apiCall('ping', {});
        // ping retourne une erreur "Action inconnue" mais c'est du JSON valide = serveur OK
        useLocalStorage = (result === null);
    }

    // =====================
    // FONCTIONS PRINCIPALES
    // =====================

    // Connexion / création automatique
    async function authenticate(login, password) {
        if (!useLocalStorage) {
            // --- Mode serveur PHP ---
            const result = await apiCall('login', { login, password });
            if (!result) {
                // Serveur tombé en cours de session, bascule localStorage
                useLocalStorage = true;
                return authenticate(login, password);
            }
            if (result.ok) {
                currentUser = result.user;
                return { ok: true, created: result.created, message: result.message };
            }
            return { ok: false, error: result.error };
        }

        // --- Mode localStorage (fallback) ---
        const data = lsLoadUsers();
        const idx = data.users.findIndex(u => u.login.toLowerCase() === login.toLowerCase());

        if (idx === -1) {
            // Création du compte
            const salt = login.toLowerCase() + '_gameedr';
            const hash = await sha256(salt + password);
            const newUser = {
                login: login,
                password_hash: hash,
                last_unlocked_level: 1,
                validated_levels: [],
                progression_data: {},
                score: 0
            };
            data.users.push(newUser);
            lsSaveUsers(data);
            currentUser = { login: newUser.login, last_unlocked_level: 1, validated_levels: [], progression_data: {}, score: 0 };
            return { ok: true, created: true, message: 'Compte créé avec succès.' };
        }

        // Vérification du mot de passe
        const salt = data.users[idx].login.toLowerCase() + '_gameedr';
        const hash = await sha256(salt + password);
        if (hash === data.users[idx].password_hash) {
            const u = data.users[idx];
            currentUser = {
                login: u.login,
                last_unlocked_level: u.last_unlocked_level || 1,
                validated_levels: u.validated_levels || [],
                progression_data: u.progression_data || {},
                score: u.score || 0
            };
            return { ok: true, created: false, message: 'Connexion réussie.' };
        }

        return { ok: false, error: 'Mot de passe incorrect.' };
    }

    // Déconnexion
    function logout() {
        currentUser = null;
        // Effacer la session de reconnexion auto
        try { localStorage.removeItem('gameedr_session'); } catch(e) {}
        updateAccountIndicator();
    }

    // Sauvegarde de la progression
    async function saveProgress() {
        if (!currentUser) return;

        if (!useLocalStorage) {
            await apiCall('save_progress', {
                login: currentUser.login,
                last_unlocked_level: currentUser.last_unlocked_level,
                validated_levels: currentUser.validated_levels,
                progression_data: currentUser.progression_data,
                score: currentUser.score
            });
        } else {
            const data = lsLoadUsers();
            const idx = data.users.findIndex(u => u.login.toLowerCase() === currentUser.login.toLowerCase());
            if (idx !== -1) {
                data.users[idx].last_unlocked_level = currentUser.last_unlocked_level;
                data.users[idx].validated_levels = currentUser.validated_levels;
                data.users[idx].progression_data = currentUser.progression_data;
                data.users[idx].score = currentUser.score;
                lsSaveUsers(data);
            }
        }
    }

    // Valide un niveau et débloque le suivant
    async function completeLevel(levelNum, score) {
        if (!currentUser) return;

        // Ajouter le niveau aux niveaux validés (sans doublons)
        if (!currentUser.validated_levels.includes(levelNum)) {
            currentUser.validated_levels.push(levelNum);
            currentUser.validated_levels.sort((a, b) => a - b);
        }

        // Débloquer le niveau suivant
        const nextLevel = levelNum + 1;
        if (nextLevel <= 10 && nextLevel > currentUser.last_unlocked_level) {
            currentUser.last_unlocked_level = nextLevel;
        }

        // Mettre à jour le score cumulé
        currentUser.score += score;

        // Sauvegarder les données de progression par niveau
        if (!currentUser.progression_data[levelNum] || score > currentUser.progression_data[levelNum]) {
            currentUser.progression_data[levelNum] = score;
        }

        await saveProgress();
    }

    // Vérifie si un niveau est débloqué pour l'utilisateur connecté
    function isLevelUnlocked(levelNum) {
        if (!currentUser) return false;
        if (levelNum === 1) return true;
        return levelNum <= currentUser.last_unlocked_level;
    }

    // Vérifie si un niveau est validé (complété)
    function isLevelValidated(levelNum) {
        if (!currentUser) return false;
        return currentUser.validated_levels.includes(levelNum);
    }

    // Retourne le statut d'un niveau pour l'affichage
    function getLevelStatus(levelNum) {
        if (!currentUser) return 'locked';
        if (currentUser.validated_levels.includes(levelNum)) return 'completed';
        if (levelNum <= currentUser.last_unlocked_level) return 'unlocked';
        return 'locked';
    }

    // --- Indicateur de connexion dans l'UI (compact, coin supérieur droit) ---
    function updateAccountIndicator() {
        const el = document.getElementById('account-indicator');
        if (!el) return;
        if (currentUser) {
            el.innerHTML = `<span class="account-user"><span class="account-user-icon">&#128100;</span> <strong>${currentUser.login.toUpperCase()}</strong></span>`;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
            el.innerHTML = '';
        }
    }

    // --- Initialisation (teste le serveur) ---
    async function init() {
        await checkServer();
    }

    // --- API publique ---
    return {
        init,
        authenticate,
        logout,
        saveProgress,
        completeLevel,
        isLevelUnlocked,
        isLevelValidated,
        getLevelStatus,
        updateAccountIndicator,
        isLoggedIn: () => currentUser !== null,
        getUser: () => currentUser,
        getLogin: () => currentUser ? currentUser.login : null
    };
})();
