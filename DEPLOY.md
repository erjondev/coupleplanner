# Déploiement sur alwaysdata — coupleplanner.alwaysdata.net

Un seul sous-domaine disponible → **un seul domaine, deux chemins**, chacun étant un « site » alwaysdata distinct :

| Brique | Type de site alwaysdata | Domaine + chemin |
|---|---|---|
| Base de données | PostgreSQL (Databases) | `postgresql-<compte>.alwaysdata.net:5432` |
| Frontend (web) | Site **Fichiers statiques** | `coupleplanner.alwaysdata.net` / `/` |
| Backend (API) | Site **Node.js** | `coupleplanner.alwaysdata.net` / `/api` |

alwaysdata permet plusieurs sites sur le même domaine avec des chemins différents (`example.com/` et `example.com/blog` peuvent être deux sites distincts) — c'est ce mécanisme qu'on utilise ici.

> Le code a été préparé pour ce déploiement (commits précédents) : CORS restreignable via `CORS_ORIGIN`, écoute sur `PORT`/`IP`, migrations Prisma en mode production (`prisma migrate deploy`), export web Expo (`build:web --clear`) avec fallback SPA (`.htaccess`), et **routes API montées à la fois sur `/api/...` et sur `/...`** dans [app.ts](backend/src/app.ts) — je n'ai pas pu vérifier avec certitude si le proxy alwaysdata conserve ou retire le préfixe `/api` d'un chemin avant de le transmettre au process Node, donc le backend répond dans les deux cas plutôt que de parier dessus (vérifié en local : `curl /api/auth/login` et `curl /auth/login` répondent tous les deux 200).

---

## 0. Prérequis

- Accès SSH activé : **Panel alwaysdata > Remote access > SSH** → activer, définir un mot de passe ou une clé SSH.
  Doc : https://help.alwaysdata.com/en/web-hosting/remote-access/ssh/

---

## 1. Base de données PostgreSQL

**Panel > Databases > PostgreSQL > Add a database**
- Nom : `coupleplanner`
- Notez le serveur affiché : `postgresql-<compte>.alwaysdata.net`

**Panel > Databases > PostgreSQL Users > Add a database user**
- Créez un utilisateur (ex: `coupleplanner`), mot de passe, puis donnez-lui tous les droits sur la base `coupleplanner`.

Construisez la chaîne de connexion :
```
postgresql://<user>:<password>@postgresql-<compte>.alwaysdata.net:5432/coupleplanner?schema=public
```
Gardez-la de côté, elle sert de `DATABASE_URL`.

Doc : https://help.alwaysdata.com/en/web-hosting/databases/postgresql/

---

## 2. Récupérer le code sur le serveur (SSH)

```bash
ssh <user>@ssh-<compte>.alwaysdata.net
git clone <url-de-votre-repo> ~/coupleplanner
cd ~/coupleplanner
```

Si le repo est privé, utilisez une clé de déploiement GitHub ou un token dans l'URL HTTPS.

---

## 3. Backend — site Node.js sur `/api`

**Panel > Web > Sites > Add a site**
- Type : **Node.js**
- Domaine : `coupleplanner.alwaysdata.net`
- Chemin : `/api`
- Répertoire de travail : `~/coupleplanner/backend`
- Commande : `node dist/server.js`

Doc de config Node.js : https://help.alwaysdata.com/en/languages/nodejs/

### Variables d'environnement du site
Dans la configuration du site (section variables d'environnement), ajoutez :

| Clé | Valeur |
|---|---|
| `DATABASE_URL` | la chaîne construite à l'étape 1 |
| `JWT_SECRET` | une valeur aléatoire longue (`openssl rand -hex 32`) |
| `CORS_ORIGIN` | `https://coupleplanner.alwaysdata.net` (le frontend et l'API étant sur le même domaine, c'est surtout une protection en profondeur ici — utile si vous ajoutez plus tard un accès direct à l'API depuis un autre domaine) |
| `GEMINI_API_KEY` | votre clé Gemini (optionnel — sans clé, repli automatique sur le mock) |

(`PORT` et `IP` sont fournis automatiquement par alwaysdata, pas besoin de les définir.)

### Build + migrations (via SSH)
```bash
cd ~/coupleplanner/backend
npm install          # installe aussi les devDependencies → prisma CLI dispo (postinstall lance prisma generate)
cp .env.example .env # puis éditez .env avec les mêmes valeurs que ci-dessus (utile pour lancer des commandes en SSH)
npx prisma migrate deploy   # applique les migrations en base — JAMAIS `migrate dev` en production
npm run build         # compile TypeScript -> dist/
npm run seed           # optionnel : données de démo (Alice/Bob) — à éviter si vous avez déjà des données réelles
```

Redémarrez le site depuis le panel (ou il redémarre seul au premier appel). Vérifiez :
```bash
curl https://coupleplanner.alwaysdata.net/api/health
# {"status":"ok"}
```
Si ça renvoie une 404, testez aussi `curl https://coupleplanner.alwaysdata.net/health` (sans `/api`) — ça confirmerait que le proxy retire le préfixe, ce que le backend gère déjà des deux côtés.

---

## 4. Frontend — site fichiers statiques sur `/`

Le frontend et l'API étant **sur le même domaine**, l'URL de l'API peut être **relative** (pas besoin d'indiquer un domaine) : `EXPO_PUBLIC_API_URL=""`. Les appels partiront de `/api/...`, résolus par le navigateur vers `https://coupleplanner.alwaysdata.net/api/...` — aucun souci de CORS.

⚠️ Cette variable est figée dans le bundle JS **au moment du build**, jamais lue au runtime. Et le cache de Metro (le bundler) **ne s'invalide pas automatiquement** si vous changez juste la variable d'environnement entre deux builds — le script `build:web` inclut déjà `--clear` pour éviter ce piège (vérifié : sans `--clear`, un rebuild avec une variable différente réutilisait silencieusement l'ancienne valeur inlinée).

```bash
cd ~/coupleplanner/frontend
npm install
EXPO_PUBLIC_API_URL="" npm run build:web
```

Cela génère `frontend/dist/` (fichiers statiques + `.htaccess` de fallback SPA).

**Panel > Web > Sites > Add a site**
- Type : **Fichiers statiques**
- Domaine : `coupleplanner.alwaysdata.net`
- Chemin : `/`
- Répertoire : `~/coupleplanner/frontend/dist`

Vérifiez ensuite dans un navigateur :
- `https://coupleplanner.alwaysdata.net` → écran de connexion
- Rafraîchir sur `https://coupleplanner.alwaysdata.net/login` → ne doit **pas** faire de 404 (grâce au `.htaccess`)
- Se connecter → si l'API répond bien, la connexion doit fonctionner sans erreur CORS dans la console

---

## 5. Mettre à jour après un nouveau commit

```bash
ssh <user>@ssh-<compte>.alwaysdata.net
cd ~/coupleplanner && git pull

# Backend
cd backend && npm install && npx prisma migrate deploy && npm run build

# Frontend
cd ../frontend && npm install && EXPO_PUBLIC_API_URL="" npm run build:web
```

Le site Node.js redémarre automatiquement (surveillance de process par alwaysdata) ; le site statique sert immédiatement les nouveaux fichiers.

---

## Pour un build mobile (iOS/Android), plus tard

Contrairement au web, une app mobile n'a pas de notion d'« origine » : il faut lui donner l'URL complète, pas une URL relative.
```bash
EXPO_PUBLIC_API_URL=https://coupleplanner.alwaysdata.net/api npx expo run:ios
```
(Le `/api` fait partie de l'URL de base ici, contrairement au web où il est déjà préfixé sur chaque appel — à garder en tête si vous testez ce chemin.)

---

## Notes et points à vérifier vous-même

- **Comportement du préfixe `/api`** : géré des deux côtés côté backend (voir plus haut), mais si aucune des deux formes ne répond, le souci est probablement ailleurs (site mal configuré, process arrêté) — vérifiez les logs du site dans le panel.
- **Emplacement des variables d'environnement** dans le panel peut avoir un intitulé légèrement différent selon la version de l'interface — cherchez « Environment » / « Variables d'environnement » dans l'édition du site.
- **Notifications push, IA vocale (Gemini)** : optionnelles, l'app reste fonctionnelle sans (repli mock déjà en place).
- Sources consultées : [Node.js](https://help.alwaysdata.com/en/languages/nodejs/) · [PostgreSQL](https://help.alwaysdata.com/en/web-hosting/databases/postgresql/) · [SSH](https://help.alwaysdata.com/en/web-hosting/remote-access/ssh/) · [Déployer une app React](https://help.alwaysdata.com/en/guides/deploy-react-app/)
