# Déploiement sur alwaysdata — coupleplanner.alwaysdata.net

Le compte alwaysdata a un **quota disque limité**, insuffisant pour faire tourner `yarn install` sur place (React Native / Expo + Prisma, c'est lourd). La stratégie retenue : **tout se compile en local**, seuls les fichiers finaux (`dist/` compilé + dépendances de production) sont envoyés sur le serveur. Le serveur ne fait jamais tourner `yarn install`, `tsc` ni `prisma generate` — seulement `node dist/server.js`.

Un seul sous-domaine disponible → **un seul domaine, deux chemins**, chacun étant un « site » alwaysdata distinct :

| Brique | Type de site alwaysdata | Domaine + chemin | Contenu déployé |
|---|---|---|---|
| Base de données | PostgreSQL (Databases) | `postgresql-coupleplanner.alwaysdata.net:5432` | — |
| Frontend (web) | Site **Fichiers statiques** | `coupleplanner.alwaysdata.net` / `/` | `frontend/dist/` (build local) |
| Backend (API) | Site **Node.js** | `coupleplanner.alwaysdata.net` / `/api` | paquet backend précompilé (build local) |

alwaysdata permet plusieurs sites sur le même domaine avec des chemins différents (`example.com/` et `example.com/blog` peuvent être deux sites distincts) — c'est ce mécanisme qu'on utilise ici.

> Préparation du code (commits précédents), **tout vérifié en conditions réelles** (conteneur Debian 12 / OpenSSL 3.0.20 / x86_64, identique au serveur) :
> - CORS restreignable via `CORS_ORIGIN`, écoute sur `PORT`/`IP` fournis par alwaysdata.
> - Client Prisma généré pour `debian-openssl-3.0.x` en plus de la plateforme locale ([schema.prisma](backend/prisma/schema.prisma)) — sans ça, le binaire natif (macOS) ne fonctionnerait pas sur le serveur.
> - Routes API montées à la fois sur `/api/...` et `/...` ([app.ts](backend/src/app.ts)) — le comportement exact du proxy alwaysdata sur le préfixe de chemin n'a pas pu être confirmé côté doc, donc le backend répond dans les deux cas.
> - **`express-async-errors`** ajouté ([app.ts](backend/src/app.ts)) — bug trouvé en testant : sans ça, la moindre erreur async non catchée (ex: base de données injoignable un instant) faisait planter **tout le process**, pas juste la requête en cours. Reproduit puis corrigé, confirmé par test : le serveur renvoie maintenant une 500 propre et reste en vie.
> - Export web Expo (`build:web --clear`) avec fallback SPA (`.htaccess`) — le `--clear` est nécessaire car le cache de Metro garde silencieusement l'ancienne valeur de `EXPO_PUBLIC_API_URL` sinon (vérifié).
> - [backend/scripts/pack-for-deploy.sh](backend/scripts/pack-for-deploy.sh) : construit un paquet backend sans les dépendances de dev (~36 Mo compressé au lieu de 210+ Mo avec `node_modules` complet), testé de bout en bout.

---

## 0. Prérequis

- Accès SSH activé : **Panel alwaysdata > Remote access > SSH** → activer, définir un mot de passe ou une clé SSH.
  Doc : https://help.alwaysdata.com/en/web-hosting/remote-access/ssh/
- En local : `yarn`, `docker` (optionnel, pour vérifier avant d'envoyer), `rsync` (préinstallé sur macOS).

---

## 1. Base de données PostgreSQL

**Panel > Databases > PostgreSQL > Add a database**
- Nom : `coupleplanner`
- Notez le serveur affiché : `postgresql-coupleplanner.alwaysdata.net`

**Panel > Databases > PostgreSQL Users > Add a database user**
- Créez un utilisateur (ex: `coupleplanner`), mot de passe, puis donnez-lui tous les droits sur la base `coupleplanner`.

Construisez la chaîne de connexion :
```
postgresql://coupleplanner:<password>@postgresql-coupleplanner.alwaysdata.net:5432/coupleplanner?schema=public
```
Gardez-la de côté, elle sert de `DATABASE_URL`.

Doc : https://help.alwaysdata.com/en/web-hosting/databases/postgresql/

---

## 2. Backend — build local + upload

### 2.1 Construire le paquet (en local, depuis `backend/`)
```bash
cd backend
./scripts/pack-for-deploy.sh
```
Produit `backend/coupleplanner-backend-deploy.tar.gz` (~36 Mo). Le script installe les dépendances, génère le client Prisma (natif + `debian-openssl-3.0.x`), compile TypeScript, puis retire tout ce qui n'est utile qu'en développement (`typescript`, `ts-node`, `ts-node-dev`, `prisma` CLI, `@types/*`, le moteur Prisma natif macOS).

### 2.2 Envoyer sur le serveur
```bash
scp coupleplanner-backend-deploy.tar.gz coupleplanner@ssh-coupleplanner.alwaysdata.net:~/
ssh coupleplanner@ssh-coupleplanner.alwaysdata.net
mkdir -p ~/coupleplanner-backend
tar xzf coupleplanner-backend-deploy.tar.gz -C ~/coupleplanner-backend
rm coupleplanner-backend-deploy.tar.gz
```

### 2.3 Migrations (en local, contre la base de production — pas besoin d'outillage sur le serveur)
```bash
cd backend
DATABASE_URL="postgresql://coupleplanner:<password>@postgresql-coupleplanner.alwaysdata.net:5432/coupleplanner?schema=public" \
  yarn prisma:deploy   # = prisma migrate deploy — JAMAIS `prisma:migrate` (migrate dev) en production
```
La base alwaysdata est joignable depuis l'extérieur via son nom d'hôte public, donc pas besoin d'être en SSH pour ça.

### 2.4 Créer le site Node.js
**Panel > Web > Sites > Add a site**
- Type : **Node.js**
- Domaine : `coupleplanner.alwaysdata.net`
- Chemin : `/api`
- Répertoire de travail : `~/coupleplanner-backend`
- Commande : `node dist/server.js`

Doc de config Node.js : https://help.alwaysdata.com/en/languages/nodejs/

### Variables d'environnement du site
Dans la configuration du site (section variables d'environnement), ajoutez :

| Clé | Valeur |
|---|---|
| `DATABASE_URL` | la chaîne construite à l'étape 1 |
| `JWT_SECRET` | une valeur aléatoire longue (`openssl rand -hex 32`) |
| `CORS_ORIGIN` | `https://coupleplanner.alwaysdata.net` (le frontend et l'API étant sur le même domaine, c'est surtout une protection en profondeur) |
| `GEMINI_API_KEY` | votre clé Gemini (optionnel — sans clé, repli automatique sur le mock) |

(`PORT` et `IP` sont fournis automatiquement par alwaysdata.)

Vérifiez :
```bash
curl https://coupleplanner.alwaysdata.net/api/health
# {"status":"ok"}
```
Si ça renvoie une 404, testez aussi `curl https://coupleplanner.alwaysdata.net/health` (sans `/api`) — ça confirmerait que le proxy retire le préfixe, ce que le backend gère déjà des deux côtés.

---

## 3. Frontend — build local + upload

Le frontend et l'API étant **sur le même domaine**, l'URL de l'API peut être **relative** : `EXPO_PUBLIC_API_URL=""`. Les appels partiront de `/api/...`, résolus vers `https://coupleplanner.alwaysdata.net/api/...` — aucun souci de CORS.

```bash
cd frontend
yarn install
EXPO_PUBLIC_API_URL="" yarn build:web   # --clear est déjà dans le script, important : sinon Metro garde l'ancienne valeur en cache
```

Cela génère `frontend/dist/` (fichiers statiques + `.htaccess` de fallback SPA). Envoi :
```bash
ssh coupleplanner@ssh-coupleplanner.alwaysdata.net "mkdir -p ~/coupleplanner-frontend"
rsync -az --delete dist/ coupleplanner@ssh-coupleplanner.alwaysdata.net:~/coupleplanner-frontend/
```

**Panel > Web > Sites > Add a site**
- Type : **Fichiers statiques**
- Domaine : `coupleplanner.alwaysdata.net`
- Chemin : `/`
- Répertoire : `~/coupleplanner-frontend`

Vérifiez ensuite dans un navigateur :
- `https://coupleplanner.alwaysdata.net` → écran de connexion
- Rafraîchir sur `https://coupleplanner.alwaysdata.net/login` → ne doit **pas** faire de 404 (grâce au `.htaccess`)
- Se connecter → si l'API répond bien, la connexion doit fonctionner sans erreur CORS dans la console

---

## 4. Mettre à jour après un nouveau commit

Tout se refait en local, rien à installer sur le serveur :

```bash
# Backend
cd backend
./scripts/pack-for-deploy.sh
scp coupleplanner-backend-deploy.tar.gz coupleplanner@ssh-coupleplanner.alwaysdata.net:~/
ssh coupleplanner@ssh-coupleplanner.alwaysdata.net "rm -rf ~/coupleplanner-backend/* && tar xzf coupleplanner-backend-deploy.tar.gz -C ~/coupleplanner-backend && rm coupleplanner-backend-deploy.tar.gz"
# + relancez les migrations si le schéma a changé (voir 2.3)
# + redémarrez le site Node.js depuis le panel (l'ancien process continue de tourner sinon)

# Frontend
cd ../frontend
EXPO_PUBLIC_API_URL="" yarn build:web
rsync -az --delete dist/ coupleplanner@ssh-coupleplanner.alwaysdata.net:~/coupleplanner-frontend/
```

---

## Pour un build mobile (iOS/Android), plus tard

Contrairement au web, une app mobile n'a pas de notion d'« origine » : il faut lui donner l'URL complète, pas une URL relative.
```bash
EXPO_PUBLIC_API_URL=https://coupleplanner.alwaysdata.net/api npx expo run:ios
```
(Le `/api` fait partie de l'URL de base ici, contrairement au web où il est déjà préfixé sur chaque appel.)

---

## Notes et points à vérifier vous-même

- **Redémarrage du site Node.js** après un déploiement : nécessaire pour charger le nouveau code, via le panel (pas de rechargement automatique connu à l'écrasement des fichiers).
- **Comportement du préfixe `/api`** : géré des deux côtés côté backend (voir plus haut) ; si aucune des deux formes ne répond, vérifiez les logs du site dans le panel plutôt que le code.
- **Emplacement des variables d'environnement** dans le panel peut avoir un intitulé légèrement différent selon la version de l'interface — cherchez « Environment » / « Variables d'environnement » dans l'édition du site.
- **Notifications push, IA vocale (Gemini)** : optionnelles, l'app reste fonctionnelle sans (repli mock déjà en place).
- Sources consultées : [Node.js](https://help.alwaysdata.com/en/languages/nodejs/) · [PostgreSQL](https://help.alwaysdata.com/en/web-hosting/databases/postgresql/) · [SSH](https://help.alwaysdata.com/en/web-hosting/remote-access/ssh/) · [Déployer une app React](https://help.alwaysdata.com/en/guides/deploy-react-app/)
