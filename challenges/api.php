<?php
// ==========================================
// GAME EDR - API DÉFIS ASYNCHRONES
// ==========================================
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Pré-vol CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$DATA_FILE = __DIR__ . '/challenges.json';
$MAX_CHALLENGES = 100;
$MAX_SCORE = 99999;
$VALID_MEDALS = [null, '', 'bronze', 'argent', 'or', 'distinction'];

// --- Fonctions utilitaires ---

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function loadChallenges($file) {
    if (!file_exists($file)) {
        return [];
    }
    $content = file_get_contents($file);
    if ($content === false || $content === '') {
        return [];
    }
    $data = json_decode($content, true);
    return is_array($data) ? $data : [];
}

function saveChallenges($file, $challenges) {
    $json = json_encode($challenges, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    file_put_contents($file, $json, LOCK_EX);
}

function generateChallengeId() {
    return bin2hex(random_bytes(8)); // 16 chars hex
}

function validateLogin($login) {
    $login = trim($login);
    if (strlen($login) < 2 || strlen($login) > 30) return false;
    if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $login)) return false;
    return $login;
}

function validateMedal($medal) {
    global $VALID_MEDALS;
    if ($medal === '' || $medal === null) return null;
    $medal = strtolower(trim($medal));
    if (!in_array($medal, $VALID_MEDALS, true)) return false;
    return $medal === '' ? null : $medal;
}

/**
 * Prune les défis terminés les plus anciens si on dépasse MAX_CHALLENGES.
 * On supprime d'abord les completed les plus anciens.
 */
function pruneChallenges(&$challenges) {
    global $MAX_CHALLENGES;
    if (count($challenges) <= $MAX_CHALLENGES) return;

    // Séparer open et completed
    $open = [];
    $completed = [];
    foreach ($challenges as $c) {
        if ($c['status'] === 'completed') {
            $completed[] = $c;
        } else {
            $open[] = $c;
        }
    }

    // Trier completed par date de création ascendante (plus anciens en premier)
    usort($completed, function($a, $b) {
        return strcmp($a['created_at'], $b['created_at']);
    });

    // Combien faut-il supprimer ?
    $toRemove = count($challenges) - $MAX_CHALLENGES;
    $completed = array_slice($completed, $toRemove);

    $challenges = array_merge($open, $completed);
}

// --- Routage ---

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {

    // ===== CRÉER UN DÉFI =====
    case 'create':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(['success' => false, 'error' => 'Méthode POST requise.'], 405);
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            jsonResponse(['success' => false, 'error' => 'JSON invalide.'], 400);
        }

        // Validation du login créateur
        $creator_login = isset($input['creator_login']) ? validateLogin($input['creator_login']) : false;
        if (!$creator_login) {
            jsonResponse(['success' => false, 'error' => 'Login créateur invalide.'], 400);
        }

        // Validation du niveau
        $level_id = isset($input['level_id']) ? intval($input['level_id']) : 0;
        if ($level_id < 1 || $level_id > 10) {
            jsonResponse(['success' => false, 'error' => 'Niveau invalide (1-10).'], 400);
        }

        // Validation du score
        $creator_score = isset($input['creator_score']) ? intval($input['creator_score']) : 0;
        if ($creator_score < 0 || $creator_score > $MAX_SCORE) {
            jsonResponse(['success' => false, 'error' => 'Score invalide (0-' . $MAX_SCORE . ').'], 400);
        }

        // Validation de la médaille
        $creator_medal = isset($input['creator_medal']) ? validateMedal($input['creator_medal']) : null;
        if ($creator_medal === false) {
            jsonResponse(['success' => false, 'error' => 'Médaille invalide.'], 400);
        }

        $challenge = [
            'id' => generateChallengeId(),
            'creator_login' => $creator_login,
            'level_id' => $level_id,
            'creator_score' => $creator_score,
            'creator_medal' => $creator_medal,
            'status' => 'open',
            'created_at' => date('c'),
            'results' => []
        ];

        $challenges = loadChallenges($DATA_FILE);
        $challenges[] = $challenge;
        pruneChallenges($challenges);
        saveChallenges($DATA_FILE, $challenges);

        jsonResponse([
            'success' => true,
            'message' => 'Défi créé.',
            'challenge' => $challenge
        ]);
        break;

    // ===== LISTER LES DÉFIS OUVERTS =====
    case 'list':
        $challenges = loadChallenges($DATA_FILE);
        $level_filter = isset($_GET['level_id']) ? intval($_GET['level_id']) : 0;

        $open = [];
        foreach ($challenges as $c) {
            if ($c['status'] !== 'open') continue;
            if ($level_filter > 0 && $c['level_id'] !== $level_filter) continue;
            $open[] = $c;
        }

        // Trier par date de création descendante (plus récents en premier)
        usort($open, function($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });

        jsonResponse([
            'success' => true,
            'count' => count($open),
            'challenges' => $open
        ]);
        break;

    // ===== ACCEPTER UN DÉFI =====
    case 'accept':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(['success' => false, 'error' => 'Méthode POST requise.'], 405);
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            jsonResponse(['success' => false, 'error' => 'JSON invalide.'], 400);
        }

        $challenge_id = isset($input['challenge_id']) ? trim($input['challenge_id']) : '';
        if (!$challenge_id) {
            jsonResponse(['success' => false, 'error' => 'ID du défi requis.'], 400);
        }

        $challenger_login = isset($input['challenger_login']) ? validateLogin($input['challenger_login']) : false;
        if (!$challenger_login) {
            jsonResponse(['success' => false, 'error' => 'Login challenger invalide.'], 400);
        }

        $challenges = loadChallenges($DATA_FILE);
        $found = false;

        foreach ($challenges as &$c) {
            if ($c['id'] !== $challenge_id) continue;
            $found = true;

            if ($c['status'] !== 'open') {
                jsonResponse(['success' => false, 'error' => 'Ce défi n\'est plus ouvert.'], 400);
            }

            // Vérifier que le créateur ne se défie pas lui-même
            if (strtolower($c['creator_login']) === strtolower($challenger_login)) {
                jsonResponse(['success' => false, 'error' => 'Vous ne pouvez pas accepter votre propre défi.'], 400);
            }

            // Vérifier que ce challenger n'a pas déjà un résultat
            foreach ($c['results'] as $r) {
                if (strtolower($r['login']) === strtolower($challenger_login)) {
                    jsonResponse(['success' => false, 'error' => 'Vous avez déjà participé à ce défi.'], 400);
                }
            }

            jsonResponse([
                'success' => true,
                'message' => 'Défi accepté. Jouez le niveau ' . $c['level_id'] . ' !',
                'challenge' => $c
            ]);
            break;
        }
        unset($c);

        if (!$found) {
            jsonResponse(['success' => false, 'error' => 'Défi introuvable.'], 404);
        }
        break;

    // ===== SOUMETTRE UN RÉSULTAT =====
    case 'complete':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(['success' => false, 'error' => 'Méthode POST requise.'], 405);
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            jsonResponse(['success' => false, 'error' => 'JSON invalide.'], 400);
        }

        $challenge_id = isset($input['challenge_id']) ? trim($input['challenge_id']) : '';
        if (!$challenge_id) {
            jsonResponse(['success' => false, 'error' => 'ID du défi requis.'], 400);
        }

        $challenger_login = isset($input['challenger_login']) ? validateLogin($input['challenger_login']) : false;
        if (!$challenger_login) {
            jsonResponse(['success' => false, 'error' => 'Login challenger invalide.'], 400);
        }

        $challenger_score = isset($input['challenger_score']) ? intval($input['challenger_score']) : 0;
        if ($challenger_score < 0 || $challenger_score > $MAX_SCORE) {
            jsonResponse(['success' => false, 'error' => 'Score invalide (0-' . $MAX_SCORE . ').'], 400);
        }

        $challenger_medal = isset($input['challenger_medal']) ? validateMedal($input['challenger_medal']) : null;
        if ($challenger_medal === false) {
            jsonResponse(['success' => false, 'error' => 'Médaille invalide.'], 400);
        }

        $challenges = loadChallenges($DATA_FILE);
        $found = false;

        foreach ($challenges as &$c) {
            if ($c['id'] !== $challenge_id) continue;
            $found = true;

            // Vérifier que le créateur ne se défie pas lui-même
            if (strtolower($c['creator_login']) === strtolower($challenger_login)) {
                jsonResponse(['success' => false, 'error' => 'Vous ne pouvez pas compléter votre propre défi.'], 400);
            }

            // Vérifier que ce challenger n'a pas déjà soumis
            foreach ($c['results'] as $r) {
                if (strtolower($r['login']) === strtolower($challenger_login)) {
                    jsonResponse(['success' => false, 'error' => 'Vous avez déjà soumis un résultat pour ce défi.'], 400);
                }
            }

            // Ajouter le résultat
            $result = [
                'login' => $challenger_login,
                'score' => $challenger_score,
                'medal' => $challenger_medal,
                'completed_at' => date('c')
            ];
            $c['results'][] = $result;

            // Marquer comme completed (le défi reste jouable par d'autres,
            // mais on le marque completed dès qu'il y a au moins un résultat)
            $c['status'] = 'completed';

            saveChallenges($DATA_FILE, $challenges);

            // Déterminer le gagnant
            $winner = null;
            if ($challenger_score > $c['creator_score']) {
                $winner = $challenger_login;
            } elseif ($challenger_score < $c['creator_score']) {
                $winner = $c['creator_login'];
            } else {
                $winner = 'draw'; // Égalité
            }

            jsonResponse([
                'success' => true,
                'message' => 'Résultat soumis.',
                'winner' => $winner,
                'creator_score' => $c['creator_score'],
                'challenger_score' => $challenger_score,
                'challenge' => $c
            ]);
            break;
        }
        unset($c);

        if (!$found) {
            jsonResponse(['success' => false, 'error' => 'Défi introuvable.'], 404);
        }
        break;

    // ===== MES DÉFIS =====
    case 'my_challenges':
        $login = isset($_GET['login']) ? trim($_GET['login']) : '';
        if (!$login) {
            jsonResponse(['success' => false, 'error' => 'Login requis.'], 400);
        }

        $challenges = loadChallenges($DATA_FILE);
        $mine = [];

        foreach ($challenges as $c) {
            $isCreator = (strtolower($c['creator_login']) === strtolower($login));
            $isChallenger = false;
            foreach ($c['results'] as $r) {
                if (strtolower($r['login']) === strtolower($login)) {
                    $isChallenger = true;
                    break;
                }
            }
            if ($isCreator || $isChallenger) {
                $c['role'] = $isCreator ? 'creator' : 'challenger';
                $mine[] = $c;
            }
        }

        // Trier par date de création descendante
        usort($mine, function($a, $b) {
            return strcmp($b['created_at'], $a['created_at']);
        });

        jsonResponse([
            'success' => true,
            'count' => count($mine),
            'challenges' => $mine
        ]);
        break;

    // ===== PING =====
    case 'ping':
        jsonResponse(['success' => true, 'message' => 'GAME EDR Challenges API']);
        break;

    default:
        jsonResponse(['success' => false, 'error' => 'Action inconnue. Utilisez: create, list, accept, complete, my_challenges, ping'], 400);
        break;
}
