<?php
// ==========================================
// GAME EDR - API HIGH SCORES
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

$SCORE_DIR = __DIR__;
$MAX_ENTRIES = 20;
$MAX_SCORE = 99999;
$VALID_MEDALS = [null, '', 'bronze', 'argent', 'or', 'distinction'];

// --- Fonctions utilitaires ---

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function getScoreFile($level) {
    global $SCORE_DIR;
    return $SCORE_DIR . '/level_' . intval($level) . '.json';
}

function readScores($level) {
    $file = getScoreFile($level);
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

function writeScores($level, $scores) {
    $file = getScoreFile($level);
    $json = json_encode($scores, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    file_put_contents($file, $json, LOCK_EX);
}

function sortScores(&$scores) {
    usort($scores, function($a, $b) {
        // Score descendant (plus haut en premier)
        if ($b['score'] !== $a['score']) {
            return $b['score'] - $a['score'];
        }
        // Date ascendante (plus ancien en premier pour même score)
        return strcmp($a['date'], $b['date']);
    });
}

// --- Routage ---

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {

    // ===== GET SCORES =====
    case 'get':
        $level = isset($_GET['level']) ? intval($_GET['level']) : 0;
        if ($level < 1 || $level > 10) {
            jsonResponse(['success' => false, 'error' => 'Niveau invalide (1-10).'], 400);
        }

        $scores = readScores($level);
        sortScores($scores);

        // Ajouter le rang
        $result = [];
        foreach ($scores as $i => $entry) {
            $entry['rank'] = $i + 1;
            $result[] = $entry;
        }

        jsonResponse([
            'success' => true,
            'level' => $level,
            'scores' => $result
        ]);
        break;

    // ===== SAVE SCORE =====
    case 'save':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            jsonResponse(['success' => false, 'error' => 'Méthode POST requise.'], 405);
        }

        // Lire le body JSON
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            jsonResponse(['success' => false, 'error' => 'JSON invalide.'], 400);
        }

        // Validation du niveau
        $level = isset($input['level']) ? intval($input['level']) : 0;
        if ($level < 1 || $level > 10) {
            jsonResponse(['success' => false, 'error' => 'Niveau invalide (1-10).'], 400);
        }

        // Validation du nom
        $name = isset($input['name']) ? strtoupper(trim($input['name'])) : '';
        $account_login = isset($input['account_login']) ? trim($input['account_login']) : null;

        // Si un compte est lié, le nom peut être le login (jusqu'à 30 chars)
        if ($account_login && strlen($account_login) >= 2) {
            $name = strtoupper($account_login);
            if (!preg_match('/^[A-Z0-9_\-]{2,30}$/', $name)) {
                jsonResponse(['success' => false, 'error' => 'Nom de compte invalide.'], 400);
            }
        } else {
            // Mode arcade classique : exactement 4 caractères A-Z/0-9
            if (!preg_match('/^[A-Z0-9]{4}$/', $name)) {
                jsonResponse(['success' => false, 'error' => 'Nom invalide (4 caractères A-Z/0-9).'], 400);
            }
            $account_login = null;
        }

        // Validation du score
        $score = isset($input['score']) ? intval($input['score']) : 0;
        if ($score < 0 || $score > $MAX_SCORE) {
            jsonResponse(['success' => false, 'error' => 'Score invalide (0-' . $MAX_SCORE . ').'], 400);
        }

        // Validation de la médaille
        $medal = isset($input['medal']) ? strtolower(trim($input['medal'])) : null;
        if ($medal === '') $medal = null;
        if (!in_array($medal, $VALID_MEDALS, true)) {
            jsonResponse(['success' => false, 'error' => 'Médaille invalide.'], 400);
        }

        // Créer l'entrée avec horodatage serveur
        $newEntry = [
            'name'  => $name,
            'score' => $score,
            'date'  => date('c'), // ISO 8601
            'medal' => $medal,
            'account_login' => $account_login
        ];

        // Lire, insérer, trier, tronquer
        $scores = readScores($level);
        $scores[] = $newEntry;
        sortScores($scores);
        $scores = array_slice($scores, 0, $MAX_ENTRIES);

        // Écrire
        writeScores($level, $scores);

        // Déterminer le rang du nouveau score
        $rank = -1;
        $isHighScore = false;
        foreach ($scores as $i => $entry) {
            if ($entry['name'] === $name && $entry['score'] === $score && $entry['date'] === $newEntry['date']) {
                $rank = $i + 1;
                $isHighScore = true;
                break;
            }
        }

        // Si le score n'est plus dans la liste (tronqué), ce n'est pas un high score
        if ($rank === -1) {
            $isHighScore = false;
            $rank = $MAX_ENTRIES + 1;
        }

        // Ajouter les rangs pour la réponse
        $result = [];
        foreach ($scores as $i => $entry) {
            $entry['rank'] = $i + 1;
            $result[] = $entry;
        }

        jsonResponse([
            'success' => true,
            'rank' => $rank,
            'isHighScore' => $isHighScore,
            'scores' => $result
        ]);
        break;

    // ===== PING (test disponibilité) =====
    case 'ping':
        jsonResponse(['success' => true, 'message' => 'GAME EDR High Scores API']);
        break;

    default:
        jsonResponse(['success' => false, 'error' => 'Action inconnue. Utilisez: get, save, ping'], 400);
        break;
}
