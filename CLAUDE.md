# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

CouplePlanner is a task-management app for couples built around a **"3 spaces" concept**:

| Space | Content | Visibility |
|---|---|---|
| **Mon Espace** | My private tasks (`Environment.type = PRIVATE`) | Me only |
| **Notre Espace** | Shared couple tasks (`Environment.type = SHARED`) | Both |
| **Son Espace** | Shared tasks assigned to the partner | Both |

Stack: Expo (React Native + Expo Router, iOS/Android/Web) for `frontend/`; Node.js + Express + TypeScript for `backend/`; PostgreSQL + Prisma.

UI copy, comments, and commit-adjacent docs are in French — match that convention when editing existing files.

## Commands

### Backend (`cd backend`)
- `yarn dev` — run the API with hot reload (`ts-node-dev`) on `http://localhost:3000`
- `yarn build` / `yarn start` — compile to `dist/` and run the compiled server
- `yarn prisma:generate` — regenerate the Prisma client after editing `schema.prisma`
- `yarn prisma:migrate` — create/apply a dev migration (`prisma migrate dev`)
- `yarn seed` — seed demo data (Alice & Bob accounts + sample tasks)
- No lint or test scripts are configured in this repo; use `npx tsc --noEmit` to typecheck.

### Frontend (`cd frontend`)
- `yarn start` / `yarn expo start` — start Metro; press `w` for web or scan the QR code
- `yarn web` — start directly in web mode
- `yarn ios` / `yarn android` — native dev builds (required for on-device speech recognition; not available in Expo Go)
- `EXPO_PUBLIC_API_URL=http://<lan-ip>:3000 yarn expo start` — point the app at the backend when testing on a physical device
- No lint or test scripts are configured; use `npx tsc --noEmit` to typecheck.

### Local database
```bash
docker run --name coupleplanner-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=coupleplanner -p 5432:5432 -d postgres:16
```

### Backend env (`backend/.env`, see `.env.example`)
- `DATABASE_URL`, `JWT_SECRET`, `PORT`
- `GEMINI_API_KEY` (optional) — enables real AI voice parsing via Gemini; when absent the backend silently falls back to a regex mock (`voiceAnalyse.service.ts`), so the feature stays functional without a key
- `GEMINI_MODEL` (optional, defaults to `gemini-2.5-flash`)

## Architecture

### Data model (`backend/prisma/schema.prisma`)
`Couple` 1—N `User`, and `Couple` 1—N `Environment`. An `Environment` is either `SHARED` (`userId = null`, one per couple) or `PRIVATE` (`userId` set, one per user). Every `Task` belongs to exactly one `Environment` — the space a task lives in is entirely determined by which environment it's attached to, not by a flag on the task itself. `Task.assignedTo` is used within a `SHARED` environment to distinguish "Notre Espace" (any shared task) from "Son Espace" (shared tasks assigned to the partner).

Couples are linked via `Couple.inviteCode`: the first signup creates the couple (+ its `SHARED` environment + creator's `PRIVATE` environment); a second signup with that code joins the couple (+ creates their own `PRIVATE` environment) and is capped at 2 members (`auth.controller.ts`).

### Space filtering (`tasks.controller.ts`)
`GET /api/tasks?space=mine|ours|partner` maps directly to a Prisma `where` on `Environment.type`/`userId`/`assignedTo` — this is the single source of truth for what each of the 3 tabs shows. When adding new task query behavior, extend this switch rather than filtering client-side.

### Privacy-preserving conflict detection (`services/conflict.service.ts`, `calendar.controller.ts`)
Core business rule: creating/updating a `SHARED` task with a time slot checks whether the partner has an overlapping `PRIVATE` task, and returns `has_conflict: true` with a **generic** message — the private task's title/content is never exposed. The same opacification happens in `GET /api/calendar`: a partner's private events come back as `{ visibility: 'partner_busy' }` with no title, only the time range. Any change touching tasks/calendar must preserve this confidentiality boundary — never join/select fields from another user's `PRIVATE` environment beyond the time range.

### Voice AI extraction (`services/voiceAnalyseAI.service.ts` + `voiceAnalyse.service.ts`)
`POST /api/tasks/voice-analyse` sends dictated French text to Gemini with a structured `responseSchema` (title, environment_type, due_date, due_datetime, is_all_day), passing today's date so relative dates ("ce samedi") resolve to absolute ISO dates. On missing API key, quota errors, or any failure, it falls back transparently to `voiceAnalyse.service.ts` (regex mock) — preserve this fallback when touching this path. On the client, `useSpeechRecognition` fills a text field live; `expo-speech-recognition` is a native module, so it only works in dev builds (`expo run:ios`/`run:android`) or Chrome web, not Expo Go.

### Auth (`middleware/auth.ts`, `lib/auth-context.tsx`)
JWT (`{ userId, coupleId }`, 30-day expiry) is issued on login/signup and required via `requireAuth` on all API routes except `/health` and `/api/auth/*`. Frontend stores the token via `lib/storage.ts` (secure store) and restores the session on boot by calling `/api/auth/me`; `lib/api.ts`'s `setAuthToken` holds the token in a module-level variable that `request()` attaches to every call — there's no interceptor/context threading, so any new API call must go through `lib/api.ts`.

### Frontend structure
- `app/` uses Expo Router file-based routing; `app/(tabs)/` holds the 4 authenticated tabs (Mon/Notre/Son Espace + Agenda), gated by `AuthProvider` in `app/_layout.tsx`.
- `components/SpaceScreen.tsx` is the shared list view driving all 3 space tabs (differs only by the `space` prop passed to `getTasks`); `TaskCard.tsx` handles the swipe-to-edit/delete gestures and status-cycle tap.
- `components/VoiceModal.tsx` is the flagship voice-entry flow: dictate/type → AI analysis → **mandatory review popup** (editable form) before the task is actually created. Don't skip the review step when modifying this flow.
- `lib/theme.ts` centralizes brand colors (`COLORS.primary`/`secondary`/`primaryLight`/`primaryBorder`); use it instead of hardcoding hex values in new screens/components. Functional/status colors (done=green, in-progress=orange, todo=grey, delete/conflict=red, edit/mic=blue) are intentionally separate from the brand palette and defined locally where used.
