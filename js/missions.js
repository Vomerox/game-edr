// ==========================================
// GAME EDR - DONNÉES MISSIONS MILITAIRES
// ==========================================

const Missions = (() => {

    // --- ALIAS IMMERSIFS DES NOEUDS ---
    const NODE_ALIASES = {
        'PC_Alpha':   'Poste ALPHA',
        'PC_Bravo':   'Poste BRAVO',
        'Routeur_1':  'Relais RAVEN',
        'Routeur_2':  'Noeud SIERRA',
        'Routeur_3':  'Point TANGO'
    };

    // --- DONNÉES MISSIONS ---
    const MISSIONS = {
        1: {
            name: 'OPÉRATION WIRE FALCON',
            codeName: 'WIRE FALCON',
            brief: {
                situation: 'Le poste ALPHA et le poste BRAVO sont isolés suite à une coupure de liaison. Un relais RAVEN est disponible en position intermédiaire.',
                mission: 'Rétablir la communication bidirectionnelle entre ALPHA et BRAVO via le relais RAVEN.',
                execution: 'Configurer l\'adressage IP sur chaque équipement. Attribuer les passerelles correctes aux postes terminaux.',
                contraintes: 'Pas de routes statiques nécessaires. Configuration directe uniquement.',
                delai: '2 minutes - Fenêtre opérationnelle limitée.'
            },
            objectives: {
                primary: 'Rétablir la liaison ALPHA ↔ BRAVO',
                secondary: ['Configurer sans erreur', 'Terminer en moins de 90 secondes']
            },
            thresholds: { bronze: 700, argent: 1200, or: 1800, distinction: 2500 },
            tips: [
                'Les deux postes doivent être dans des réseaux différents, reliés par le routeur.',
                'Chaque poste doit avoir comme passerelle l\'IP du routeur côté de son réseau.'
            ]
        },
        2: {
            name: 'OPÉRATION DEEP RELAY',
            codeName: 'DEEP RELAY',
            brief: {
                situation: 'La distance entre les postes nécessite un relais intermédiaire supplémentaire. Deux relais sont déployés : RAVEN et SIERRA.',
                mission: 'Assurer la transmission des paquets entre ALPHA et BRAVO à travers deux relais consécutifs.',
                execution: 'Configurer les interfaces des relais, les passerelles des postes, et ajouter les routes statiques nécessaires sur chaque relais.',
                contraintes: 'Chaque relais doit connaître les réseaux distants via des routes statiques.',
                delai: '3 minutes.'
            },
            objectives: {
                primary: 'Rétablir la chaîne ALPHA → RAVEN → SIERRA → BRAVO',
                secondary: ['Utiliser des routes statiques correctes', 'Aucune erreur de masque']
            },
            thresholds: { bronze: 800, argent: 1400, or: 2000, distinction: 2800 },
            tips: [
                'Trois sous-réseaux distincts sont nécessaires.',
                'Chaque routeur a besoin d\'une route vers le réseau qu\'il ne voit pas directement.'
            ]
        },
        3: {
            name: 'OPÉRATION CHAIN COMMAND',
            codeName: 'CHAIN COMMAND',
            brief: {
                situation: 'Le centre de commandement a déployé trois relais en série pour couvrir une zone étendue. La chaîne RAVEN → SIERRA → TANGO doit être opérationnelle.',
                mission: 'Configurer l\'intégralité de la chaîne de transmission à 3 relais.',
                execution: 'Adresser toutes les interfaces. Chaque relais doit connaître TOUS les réseaux distants via des routes statiques.',
                contraintes: 'Aucun réseau ne peut rester inconnu d\'un relais.',
                delai: '4 minutes.'
            },
            objectives: {
                primary: 'Liaison complète sur 3 relais en série',
                secondary: ['Tables de routage complètes', 'Pas de boucle']
            },
            thresholds: { bronze: 900, argent: 1600, or: 2200, distinction: 3000 },
            tips: [
                'Quatre sous-réseaux distincts sont nécessaires.',
                'Le relais central (SIERRA) doit avoir des routes vers les deux extrémités.'
            ]
        },
        4: {
            name: 'OPÉRATION NARROW BAND',
            codeName: 'NARROW BAND',
            brief: {
                situation: 'Les ressources IP sont limitées. Le commandement impose l\'utilisation de masques restrictifs (/26 ou /30) pour économiser les adresses.',
                mission: 'Rétablir les communications en respectant les contraintes de subnetting.',
                execution: 'Utiliser des masques /26 (255.255.255.192) ou /30 (255.255.255.252) pour les liaisons inter-relais.',
                contraintes: 'Les masques larges (/24) sont interdits entre les relais.',
                delai: '4 minutes.'
            },
            objectives: {
                primary: 'Liaison fonctionnelle en subnetting',
                secondary: ['Utiliser des masques /26 ou /30', 'Économiser les adresses']
            },
            thresholds: { bronze: 900, argent: 1500, or: 2200, distinction: 3000 },
            tips: [
                'Un masque /30 ne permet que 2 adresses utilisables (idéal point à point).',
                'Un masque /26 offre 62 adresses par sous-réseau.'
            ]
        },
        5: {
            name: 'OPÉRATION TRIANGLE FORCE',
            codeName: 'TRIANGLE FORCE',
            brief: {
                situation: 'La topologie déployée forme un triangle. Trois relais interconnectés offrent de la redondance mais complexifient le routage.',
                mission: 'Assurer un chemin fonctionnel entre ALPHA et BRAVO à travers une topologie triangulaire.',
                execution: 'Configurer les interfaces de chaque relais et définir les routes statiques avec précision pour éviter les boucles.',
                contraintes: 'Le routage doit être parfait. Aucune boucle tolérée.',
                delai: '5 minutes.'
            },
            objectives: {
                primary: 'Traverser la topologie triangulaire sans boucle',
                secondary: ['Routage optimal', 'Configuration en moins de 3 minutes']
            },
            thresholds: { bronze: 1000, argent: 1800, or: 2500, distinction: 3200 },
            tips: [
                'Attention aux boucles de routage dans une topologie maillée.',
                'Définir un chemin précis et y adapter les routes.'
            ]
        },
        6: {
            name: 'OPÉRATION CARRÉ TACTIQUE',
            codeName: 'CARRÉ TACTIQUE',
            brief: {
                situation: 'Le relais RAVEN dispose de 3 interfaces et distribue vers deux routes : SIERRA (sud) et TANGO (nord). Un seul chemin mène à BRAVO.',
                mission: 'Configurer le routage sur un réseau en carré avec distribution à 3 voies.',
                execution: 'RAVEN distribue vers SIERRA et TANGO. Un seul des deux chemins atteint BRAVO. Configurer les routes statiques en conséquence.',
                contraintes: 'Topologie en carré. Le routeur distributeur a 3 interfaces.',
                delai: '6 minutes.'
            },
            objectives: {
                primary: 'Liaison ALPHA → BRAVO via distribution et routage',
                secondary: ['Routage sans conflit', 'Configuration du distributeur à 3 interfaces']
            },
            thresholds: { bronze: 900, argent: 1600, or: 2300, distinction: 3100 },
            tips: [
                'RAVEN a 3 interfaces : une vers ALPHA, une vers SIERRA, une vers TANGO.',
                'Seul le chemin via TANGO mène à BRAVO. Adaptez vos routes.'
            ]
        },
        7: {
            name: 'OPÉRATION ÉTOILE',
            codeName: 'ÉTOILE',
            brief: {
                situation: 'Trois relais en série avec un hub central (SIERRA) à 3 interfaces. La chaîne RAVEN → SIERRA → TANGO doit être opérationnelle.',
                mission: 'Configurer la chaîne de 3 relais en étoile pour relier ALPHA à BRAVO.',
                execution: 'SIERRA dispose de 3 interfaces. Configurer le routage pour que le trafic traverse les 3 relais.',
                contraintes: 'Le routeur central est le point névralgique. 4 sous-réseaux distincts.',
                delai: '6 minutes.'
            },
            objectives: {
                primary: 'Liaison complète ALPHA → RAVEN → SIERRA → TANGO → BRAVO',
                secondary: ['Routes complètes sur le hub central', 'Zéro erreur de masque']
            },
            thresholds: { bronze: 900, argent: 1600, or: 2300, distinction: 3100 },
            tips: [
                'Le routeur central SIERRA a 3 interfaces et doit connaître les réseaux des extrémités.',
                'Chaque routeur doit router vers tous les réseaux distants.'
            ]
        },
        8: {
            name: 'OPÉRATION RÉSEAU EN T',
            codeName: 'RÉSEAU EN T',
            brief: {
                situation: 'Déploiement urbain nocturne. Le réseau forme un T : une ligne principale ALPHA-RAVEN-SIERRA-BRAVO avec une branche latérale vers TANGO.',
                mission: 'Configurer la ligne principale et la branche latérale. SIERRA est le point de jonction.',
                execution: 'SIERRA dispose de 3 interfaces (ligne principale + branche latérale). Tous les réseaux doivent se connaître.',
                contraintes: 'Environnement nocturne. Concentration maximale requise.',
                delai: '7 minutes.'
            },
            objectives: {
                primary: 'Ligne principale + branche latérale opérationnelles',
                secondary: ['Routage multi-directionnel sur SIERRA', 'Branche latérale accessible']
            },
            thresholds: { bronze: 1000, argent: 1700, or: 2400, distinction: 3200 },
            tips: [
                'SIERRA a 3 interfaces : Eth0 vers RAVEN, Eth1 vers BRAVO, Eth2 vers la branche TANGO.',
                'La branche TANGO n\'est pas sur le chemin principal — mais TANGO doit pouvoir joindre tous les réseaux.'
            ]
        },
        9: {
            name: 'OPÉRATION LOSANGE',
            codeName: 'LOSANGE',
            brief: {
                situation: 'Topologie en losange : RAVEN distribue vers SIERRA (nord) et TANGO (sud). Seul un chemin mène à BRAVO via SIERRA.',
                mission: 'Configurer le routage en losange. RAVEN distribue, SIERRA est la sortie vers BRAVO.',
                execution: 'RAVEN dispose de 3 interfaces. Les routes doivent diriger le trafic correctement.',
                contraintes: 'Architecture de redondance partielle. Le bon chemin doit être choisi.',
                delai: '7 minutes.'
            },
            objectives: {
                primary: 'Liaison ALPHA → BRAVO via le losange',
                secondary: ['Pas de boucle de routage', 'Routes optimales']
            },
            thresholds: { bronze: 1000, argent: 1700, or: 2400, distinction: 3200 },
            tips: [
                'RAVEN est le point de divergence avec 3 interfaces (Eth0=ALPHA, Eth1=SIERRA, Eth2=TANGO).',
                'Le chemin vers BRAVO passe par SIERRA. TANGO est un cul-de-sac à configurer correctement.'
            ]
        },
        10: {
            name: 'OPÉRATION DERNIER MAILLON',
            codeName: 'DERNIER MAILLON',
            brief: {
                situation: 'Épreuve finale de certification EDR. Réseau maillé : 3 routeurs interconnectés avec liaisons croisées (RAVEN↔SIERRA, RAVEN↔TANGO, SIERRA↔TANGO). La topologie la plus complexe.',
                mission: 'Configurer et valider un réseau maillé complet sans aide et sans erreur.',
                execution: 'RAVEN (3 interfaces) et TANGO (3 interfaces) forment le cœur du maillage. Chaque routeur doit connaître tous les réseaux distants.',
                contraintes: 'Examen final. Zéro droit à l\'erreur. Distinction visée. Pas d\'indication supplémentaire.',
                delai: '8 minutes.'
            },
            objectives: {
                primary: 'Certification EDR - Réseau maillé parfait',
                secondary: ['Score Distinction', 'Temps record', 'Zéro erreur']
            },
            thresholds: { bronze: 1100, argent: 1900, or: 2700, distinction: 3500 },
            tips: ['Tout repose sur vous, Sergent. Planifiez votre adressage avant de configurer.']
        }
    };

    // --- API ---
    function get(missionId) {
        return MISSIONS[missionId] || null;
    }

    function getAlias(nodeId) {
        return NODE_ALIASES[nodeId] || nodeId;
    }

    function getBriefHTML(missionId) {
        const m = MISSIONS[missionId];
        if (!m) return '';
        const b = m.brief;
        return `
            <div class="brief-video-row">
                <video class="brief-video" autoplay loop muted playsinline>
                    <source src="assets/breifing.mp4" type="video/mp4">
                </video>
                <div class="brief-video-label">TRANSMISSION EN COURS</div>
            </div>
            <div class="brief-header">${m.codeName}</div>
            <div class="brief-name">${m.name}</div>
            <div class="brief-section"><span class="brief-label">SITUATION :</span> ${b.situation}</div>
            <div class="brief-section"><span class="brief-label">MISSION :</span> ${b.mission}</div>
            <div class="brief-section"><span class="brief-label">EXÉCUTION :</span> ${b.execution}</div>
            <div class="brief-section"><span class="brief-label">CONTRAINTES :</span> ${b.contraintes}</div>
            <div class="brief-section"><span class="brief-label">DÉLAI :</span> ${b.delai}</div>
            <div class="brief-objectives">
                <span class="brief-label">OBJECTIF PRINCIPAL :</span> ${m.objectives.primary}
            </div>
        `;
    }

    function getDebriefHTML(data) {
        const fmtTime = (s) => {
            const m = Math.floor(s / 60);
            const sec = s % 60;
            return `${m}m ${sec.toString().padStart(2,'0')}s`;
        };

        const medalHTML = data.medal ?
            `<div class="debrief-medal">${data.medal.icon} ${data.medal.label}</div>` :
            `<div class="debrief-medal debrief-no-medal">Aucune médaille</div>`;

        const newBestHTML = data.isNewBest ?
            `<div class="debrief-newbest">★ NOUVEAU RECORD PERSONNEL ★</div>` : '';

        const prevBestHTML = data.prevBest > 0 ?
            `<div class="debrief-prev">Précédent meilleur : ${data.prevBest} pts</div>` : '';

        return `
            <div class="debrief-title">${data.missionName}</div>
            <div class="debrief-subtitle">RAPPORT DE MISSION</div>
            ${medalHTML}
            ${newBestHTML}

            <div class="debrief-grid">
                <div class="debrief-row">
                    <span>Temps utilisé</span><span>${fmtTime(data.timeUsed)}</span>
                </div>
                <div class="debrief-row">
                    <span>Temps restant</span><span class="debrief-good">${fmtTime(data.timeLeft)}</span>
                </div>
                <div class="debrief-row debrief-sep">
                    <span>Score mission</span><span>+${data.base}</span>
                </div>
                <div class="debrief-row">
                    <span>Bonus vitesse</span><span class="debrief-good">+${data.bonusSpeed}</span>
                </div>
                <div class="debrief-row">
                    <span>Bonus précision</span><span class="debrief-good">+${data.bonusPrecision}</span>
                </div>
                <div class="debrief-row">
                    <span>Bonus tactique</span><span class="debrief-good">+${data.bonusTactical}</span>
                </div>
                <div class="debrief-row">
                    <span>Bonus combo (x${data.maxCombo})</span><span class="debrief-good">+${data.bonusCombo}</span>
                </div>
                ${data.bonusFirstTry > 0 ? `<div class="debrief-row"><span>Bonus 1er essai</span><span class="debrief-good">+${data.bonusFirstTry}</span></div>` : ''}
                <div class="debrief-row debrief-penalty">
                    <span>Pénalités (${data.errors} erreurs)</span><span>-${data.penalties}</span>
                </div>
                ${data.bonusMission !== undefined ? `
                <div class="debrief-row debrief-sep" style="border-top:2px solid #3a6a2e;">
                    <span>Bonus épreuve supplémentaire</span><span class="debrief-good">+${data.bonusMission}</span>
                </div>
                <div class="debrief-row">
                    <span>Bonus temps restant</span><span class="debrief-good">+${data.bonusTimeBonus}</span>
                </div>
                ` : ''}
                <div class="debrief-row debrief-total">
                    <span>SCORE FINAL</span><span>${data.totalScore}</span>
                </div>
            </div>

            ${prevBestHTML}

            <div class="debrief-mention">Mention : ${data.mention.icon} ${data.mention.label}</div>
            <div class="debrief-rank">Rang : ${data.rank.label}</div>
            <div class="debrief-streak">Série de réussites : ${data.streak}</div>

            <div class="debrief-feedback">
                <div class="debrief-fb-title">RETOUR PÉDAGOGIQUE</div>
                <div class="debrief-fb-row"><span class="brief-label">POINT FORT :</span> ${data.strength}</div>
                <div class="debrief-fb-row"><span class="brief-label">POINT FAIBLE :</span> ${data.weakness}</div>
                <div class="debrief-fb-row"><span class="brief-label">CONSEIL :</span> ${data.advice}</div>
            </div>
        `;
    }

    return { get, getAlias, getBriefHTML, getDebriefHTML, NODE_ALIASES, MISSIONS };
})();
