# 💑 CouplePlanner

Application web/mobile de gestion de tâches pour couples, basée sur le concept des **3 espaces** :

| Espace | Contenu | Visibilité |
|---|---|---|
| **Mon Espace** | Mes tâches privées (environnement `PRIVATE`) | Moi uniquement |
| **Notre Espace** | Tâches communes du couple (environnement `SHARED`) | Les deux |
| **Son Espace** | Tâches communes **assignées au partenaire** | Les deux |

**Stack** : Expo (React Native + Expo Router, iOS/Android/Web) · Node.js + Express + TypeScript · PostgreSQL + Prisma.

## Arborescence

```
CouplePlanner/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Modèle de données (Users, Couples, Environments, Tasks, Notification_Tokens)
│   │   └── seed.ts                # Données de démo (Alice & Bob)
│   └── src/
│       ├── server.ts              # Point d'entrée
│       ├── app.ts                 # Config Express (CORS, routes, erreurs)
│       ├── lib/prisma.ts          # Client Prisma partagé
│       ├── middleware/auth.ts     # JWT (signToken + requireAuth)
│       ├── routes/                # auth, tasks, notifications
│       ├── controllers/           # Logique des endpoints
│       └── services/
│           ├── voiceAnalyse.service.ts   # IA vocale MOCKÉE (extraction titre/espace/date)
│           └── conflict.service.ts       # Détection de conflit d'agenda
└── frontend/
    ├── app/
    │   ├── _layout.tsx            # AuthProvider racine
    │   ├── index.tsx              # Redirection login / tabs
    │   ├── login.tsx              # Écran de connexion
    │   └── (tabs)/                # Navigation 3 onglets (Mon/Notre/Son Espace)
    ├── components/
    │   ├── SpaceScreen.tsx        # Liste de tâches + bouton micro flottant
    │   ├── TaskCard.tsx           # Carte de tâche (tap = changement de statut)
    │   └── VoiceModal.tsx         # Dictée simulée + POP-UP de validation IA
    ├── lib/                       # api.ts, auth-context.tsx, notify.ts
    └── types.ts
```

## Démarrage local

### 1. Base de données PostgreSQL

```bash
docker run --name coupleplanner-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=coupleplanner \
  -p 5432:5432 -d postgres:16
```

### 2. Backend

```bash
cd backend
cp .env.example .env          # adapter DATABASE_URL si besoin
yarn install
yarn prisma migrate dev --name init   # crée les tables + génère le client
yarn seed                     # comptes de démo + tâches
yarn dev                      # API sur http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
yarn install
yarn expo start                # puis "w" pour le web, ou scanner le QR code
```

> 📱 **Test sur téléphone** : le backend doit être joignable depuis le mobile.
> Lancez Expo avec l'IP de votre machine :
> `EXPO_PUBLIC_API_URL=http://192.168.1.X:3000 yarn expo start`

### Comptes de démo

- `alice@demo.fr` / `password123`
- `bob@demo.fr` / `password123`

### Création de comptes (couple lié)

Chaque partenaire a son propre compte, liés par un **code d'invitation** :

1. Personne A → « Créer un compte » → crée son couple → une bannière affiche un **code** (ex : `J5EK8K`).
2. Personne A partage le code.
3. Personne B → « Créer un compte » → active « J'ai un code d'invitation » → saisit le code → rejoint le couple.

Un couple est limité à **2 membres** ; l'espace commun est créé avec le 1er compte, l'espace privé de chacun à son inscription.

## Scénarios de test

**🎤 Création vocale (fonctionnalité phare)**
1. Connectez-vous avec Alice, appuyez sur le bouton micro flottant.
2. Appuyez sur **Dicter** et parlez (ex : « Ajoute à notre liste de réparer la voiture ce samedi »), ou tapez le texte.
3. L'IA (Gemini) extrait : titre « Réparer la voiture », espace « Notre Espace », date « Prochain samedi ».
4. Corrigez si besoin dans la pop-up, puis **Confirmer**.

> 🎙️ **Reconnaissance vocale** : fonctionne dans **Chrome** (`yarn web`) sans configuration, et sur iOS/Android via un **build de dev** (`npx expo run:ios` / `run:android`) — pas dans Expo Go (module natif). Sans micro disponible, le champ texte reste utilisable en repli.

**⚠️ Conflit d'agenda**
Le seed crée une tâche **privée** pour Bob samedi prochain de 10h à 12h.
Avec Alice, dictez : `Ajoute à notre liste un brunch samedi à 10h` → à la confirmation,
l'alerte « Le partenaire a déjà un engagement privé sur ce créneau » s'affiche,
**sans révéler le titre** de la tâche privée de Bob.

## API

| Méthode | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Connexion → JWT + infos partenaire |
| GET | `/api/auth/me` | Profil courant |
| GET | `/api/tasks?space=mine\|ours\|partner` | Tâches filtrées par espace |
| POST | `/api/tasks` | Création (renvoie `has_conflict` si créneau privé du partenaire) |
| PATCH | `/api/tasks/:id` | Changement de statut |
| POST | `/api/tasks/voice-analyse` | Analyse IA mockée d'un texte dicté |
| GET | `/api/calendar?from=…&to=…` | Événements datés du couple sur une plage (privés du partenaire opacifiés « Occupé ») |
| POST | `/api/notification-tokens` | Enregistrement d'un token push |

## Limites du MVP / pistes d'évolution

- **IA vocale** : `voiceAnalyseAI.service.ts` appelle Google Gemini (palier gratuit) en extraction structurée ; sans `GEMINI_API_KEY`, repli automatique sur le mock regex `voiceAnalyse.service.ts`. Côté client, le Speech-to-Text reste à brancher (`expo-speech-recognition`).
- **Auth** : token JWT gardé en mémoire (perdu au refresh) — persister avec `expo-secure-store` ; ajouter l'inscription et l'invitation du partenaire.
- **Notifications** : les tokens sont stockés mais aucun push n'est envoyé (brancher Expo Push Notifications).
- **Fuseaux horaires** : dates gérées en heure locale du serveur — passer à un stockage UTC + TZ utilisateur.
