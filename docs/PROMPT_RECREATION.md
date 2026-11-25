# PROMPT DE RECRÉATION COMPLÈTE - GAME EDR

Crée un jeu web éducatif appelé **"GAME EDR"** (Établissement De Routes) pour enseigner le routage IP et la configuration réseau. Le jeu a un thème **militaire cartoon dans un décor de désert**. Il utilise **Three.js** pour la scène 3D, du **JavaScript vanilla** (pas de framework), du **CSS pur**, et une **API PHP** pour les high scores.

---

## ARCHITECTURE DES FICHIERS

```
/index.html          → Page HTML unique
/styles.css          → Styles CSS complets
/css2.css            → Polices Google Fonts (Black Ops One + Share Tech Mono)
/game.js             → Moteur principal (3D, interactions, logique réseau)
/levels.js           → Définitions des 10 niveaux
/missions.js         → Données narratives des missions (briefings, alias, debriefs)
/scoring.js          → Moteur de scoring, progression, persistance localStorage
/highscores.js       → Module high scores arcade (saisie nom 3 lettres, classement, API)
/three.min.js        → Librairie Three.js (incluse localement)
/score/api.php       → API REST PHP pour les scores
/score/.htaccess     → "Options -Indexes"
/score/level_X.json  → Fichiers JSON de scores par niveau (créés dynamiquement)
```

---

## 1. STRUCTURE HTML (`index.html`)

Page unique avec les éléments suivants, tous positionnés en `absolute` ou `fixed` par-dessus le canvas Three.js :

### HUD (toujours visible pendant le jeu) :
- **HUD haut-gauche** (`#hud-top-left`) : titre "GAME EDR" avec effet glitch, titre du niveau (`#level-title`), description (`#level-desc`)
- **HUD haut-droite** (`#hud-top-right`) : chronomètre (`#timer`), bouton "VÉRIFIER LA CONNEXION (PING)" (`#btn-verify`, classe `btn-success pulse`), texte d'aide
- **Barre de score centrale** (`#hud-score-bar`, fixe en haut centré) : 5 indicateurs en flex :
  - SCORE (`#hud-score-value`)
  - COMBO (`#hud-combo-value`)
  - ERREURS (`#hud-errors-value`)
  - MENTION (`#hud-mention-value`)
  - RANG (`#hud-rank-value`)
- **État liaison** (`#hud-status`, bas-gauche) : texte "INTERROMPUE" (rouge clignotant) ou "OPÉRATIONNELLE" (vert)
- **Journal des événements** (`#event-log`, bas-droite) : log scrollable des 8 derniers événements horodatés, avec 4 types de couleur (info=beige, success=vert, error=rouge, warning=jaune)

### Modales de configuration :
- **Modal PC** (`#modal-pc`) : titre dynamique, 3 champs (IP, Masque, Passerelle), boutons ENREGISTRER + FERMER
- **Modal Routeur** (`#modal-router`) : titre dynamique, section INTERFACES (générée dynamiquement selon le nombre d'interfaces du routeur : nom + IP + masque), section TABLE DE ROUTAGE (générée dynamiquement), bouton "+ AJOUTER ROUTE", boutons APPLIQUER + FERMER

### Overlays plein écran :
- **Briefing** (`#briefing-overlay`) : conteneur avec le HTML de mission (situation, mission, exécution, contraintes, délai, objectif), boutons "LANCER LA MISSION" + "CLASSEMENT"
- **Debriefing** (`#debrief-overlay`) : rapport détaillé post-mission (voir section scoring), boutons "MISSION SUIVANTE" + "RECOMMENCER"
- **Game Over** (`#game-over`) : titre glitch "LIAISON PERDUE", stats erreurs/score, bouton RECOMMENCER (recharge la page)
- **Saisie du nom** (`#name-entry-overlay`) : style borne d'arcade, 3 colonnes de caractères avec flèches haut/bas cliquables, navigation clavier (flèches + saisie directe), score affiché, médaille, bouton VALIDER
- **Classement** (`#leaderboard-overlay`) : écran arcade avec scanlines CRT, effet vignette, lignes animées en apparition décalée, top 3 coloré (or/argent/bronze), dots entre nom et score, "NEW HIGH SCORE" clignotant si top 3

### Crédits (bande fixe en bas de page) :
- "GAME EDR" + "Créé par le cours réseaux du groupement informatiques réseaux 2026"

### Scripts chargés dans cet ordre :
1. three.min.js
2. levels.js
3. missions.js
4. scoring.js
5. highscores.js
6. game.js

---

## 2. STYLES CSS (`styles.css`)

### Thème visuel global :
- Fond : `#1a1408` (brun très sombre)
- Police principale : `'Share Tech Mono', monospace`
- Police titres : `'Black Ops One', monospace`
- Couleur texte : `#e8d5a3` (sable/beige)
- Couleur accent : `#d4a84b` (or militaire)
- Bordures : `#8b7355` (brun)
- `user-select: none` sur le body, `overflow: hidden`

### Panels (`.panel`) :
- `position: absolute`, fond semi-transparent `rgba(30, 25, 15, 0.92)`
- Bordure 3px `#8b7355`, border-radius 6px
- Box-shadow avec lueur dorée subtile + ombre interne
- 4 rivets décoratifs dans les coins (radial-gradient de cercles `#5c4a2e` de 3px)

### Timer :
- Police Black Ops One, taille 3em, text-shadow dorée
- Classe `.danger` : couleur rouge `#ff4444`, animation `timerPulse` (scale 1→1.05, 0.5s infinite alternate)
- Se déclenche quand il reste 30 secondes

### Barre de score :
- Position fixe en haut centré, flex horizontal avec gap 2px
- Chaque item : colonne flex, fond `rgba(30,25,15,0.88)`, bordure `#5c4a2e`, pas de border-top, border-radius arrondi en bas
- Couleurs spécifiques : combo=orange, erreurs=rouge, mention=or, rang=vert
- Animation `comboFlash` sur le combo quand >= 3 (scale 1→1.4→1, couleur jaune vif, 0.3s)

### Boutons :
- 4 variantes avec gradients :
  - `.btn-danger` : rouge (`#9b2020` → `#6b0000`), bordure `#ff4444`
  - `.btn-success` : vert (`#4a7a20` → `#2d5a10`), bordure `#7ab530`
  - `.btn-warning` : or (`#c89020` → `#8b6010`), bordure `#daa520`
  - `.btn-action` : fond `#3a3020`, texte `#d4a84b`, bordure `#5c4a2e`
- Tous : `text-transform: uppercase`, `letter-spacing: 1px`, `border-radius: 4px`, `transform: scale(1.03)` au hover
- `.pulse` : animation box-shadow verte pulsante (keyframes 0→70→100%, 2s infinite)

### Modales :
- Centrées (top/left 50%, transform translate -50%/-50%), width 400px, z-index 9999
- Flex column avec gap 8px, max-height 85vh, overflow-y auto
- `.hidden` : `display: none !important`

### Inputs :
- Fond `#1a1408`, bordure `#8b7355`, couleur `#e8d5a3`, police Share Tech Mono
- Focus : bordure `#d4a84b`, box-shadow dorée
- Placeholder : couleur `#5c4a2e`

### Interface et route rows :
- `.route-row`, `.interface-row` : flex, gap 5px, align-items center
- Inputs à 30% de largeur, span du nom d'interface à 40px de large

### Overlays :
- Position fixed couvrant tout l'écran, fond `rgba(15, 5, 0, 0.92)`, z-index 10000
- Flex centré verticalement et horizontalement

### Briefing :
- Conteneur 560px, max-height 85vh, texte aligné à gauche
- Classes `.brief-header` (petite, grise, lettres espacées), `.brief-name` (grande, dorée), `.brief-section` (beige), `.brief-label` (or, bold)
- `.brief-objectives` : encadré avec bordure et fond semi-transparent

### Debriefing :
- Conteneur 520px, max-height 88vh
- Grille de statistiques avec lignes alternées, séparateurs, couleurs vert/rouge
- Ligne total en or avec fond accentué et bordure dorée
- Section feedback pédagogique encadrée
- Classement intégré en bas avec style arcade (fond `#0a0a08`, scanlines, effet CRT)

### Saisie du nom (arcade) :
- Conteneur 440px, fond noir `rgba(10,10,8,0.96)`, bordure `#333`
- Titre "ENTER YOUR NAME" en vert néon `#00ff44` avec text-shadow lumineux
- Caractères : boîtes 72x92px, police 3.5em, vert néon, fond `#080808`, bordure `#2a2a2a`
- Caractère actif : bordure verte, box-shadow verte, animation blink
- Flèches : couleur `#3a5a2a`, hover vert néon

### Classement (arcade) :
- Écran arcade 520px, fond `#0a0a08`, bordure `#2a2a2a`, border-radius 14px
- Scanlines CRT : repeating-linear-gradient de bandes horizontales semi-transparentes
- Vignette CRT : radial-gradient via `::after`
- Header "HIGH SCORES" en orange néon `#ffaa00`
- Lignes : animation `rowAppear` décalée (0.1s * index), vert `#00cc44`
- Top 3 : or `#ffd700`, argent `#c0c0c0`, bronze `#cd7f32`
- Dots entre nom et score, score en jaune `#ffdd44`
- Ligne du joueur mise en avant : fond vert subtil, bordure gauche verte
- "NEW HIGH SCORE" clignotant en jaune

### Scrollbars personnalisées : largeur 4-6px, thumb `#5c4a2e`, track `#1a1408`

### Polices (`css2.css`) :
- Charger `Black Ops One` et `Share Tech Mono` depuis Google Fonts (format woff2) via `@font-face`. L'import se fait via `@import url(...)` dans styles.css pointant vers le fichier css2.css hébergé localement ou via Google Fonts CDN.

---

## 3. DÉFINITION DES NIVEAUX (`levels.js`)

Variable globale `const levels = [...]` contenant 10 niveaux. Chaque niveau :

```javascript
{
    id: Number,          // 1 à 10
    time: Number,        // Temps en secondes (120 à 300)
    title: String,       // "Niveau X : Nom"
    desc: String,        // Description courte
    nodes: [...],        // Équipements réseau
    links: [...]         // Connexions physiques (câbles)
}
```

### Types de nœuds :
- **PC** : `{ id: "PC_Alpha"|"PC_Bravo", type: "pc", pos: {x, z}, config: { ip:"", mask:"", gw:"" } }`
- **Routeur** : `{ id: "Routeur_X", type: "router", pos: {x, z}, interfaces: [{name: "EthX", ip:"", mask:""}], routes: [] }`

### Types de liens :
```javascript
{ n1: "nodeId", int1: "EthX"|null, n2: "nodeId", int2: "EthX"|null }
```
- `int1`/`int2` = null pour les PC (ils n'ont qu'une interface implicite)
- Pour les routeurs, spécifie quelle interface Ethernet est connectée

### Les 10 niveaux :

1. **Routage Direct** (120s) : PC_Alpha → Routeur_1 (2 interfaces) → PC_Bravo. Pas de routes statiques nécessaires.
2. **Relais Intermédiaire** (180s) : PC_Alpha → Routeur_1 → Routeur_2 → PC_Bravo. Routes statiques nécessaires sur chaque routeur.
3. **Chaîne de Commandement** (240s) : PC_Alpha → Routeur_1 → Routeur_2 → Routeur_3 → PC_Bravo. 3 routeurs en série, chacun doit connaître tous les réseaux distants. Le Routeur_2 est positionné en décalage `z:10`.
4. **Subnetting** (240s) : Même topologie que N2 mais avec masques /26 ou /30.
5. **Triangulation** (300s) : Topologie en triangle. Routeur_2 a 3 interfaces (Eth0, Eth1, Eth2). PC_Alpha et PC_Bravo à z:-10, Routeur_2 à z:10.
6-10. **Niveaux d'entraînement** (300s chacun) : Topologie simple PC→Routeur→PC, mêmes titres respectifs : "Goulot d'étranglement", "Opération Alpha", "Embuscade", "Redondance", "Examen Final".

---

## 4. MISSIONS (`missions.js`)

Module IIFE `const Missions = (() => { ... })()` exposant : `get`, `getAlias`, `getBriefHTML`, `getDebriefHTML`, `NODE_ALIASES`, `MISSIONS`.

### Alias des nœuds :
```
PC_Alpha   → "Poste ALPHA"
PC_Bravo   → "Poste BRAVO"
Routeur_1  → "Relais RAVEN"
Routeur_2  → "Noeud SIERRA"
Routeur_3  → "Point TANGO"
```

### Structure de chaque mission :
```javascript
{
    name: 'OPÉRATION NOM',
    codeName: 'NOM',
    brief: {
        situation: String,
        mission: String,
        execution: String,
        contraintes: String,
        delai: String
    },
    objectives: {
        primary: String,
        secondary: [String]
    },
    thresholds: { bronze: N, argent: N, or: N, distinction: N },
    tips: [String]
}
```

### Les 10 missions avec leurs noms de code :
1. WIRE FALCON - Liaison directe via relais RAVEN
2. DEEP RELAY - Transmission via RAVEN et SIERRA
3. CHAIN COMMAND - Chaîne 3 relais RAVEN→SIERRA→TANGO
4. NARROW BAND - Subnetting avec masques /26 ou /30
5. TRIANGLE FORCE - Topologie triangulaire
6. BOTTLENECK - Goulot d'étranglement, rapidité
7. ALPHA STRIKE - Intervention rapide
8. EMBUSCADE - Configuration sous stress
9. LIGNE DE VIE - Connexion stable
10. DERNIER MAILLON - Examen final, certification EDR

### Seuils de médailles (varient par mission) :
- Bronze : 700-1000
- Argent : 1200-1800
- Or : 1800-2500
- Distinction : 2500-3500

### Fonctions :
- `getBriefHTML(missionId)` : génère le HTML du briefing avec les classes `.brief-header`, `.brief-name`, `.brief-section`, `.brief-label`, `.brief-objectives`
- `getDebriefHTML(data)` : génère le HTML du débriefing complet avec grille de stats, médaille, mention, rang, streak, feedback pédagogique (point fort / point faible / conseil)
- `getAlias(nodeId)` : retourne l'alias immersif d'un nœud

---

## 5. SYSTÈME DE SCORING (`scoring.js`)

Module IIFE `const Scoring = (() => { ... })()` exposant : `startMission`, `completeMission`, `failMission`, `onConfigSaved`, `onRouteAdded`, `onPingAttempt`, `onFieldError`, `logEvent`, `updateHUD`, `getState`, `getProfile`, `getMention`, `getMedal`, `MENTIONS`, `MEDALS`, `RANKS`.

### État de mission (reset à chaque mission) :
```javascript
{ score, combo, maxCombo, errors, pingAttempts, actionsCorrect, hintsUsed,
  configChanges, routeAdds, routeDeletes, missionStartTime, missionEndTime,
  penalties, bonusSpeed, bonusPrecision, bonusTactical, bonusCombo,
  bonusFirstTry, missionBase, totalScore, isFirstAttempt }
```

### Constantes de scoring :
```
MISSION_BASE: 1000        points de base par mission réussie
SPEED_MULTIPLIER: 15      points par seconde restante
COMBO_MULTIPLIER: 50      points par combo
MAX_PRECISION_BONUS: 500  bonus max si 0 erreur
TACTICAL_NO_HINT: 200     bonus si aucun indice utilisé
TACTICAL_OPTIMAL_ROUTE: 150  bonus si <= 1 tentative de ping
TACTICAL_CLEAN_CONFIG: 100   bonus si 0 erreur
FIRST_TRY_BONUS: 300      bonus 1ère tentative sur cette mission
STREAK_BONUS_PER: 100     par mission réussie d'affilée
PENALTY_BAD_PING: -80     par ping échoué
PENALTY_BAD_CONFIG: -40   par configuration invalide
PENALTY_EXCESS_ROUTES: -30  par route en excès
PENALTY_EMPTY_FIELD: -20   par champ vide
```

### Actions de scoring :
- **onConfigSaved(nodeId, isValid)** : Si valide → combo++, score += 50 + combo*10. Si invalide → combo=0, errors++, pénalité -40.
- **onRouteAdded(routerId)** : combo++, score += 30 + combo*5, log event.
- **onPingAttempt(success, reason)** : Si succès → combo++. Si échec → combo=0, errors++, pénalité -80.
- **onFieldError(nodeId, fieldName)** : errors++, combo=0, pénalité -20.

### Calcul final (`completeMission`) :
1. Score de base = 1000
2. Bonus vitesse = `timeLeft * 15 * (1 + timeLeft/totalTime)`
3. Bonus précision = 500 si 0 erreur, 300 si ≤2, 100 si ≤5, 0 sinon
4. Bonus tactique = somme de : 200 (pas d'indice) + 150 (≤1 ping) + 100 (0 erreur)
5. Bonus combo = maxCombo * 50
6. Bonus 1er essai = 300 si première tentative sur cette mission
7. Total = max(0, base + bonus - pénalités)

### Mentions (basées sur le score) :
```
PASSABLE    ▬    min: 0
CORRECT     ◆    min: 800
BIEN        ★    min: 1400
TRÈS BIEN   ★★   min: 2000
EXCELLENCE  ★★★  min: 2800
```

### Médailles :
```
BRONZE      🥉   min: 800
ARGENT      🥈   min: 1500
OR          🥇   min: 2200
DISTINCTION 🎖️   min: 3000
```

### Rangs de progression (basés sur score cumulé + missions complétées) :
```
Opérateur Réseau             cumul: 0,     missions: 0
Chef de Liaison              cumul: 3000,  missions: 2
Coordinateur Transmissions   cumul: 8000,  missions: 4
Contrôleur EDR              cumul: 15000, missions: 7
Expert Interconnexion        cumul: 25000, missions: 10
```

### Persistance :
- Profil joueur sauvé dans `localStorage` sous clé `'gameedr_profile'`
- Contient : cumulScore, missionsCompleted, missionsAttempted, currentStreak, bestStreak, bestScores (par mission), bestTimes (par mission), medals (par mission), rank

### Journal d'événements :
- Fonction `logEvent(msg, type)` : ajoute au tableau (max 50 entrées), met à jour l'UI (affiche les 8 derniers)
- Chaque entrée : heure formatée `HH:MM:SS`, message, type (info/success/error/warning)
- Classe CSS différente par type : `.log-info` (beige), `.log-success` (vert), `.log-error` (rouge), `.log-warning` (jaune)

### Mise à jour du HUD :
- Met à jour le score, combo (format "xN" ou "-"), erreurs, mention provisoire (basée sur score courant + base 1000), rang
- Animation combo quand >= 3 : ajout temporaire de la classe `combo-hot` (0.4s)

### Feedback pédagogique dans le debriefing :
- **Point fort** : adapté selon erreurs et tentatives de ping
- **Point faible** : basé sur erreurs >3, pings >3, ou temps critique
- **Conseil** : recommandation personnalisée

---

## 6. MODULE HIGH SCORES (`highscores.js`)

Module IIFE `const HighScores = (() => { ... })()` exposant : `init`, `fetchScores`, `submitScore`, `showNameEntry`, `hideNameEntry`, `showLeaderboard`, `hideLeaderboard`, `renderLeaderboardHTML`.

### Configuration :
- `API_URL = 'score/api.php'`
- Noms à 3 caractères (A-Z, 0-9)
- `CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'`
- Icônes de médailles en Unicode : bronze=◆, argent=★, or=★★, distinction=★★★

### Fonctionnement :
1. `init()` : teste la disponibilité de l'API PHP via un ping GET. Si indisponible, bascule sur localStorage.
2. `fetchScores(levelId)` : GET vers l'API ou lecture localStorage
3. `submitScore(levelId, name, score, medal)` : POST vers l'API ou sauvegarde localStorage

### Fallback localStorage :
- Clé : `'gameedr_highscores'`
- Structure : objet avec clés par levelId, chaque valeur = tableau d'entrées `{name, score, date, medal}`
- Tri : score DESC, date ASC
- Max 20 entrées par niveau

### Saisie du nom (style arcade) :
- 3 colonnes de caractères, chacune avec flèche haut et flèche bas
- Navigation clavier : ArrowUp/Down pour cycler le caractère, ArrowLeft/Right pour changer de colonne, Enter pour valider
- Saisie directe : taper une lettre/chiffre la place et avance le curseur
- Clic sur les flèches ou les caractères pour sélectionner

### Affichage du classement :
- 10 entrées max affichées
- Chaque ligne : rang (padStart 2), nom (3 chars, espacement 4px), dots de remplissage, score formaté fr-FR, icône médaille
- Top 3 avec couleurs spéciales et text-shadow
- Ligne du joueur mise en avant si `highlightName` et `highlightScore` correspondent
- "NEW HIGH SCORE" si le joueur est dans le top 3
- Animation d'apparition par ligne avec délai progressif (0.1s * index)

### Intégration dans le debriefing :
- `renderLeaderboardHTML(scores, highlightName, highlightScore)` : génère un bloc arcade miniature avec scanlines pour l'intégrer en bas du debriefing

---

## 7. MOTEUR PRINCIPAL (`game.js`)

### Audio :
- **Web Audio API** pour les bips : oscillateur sinus (800Hz) pour succès, sawtooth (150Hz) pour erreur. Gain 0.1 avec rampe exponentielle vers 0.001 sur 0.5s.
- **Speech Synthesis API** : voix française (`fr-FR`), pitch 0.8, rate 1.1. Utilisée pour les annonces de mission, succès, échecs.

### Scène Three.js :
- **Fond** : ciel bleu `0x87CEEB`
- **Brouillard** : `THREE.Fog(0xd4c4a0, 80, 200)` (brume de désert)
- **Caméra** : PerspectiveCamera FOV 60, position (0, 40, 40), lookAt (0, 0, 0)
- **Renderer** : WebGLRenderer avec antialias, shadows PCFSoftShadowMap

### Éclairage :
- **Ambient** : `0xfff5e0`, intensité 0.7 (lumière chaude diffuse)
- **Soleil** (DirectionalLight) : `0xffdd88`, intensité 1.2, position (30, 60, -20), shadows activés (1024x1024)
- **Fill** (DirectionalLight) : `0x88aaff`, intensité 0.3, position (-20, 30, 20) (lumière bleutée de remplissage)

### Terrain :
- PlaneGeometry 200x200 avec 40x40 subdivisions, rotation -PI/2
- Ondulations procédurales de dunes : `z = sin(x*0.05)*0.8 + cos(y*0.08)*0.5 + sin(x*0.12+y*0.1)*0.3`
- Matériau : couleur sable `0xd4b56a`, roughness 0.95, flatShading

### Palette de couleurs constantes :
```javascript
trunkBrown: 0x6b4226, leafGreen: 0x5a8a32, leafDark: 0x3d6b1e,
rockGray: 0x8a7d6b, rockDark: 0x6b6052, metalRust: 0x8b5e3c,
metalDark: 0x4a5a3a, tireDark: 0x2a2a2a, canvasKhaki: 0x9b8b6b,
camoGreen: 0x4a5a2e, camoBrown: 0x6b5a3a, camoDark: 0x3a4a2a,
screenGlow: 0x00ff44, antennaGray: 0x6a6a6a, cableYellow: 0xccaa44
```

### Décors du désert (fonction `populateDesertScene`) :

Tous les éléments sont générés procéduralement avec Three.js primitives et flatShading.

#### Palmiers (`createPalmTree(x, z, scale)`) :
- 8 palmiers positionnés loin de la zone de jeu (rayon 30-70)
- Tronc : 6 segments de cylindres empilés avec courbure aléatoire (lean), rayon décroissant, couleur brun
- Feuilles : 5-7 cônes verts/verts foncés alternés au sommet, orientés radialement avec rotation

#### Arbres morts (`createDeadTree(x, z, scale)`) :
- 5 arbres, tronc cylindrique brun foncé + 3-5 branches mortes orientées aléatoirement

#### Rochers (`createRock(x, z, scale)`) :
- 10 rochers, DodecahedronGeometry écrasé (scale.y=0.6) + parfois petit rocher secondaire à côté

#### Véhicule militaire abandonné (`createAbandonedVehicle(x, z, rotY)`) :
- 2 véhicules : châssis BoxGeometry + capot + cabine + pare-brise semi-transparent + 4 roues (dont une détachée) + étoile militaire en ShapeGeometry + tache de rouille. Légèrement penché.

#### Caisses militaires (`createMilitaryCrate(x, z, scale)`) :
- 4 caisses : box verte avec 2 bandes métalliques horizontales

#### Sacs de sable (`createSandbags(x, z, rotY)`) :
- 3 empicements : 6 sacs en pyramide (3+2+1), cylindres couchés couleur kaki

### Modèle 3D du PC (`createMilitaryPC(group)`) :
Station tactique militaire, laptop toughbook sur table :
- **Table** : plateau vert sur 4 pieds métalliques cylindriques
- **Laptop base** : box camouflage foncé avec 4 renforts d'angle jaunes
- **Clavier** : plateau noir avec 4x10 petites touches grises
- **Écran** : cadre camo incliné (rotation.x=0.15) avec 4 renforts jaunes, surface vert foncé `0x003311`, 6 lignes de "texte" vertes `0x00ff44` de longueurs variées, curseur clignotant (userData.isCursor=true)
- **Point light** verte (`0x00ff44`, intensité 0.6, distance 10) pour la lueur d'écran
- **Antenne radio** : cylindre métallique incliné avec 3 bandes noires et bout rouge
- **Câbles** : 2 cylindres (noir et jaune) couchés sur le côté
- **Casque radio** : torus (arceau) + 2 cylindres (écouteurs)

### Modèle 3D du Routeur (`createMilitaryRouter(group)`) :
Station radio de campagne militaire :
- **Palette** : box plate brun foncé au sol
- **Caisse principale** : box 5.2x3x4 camo vert avec renforts métalliques sur les arêtes (horizontaux et verticaux) + 8 coins jaunes
- **Panneau frontal** : box camo foncé avec :
  - Écran LCD `0x001100` avec 3 barres vertes `0x00ff88`
  - 5 LEDs d'état (3 vertes, 1 orange, 1 rouge) avec halos lumineux (RingGeometry semi-transparent)
  - 8 LEDs d'activité rectangulaires (on/off aléatoire)
  - 6 ports RJ45 (box noirs avec connecteur cuivre interne)
  - 2 câbles Ethernet qui pendent (jaune + noir)
  - 2 boutons rotatifs (potentiomètres cylindriques métalliques avec indicateur blanc)
- **3 Antennes** :
  - Principale : grande (6 unités), droite, 4 segments noirs, bout rouge clignotant (userData.isBlinking)
  - Secondaire : plus courte (4 unités), inclinée (rotation.z=0.3), bout rouge clignotant
  - Petite : latérale (2.5 unités), bout orange
- **Plaque métallique** "SIGNAL CORPS" sur le devant
- **Étoile militaire** sur le côté (ShapeGeometry 5 branches + cercle RingGeometry)
- **Poignées de transport** : 2 barres métalliques horizontales en haut avec supports

### Chargement des niveaux :

#### Briefing (`showBriefing(index)`) :
- Affiche l'overlay de briefing avec le HTML de mission via `Missions.getBriefHTML(missionId)`
- Bouton "LANCER LA MISSION" → cache l'overlay et lance `loadLevel(index)`
- Bouton "CLASSEMENT" → `HighScores.showLeaderboard(missionId)`

#### Chargement (`loadLevel(index)`) :
1. Nettoie la scène (supprime anciens nœuds et câbles)
2. Copie profonde du niveau (`JSON.parse(JSON.stringify(levels[index]))`)
3. Met à jour les titres du HUD avec les noms de mission immersifs
4. Initialise le scoring (`Scoring.startMission`)
5. Réinitialise l'état liaison à "INTERROMPUE"
6. Crée les équipements 3D :
   - Pour chaque nœud : crée un `THREE.Group` positionné selon `pos.x/z`
   - Appelle `createMilitaryRouter` ou `createMilitaryPC` selon le type
   - Ajoute une **hitbox invisible** (BoxGeometry 6x6x6 à y=3) pour le raycasting
   - Stocke dans `nodes3D[id]`
7. Dessine les câbles après 100ms
8. Lance le chronomètre

### Câbles réseau (`drawCables()`) :
- Supprime les anciens câbles, reconstruit tout
- Couleurs alternées : `[0xddaa22, 0x2288dd, 0xdd4422, 0x22bb55, 0xcc44cc, 0xee8822]`
- Pour chaque lien :
  - Calcul arc Bézier quadratique entre les deux nœuds (hauteur de départ 1.2, arc au-dessus `1.7 + distance*0.06`)
  - **Câble principal** : TubeGeometry (rayon 0.25, 24 segments), matériau coloré flatShading
  - **Gaine extérieure** : TubeGeometry plus large (rayon 0.3), couleur assombrie (*0.5), semi-transparente (opacity 0.35)
  - **2 connecteurs RJ45** aux extrémités : chacun composé de :
    - Boîtier (box 0.55x0.35x0.7, couleur `0xddddcc`)
    - Clip de verrouillage (box sur le dessus)
    - 8 broches dorées (contacts cuivre)
    - Manchon coloré (cylindre de la couleur du câble)
    - Orienté vers l'autre extrémité (calcul d'angle atan2)
  - Stocke `{ group, tubeMat, outerMat, n1, n2 }` pour pouvoir changer la couleur au succès

### Chronomètre :
- Tick chaque seconde, format `MM:SS`
- À 30s restantes : classe `danger` sur le timer (rouge pulsant)
- À 0 : game over

### Game Over :
- Appelle `Scoring.failMission()` (reset du streak)
- Log l'événement d'échec
- Affiche le nombre d'erreurs et le score accumulé
- Speech : "Sergent, on est isolés ! Échec de la mission !"
- Affiche l'overlay game over
- Crée des explosions de particules sur chaque nœud

### Explosions :
- 100 particules (PointsMaterial, taille 1.5, couleur `0xff6600`)
- Vitesses aléatoires + gravité
- Durée de vie : 60 frames

### Interaction (Drag & Drop + Clic) :
- **Raycaster** : teste l'intersection avec les enfants des groupes de nœuds
- **Pointerdown** :
  - Ignore les clics sur les panels/modales
  - Trouve le groupe parent (remonte la hiérarchie)
  - Stocke le nœud dragué
  - Ouvre le menu de configuration
- **Pointermove** :
  - Si un nœud est dragué : projette le curseur sur un plan horizontal (y=0), déplace le nœud, redessine les câbles
- **Pointerup** : relâche le drag

### Configuration des nœuds :

#### `openConfigMenu(id)` :
- Cache toutes les modales
- **PC** : remplit les champs IP/masque/passerelle, affiche la modale PC
- **Routeur** :
  - Génère dynamiquement les lignes d'interfaces (nom + IP + masque pour chaque interface)
  - Appelle `renderRoutes(node)` pour les routes
  - Affiche la modale routeur

#### `renderRoutes(node)` :
- Vide le conteneur de routes
- Pour chaque route : génère 3 inputs (destination, masque, passerelle/next-hop) avec IDs indexés

#### Bouton "+ AJOUTER ROUTE" :
- **IMPORTANT** : Avant d'ajouter la nouvelle route, sauvegarde les valeurs actuelles des inputs dans `node.routes` (sinon elles disparaissent au re-render)
- Push `{ dest:"", mask:"", gw:"" }` dans `node.routes`
- Re-render les routes
- Appelle `Scoring.onRouteAdded`

#### Sauvegarde PC :
- Récupère les valeurs des champs
- Valide : IP et masque non vides et au format 4 octets
- Appelle `Scoring.onConfigSaved(id, valid)`
- Ferme la modale
- Joue un bip (succès ou erreur)

#### Sauvegarde Routeur :
- Récupère les valeurs de toutes les interfaces et routes
- Valide les interfaces (IP et masque au format 4 octets)
- Appelle `Scoring.onConfigSaved(id, allValid)`
- Ferme la modale
- Joue un bip

#### Boutons FERMER : cachent la modale parente

### Moteur de validation (simulation de ping) :

#### Fonctions utilitaires :
- `ipToLong(ip)` : convertit une IP en entier 32 bits unsigned
- `isSameSubnet(ip1, ip2, mask)` : vérifie que deux IPs sont dans le même sous-réseau
- `getNodeByIp(ip)` : trouve le nœud (PC ou routeur) qui possède cette IP

#### `routePacket(currentNode, targetIp, ttl=10)` :
Simulation récursive du routage IP :
1. Si TTL=0 → échec "Boucle de routage (TTL expiré)"
2. Si l'IP cible est celle du nœud courant → succès
3. **Pour un PC** :
   - Si cible dans le même sous-réseau → cherche le nœud cible et continue
   - Sinon → utilise la passerelle. Si pas de passerelle → échec. Si passerelle injoignable → échec.
4. **Pour un routeur** :
   - A) Vérifie les réseaux directement connectés (interfaces) : si l'IP cible est dans un sous-réseau d'une interface → cherche le nœud cible
   - B) Vérifie la table de routage statique : pour chaque route, si la destination match → suit le next-hop
   - Si rien ne match → échec "Aucune route vers X"

#### Bouton VÉRIFIER (btn-verify) :
1. **Validation physique** : Pour chaque câble, vérifie que les deux extrémités sont dans le même sous-réseau avec le même masque. Si non → échec avec message.
2. **Ping aller** : `routePacket(PC_Alpha, PC_Bravo.ip)`. Si échec → message + speech.
3. **Ping retour** : `routePacket(PC_Bravo, PC_Alpha.ip)`. Si échec → message + speech.
4. **Succès total** :
   - Arrête le chrono
   - Bip de succès
   - Câbles deviennent verts (couleur `0x00ff44`, emissive `0x004400`)
   - État liaison → "OPÉRATIONNELLE" (vert)
   - Log succès + speech
   - Calcul score final via `Scoring.completeMission`
   - Après 1.5s : saisie du nom arcade → soumission du score → affichage debriefing avec classement intégré

### Boutons debriefing :
- **Mission suivante** : cache le debrief, incrémente l'index, affiche le briefing suivant (ou écran de victoire finale si dernière mission)
- **Recommencer** : cache le debrief, réaffiche le briefing de la mission courante

### Boucle d'animation :
- `requestAnimationFrame` à ~60fps
- Curseur clignotant du PC (sin(time*6) > 0)
- LEDs clignotantes du routeur (opacity oscillante sin(time*4 + id))
- Particules d'explosion (mouvement + gravité + durée de vie)
- `renderer.render(scene, camera)`

### Resize handler :
- Met à jour l'aspect ratio de la caméra et la taille du renderer

### Initialisation :
1. `HighScores.init()` : test de l'API
2. `showBriefing(0)` : affiche le briefing de la première mission

---

## 8. API PHP (`score/api.php`)

API REST simple avec 3 actions via paramètre GET `action` :

### Headers :
```
Content-Type: application/json; charset=utf-8
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```
- Gestion CORS pré-vol (OPTIONS → 204)

### Actions :

#### `ping` (GET) :
- Retourne `{ success: true, message: "GAME EDR High Scores API" }`

#### `get` (GET) :
- Paramètre : `level` (1-10)
- Lit le fichier `level_X.json`, trie (score DESC, date ASC), ajoute les rangs
- Retourne `{ success: true, level: N, scores: [...] }`

#### `save` (POST, body JSON) :
- Paramètres : `level` (1-10), `name` (3 chars A-Z0-9), `score` (0-99999), `medal` (null|bronze|argent|or|distinction)
- Validation stricte de tous les paramètres
- Ajoute l'entrée avec horodatage serveur (`date('c')`)
- Trie et tronque à 20 entrées max
- Écrit le fichier avec `LOCK_EX`
- Retourne `{ success: true, rank: N, isHighScore: bool, scores: [...] }`

### Stockage :
- Fichiers JSON dans le même répertoire : `level_1.json` à `level_10.json`
- `.htaccess` : `Options -Indexes` pour empêcher le listing

---

## 9. FLUX DE JEU COMPLET

1. Page chargée → briefing mission 1 avec contexte militaire
2. Joueur clique "LANCER LA MISSION" → scène 3D avec équipements et chrono
3. Joueur clique sur un équipement → modale de configuration (PC ou routeur)
4. Joueur configure IPs, masques, passerelles, routes statiques
5. Joueur clique "VÉRIFIER LA CONNEXION (PING)" → validation
   - Échec → feedback détaillé (quel câble, quel routeur, quelle route manque)
   - Succès → câbles verts, saisie du nom 3 lettres, scoring, debriefing détaillé + classement
6. Bouton "MISSION SUIVANTE" → briefing mission suivante
7. Si le temps expire → game over avec explosions et possibilité de recommencer
8. Progression persistée en localStorage (rang, médailles, meilleurs scores)

---

## 10. POINTS TECHNIQUES IMPORTANTS

- **Copie profonde** des niveaux à chaque chargement (`JSON.parse(JSON.stringify())`) pour que les données soient réinitialisées
- **Hitbox invisible** sur chaque équipement pour faciliter le raycasting
- **Synchronisation des inputs** : lors de l'ajout d'une route, les valeurs déjà saisies dans les champs doivent être sauvegardées dans le modèle de données AVANT le re-render (sinon elles disparaissent)
- **Câbles redessinés** à chaque drag pour suivre le déplacement des nœuds
- **Validation bidirectionnelle** du ping (aller ET retour)
- **Validation physique** séparée : vérifier que les équipements reliés par un même câble sont dans le même sous-réseau AVANT de tester le routage
- **Fallback localStorage** transparent si l'API PHP est indisponible
- Tout le rendu 3D est procédural (pas de fichiers de modèles externes), avec `flatShading: true` pour le style cartoon
- L'interface est entièrement en français
