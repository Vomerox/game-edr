# Installation sur un serveur

Ce guide installe GAME EDR **à la racine d'un site Apache** sur Debian 12 ou 13 (la procédure est identique sur Ubuntu). Il suppose un accès `root` ou `sudo`.

> Le jeu est un site statique (HTML, CSS, JavaScript) complété par trois petites API PHP qui stockent les comptes, les scores et les défis dans des fichiers JSON. Il n'y a pas de base de données.

---

## 1. Installer Apache et PHP

```bash
apt update
apt install -y apache2 php libapache2-mod-php php-mbstring
```

Apache est recommandé plutôt que nginx : le jeu utilise des fichiers `.htaccess` pour interdire l'accès direct aux fichiers de données.

## 2. Copier le jeu

```bash
git clone https://github.com/Vomerox/game-edr.git /tmp/game-edr
rm -f /var/www/html/index.html                 # page par défaut d'Apache
cp -r /tmp/game-edr/. /var/www/html/
rm -rf /var/www/html/.git /var/www/html/docs   # inutiles en production
rm -rf /tmp/game-edr
```

## 3. Droits d'accès

Les fichiers du site appartiennent à `root` et sont en lecture seule pour Apache. Seuls les trois dossiers de données doivent être accessibles en écriture par l'utilisateur d'Apache (`www-data`).

```bash
chown -R root:root /var/www/html
find /var/www/html -type d -exec chmod 755 {} +
find /var/www/html -type f -exec chmod 644 {} +
chown -R www-data:www-data /var/www/html/accounts /var/www/html/score /var/www/html/challenges
```

## 4. Configuration Apache

Créer `/etc/apache2/conf-available/gameedr.conf` :

```apache
<Directory /var/www/html>
    Options -Indexes +FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>
DirectoryIndex index.html index.php

# Toujours revalider la page HTML pour que les mises à jour soient vues tout de suite
<FilesMatch "\.html$">
    Header set Cache-Control "no-cache"
</FilesMatch>
```

Puis activer la configuration et les modules :

```bash
a2enconf gameedr
a2enmod rewrite headers
apache2ctl configtest
systemctl enable --now apache2
systemctl reload apache2
```

- `AllowOverride All` rend actifs les `.htaccess` qui protègent `users.json` et `challenges.json`.
- `Options -Indexes` empêche l'affichage du contenu des dossiers.

## 5. Vérifier

```bash
curl -s "http://localhost/score/api.php?action=ping"
# {"success": true, "message": "GAME EDR High Scores API"}

curl -s -o /dev/null -w "%{http_code}\n" http://localhost/accounts/users.json
# 403 (ou 404 tant qu'aucun compte n'existe) : le fichier n'est pas lisible depuis le web
```

Le jeu est alors disponible sur `http://<adresse-du-serveur>/`.

---

## Mettre à jour le jeu

Ne remplacer **que** le code (`index.html`, `css/`, `js/`, `assets/`, `lib/`, et les `api.php`). Ne jamais écraser les fichiers de données en production :

- `accounts/users.json`
- `score/level_*.json`
- `challenges/challenges.json`

Les numéros de version dans `index.html` (`?v=…` sur les scripts et les feuilles de style) forcent les navigateurs à recharger les fichiers modifiés. Augmentez-les à chaque mise à jour.

---

## Sécurité

- **Utiliser HTTPS** dès que le jeu est accessible au-delà d'un réseau de confiance (par exemple avec `certbot --apache`). En HTTP simple, les mots de passe des joueurs circulent en clair.
- Les mots de passe sont stockés **hachés en bcrypt** côté serveur. En revanche, pour la reconnexion automatique, le navigateur garde l'identifiant et le mot de passe du joueur dans son stockage local (`localStorage`). Sur un poste partagé, le joueur doit se déconnecter.
- Les API répondent avec `Access-Control-Allow-Origin: *`. Restreignez cet en-tête à votre domaine si le jeu est exposé sur Internet.
- Sauvegardez régulièrement les trois fichiers de données : ce sont les seules données persistantes du jeu.
