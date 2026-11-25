<?php
// ==========================================
// GAME EDR - API GESTION DES COMPTES
// ==========================================
// Stockage local JSON, hashage bcrypt

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$DATA_FILE = __DIR__ . '/users.json';

// --- Chargement des utilisateurs ---
function load_users($file) {
    if (!file_exists($file)) {
        return ['users' => []];
    }
    $raw = file_get_contents($file);
    if ($raw === false) {
        return ['users' => []];
    }
    $data = json_decode($raw, true);
    return is_array($data) && isset($data['users']) ? $data : ['users' => []];
}

// --- Sauvegarde des utilisateurs ---
function save_users($file, $data) {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return file_put_contents($file, $json, LOCK_EX) !== false;
}

// --- Recherche d'un utilisateur par login ---
function find_user(&$data, $login) {
    foreach ($data['users'] as $i => &$user) {
        if (strtolower($user['login']) === strtolower($login)) {
            return $i;
        }
    }
    return -1;
}

// --- Traitement de la requête ---
$action = isset($_GET['action']) ? $_GET['action'] : '';
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) $input = [];

switch ($action) {

    // === INSCRIPTION / CONNEXION ===
    case 'login':
        $login = isset($input['login']) ? trim($input['login']) : '';
        $password = isset($input['password']) ? $input['password'] : '';

        if (strlen($login) < 2 || strlen($login) > 30) {
            echo json_encode(['ok' => false, 'error' => 'Login invalide (2-30 caractères).']);
            exit;
        }
        if (strlen($password) < 3) {
            echo json_encode(['ok' => false, 'error' => 'Mot de passe trop court (3 caractères min).']);
            exit;
        }
        // Caractères autorisés pour le login
        if (!preg_match('/^[a-zA-Z0-9_\-]+$/', $login)) {
            echo json_encode(['ok' => false, 'error' => 'Login : lettres, chiffres, _ et - uniquement.']);
            exit;
        }

        $data = load_users($DATA_FILE);
        $idx = find_user($data, $login);

        if ($idx === -1) {
            // Création automatique du compte
            $newUser = [
                'login' => $login,
                'password_hash' => password_hash($password, PASSWORD_BCRYPT),
                'last_unlocked_level' => 1,
                'validated_levels' => [],
                'progression_data' => [],
                'score' => 0
            ];
            $data['users'][] = $newUser;
            save_users($DATA_FILE, $data);
            echo json_encode([
                'ok' => true,
                'created' => true,
                'message' => 'Compte créé avec succès.',
                'user' => [
                    'login' => $newUser['login'],
                    'last_unlocked_level' => $newUser['last_unlocked_level'],
                    'validated_levels' => $newUser['validated_levels'],
                    'progression_data' => $newUser['progression_data'],
                    'score' => $newUser['score']
                ]
            ]);
        } else {
            // Vérification du mot de passe
            if (password_verify($password, $data['users'][$idx]['password_hash'])) {
                $u = $data['users'][$idx];
                echo json_encode([
                    'ok' => true,
                    'created' => false,
                    'message' => 'Connexion réussie.',
                    'user' => [
                        'login' => $u['login'],
                        'last_unlocked_level' => $u['last_unlocked_level'],
                        'validated_levels' => $u['validated_levels'],
                        'progression_data' => isset($u['progression_data']) ? $u['progression_data'] : [],
                        'score' => isset($u['score']) ? $u['score'] : 0
                    ]
                ]);
            } else {
                echo json_encode(['ok' => false, 'error' => 'Mot de passe incorrect.']);
            }
        }
        break;

    // === SAUVEGARDE PROGRESSION ===
    case 'save_progress':
        $login = isset($input['login']) ? trim($input['login']) : '';
        if (!$login) {
            echo json_encode(['ok' => false, 'error' => 'Login requis.']);
            exit;
        }

        $data = load_users($DATA_FILE);
        $idx = find_user($data, $login);
        if ($idx === -1) {
            echo json_encode(['ok' => false, 'error' => 'Utilisateur introuvable.']);
            exit;
        }

        // Mise à jour des champs fournis
        if (isset($input['last_unlocked_level'])) {
            $data['users'][$idx]['last_unlocked_level'] = (int)$input['last_unlocked_level'];
        }
        if (isset($input['validated_levels'])) {
            $data['users'][$idx]['validated_levels'] = $input['validated_levels'];
        }
        if (isset($input['progression_data'])) {
            $data['users'][$idx]['progression_data'] = $input['progression_data'];
        }
        if (isset($input['score'])) {
            $data['users'][$idx]['score'] = (int)$input['score'];
        }

        save_users($DATA_FILE, $data);
        echo json_encode(['ok' => true, 'message' => 'Progression sauvegardée.']);
        break;

    // === CHARGEMENT PROGRESSION ===
    case 'load_progress':
        $login = isset($_GET['login']) ? trim($_GET['login']) : '';
        if (!$login) {
            echo json_encode(['ok' => false, 'error' => 'Login requis.']);
            exit;
        }

        $data = load_users($DATA_FILE);
        $idx = find_user($data, $login);
        if ($idx === -1) {
            echo json_encode(['ok' => false, 'error' => 'Utilisateur introuvable.']);
            exit;
        }

        $u = $data['users'][$idx];
        echo json_encode([
            'ok' => true,
            'user' => [
                'login' => $u['login'],
                'last_unlocked_level' => $u['last_unlocked_level'],
                'validated_levels' => $u['validated_levels'],
                'progression_data' => isset($u['progression_data']) ? $u['progression_data'] : [],
                'score' => isset($u['score']) ? $u['score'] : 0
            ]
        ]);
        break;

    default:
        echo json_encode(['ok' => false, 'error' => 'Action inconnue.']);
        break;
}
