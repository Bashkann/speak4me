# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Backend + React frontend for "Speak Four", an English speaking-practice app. Matchmaking gathers four
compatible learners and atomically splits them into two independent two-person rooms. Each room has one
server-authoritative Speaker, one Listener, two timed rounds with topic swaps, recoverable timers, and
LiveKit-brokered audio. The repo also has friend-only direct messaging (Socket.IO `/chat` namespace) with
optional gated image uploads.

- `src/` — Express + Socket.IO API (TypeScript, CommonJS output)
- `frontend/` — Vite + React test/reference client (see `frontend/README.md`)
- `prisma/` — schema, migrations, seed script
- `tests/` — Jest unit + integration tests (backend only; frontend tests live under `frontend/src`)

## Commands

Backend (run from repo root):
```bash
npm run dev              # tsx watch src/server.ts
npm run build             # tsc -p tsconfig.json -> dist/
npm run lint               # tsc --noEmit (there is no separate linter)
npm test                    # jest --runInBand (all tests)
npm run test:unit           # jest --runInBand tests/unit
npm run test:integration    # jest --runInBand tests/integration
npx jest tests/unit/matchmaking.test.ts   # single file
npx jest -t "some test name"              # single test by name

npm run db:generate       # prisma generate
npm run db:migrate         # prisma migrate deploy
npm run db:seed            # tsx prisma/seed.ts (30 topics + 8 demo users + admin)
```
Tests mock repositories/Prisma with in-memory fakes (see `tests/helpers.ts` for `testConfig`/`testLogger`) —
`npm test` does **not** require a live Postgres instance. Only running the actual server (`npm run dev`,
Docker Compose) needs a real database and LiveKit.

Frontend (run from `frontend/`):
```bash
npm run dev       # vite --host 0.0.0.0 --port 5173
npm run build      # tsc --noEmit -p tsconfig.app.json && vite build
npm test            # vitest run
npm run test:watch  # vitest
```

Full stack via Docker (applies migrations + seeds automatically):
```bash
docker compose up --build
```
Exposes API on `:3000` (`/api`, `/docs` Swagger UI, `/openapi.json`), LiveKit on `:7880`, Postgres on `:5432`,
and the web app on `:5174`. Dev LiveKit credentials are `devkey`/`secret`. Demo accounts are
`demo1@example.com`…`demo8@example.com` / `DemoPass123!`; admin is `admin@example.com` with the same password.

## Backend architecture

Strict layering: **routes → controllers → services → repositories**, wired up manually (no DI framework) in
`src/app.ts::createApplication`. Follow this pattern for anything new — a repository owns Prisma queries for
one model area, a service holds business logic and calls repositories/other services, a controller adapts
HTTP req/res to a service call, and `src/routes.ts` maps URLs to controller methods with rate limiters.

- `src/domain/` — pure, dependency-free functions: matchmaking compatibility (`matchmaking.ts`), room state
  transitions (`room-state.ts`), disconnect/reconnect rules (`disconnect.ts`), topic/round mechanics
  (`session-mechanic.ts`), level comparison (`levels.ts`), friendship pair logic (`social.ts`). These are the
  most heavily unit-tested files — put new business rules here, not in services, when they can be pure.
- `src/services/room-coordinator.ts` — the in-process, single-instance authority for live room state. Owns
  presence tracking and setTimeout-based timers for the ready countdown, both rounds, and the break; persists
  transitions to Postgres (`Room.status`, `Room.roundEndsAt`, `RoomRound`) so state survives a restart.
  `coordinator.recover()` runs on boot (`src/server.ts`) to reschedule/resolve any timers that were in flight
  when the process died — an expired transition on recovery runs immediately.
  **This design intentionally assumes exactly one API process** (no Redis, no distributed timer leadership);
  do not add horizontal scaling for rooms/matchmaking without redesigning this first.
- `src/services/matchmaking-service.ts` — polls the queue on an interval (`MATCHMAKING_INTERVAL_MS`), anchors
  each greedy match on the oldest queued user, widens the allowed level gap after
  `MATCHMAKING_WIDEN_AFTER_SEC`, and atomically creates two independent `Room` records (one Prisma
  transaction) for every four compatible users.
- `src/services/presence-registry.ts` — process-local online/offline tracking for the `/chat` namespace,
  independent of room presence.
- `src/realtime/publisher.ts` + `src/realtime/socket-gateway.ts` — Socket.IO wiring. Three namespaces:
  `/me` (per-user `matched` events, room `user:{id}` broadcast target), `/rooms` (join/leave, `topic_swap`,
  `topic_choose_previous`, server-pushed `room_state`/`round_started`/etc.), `/chat` (typing, `message_send`,
  `mark_read`, presence). All namespaces share the same JWT-based `authenticate` middleware; suspended/banned
  users are rejected at the socket handshake same as REST.
- `src/lib/errors.ts` — `AppError` + `asyncHandler`/`errorHandler` convention used everywhere instead of
  try/catch boilerplate in controllers.
- `src/config.ts` — all environment variables are validated with Zod at startup (`loadConfig`); there is no
  runtime `process.env` access outside this file. Add new env vars here, not ad hoc.
- `src/openapi.ts` — OpenAPI document generated from the same Zod schemas in `src/schemas/`, served at
  `/openapi.json` and `/docs`. Keep request/response schemas in `src/schemas/` in sync with reality; a test
  (`tests/integration/openapi.test.ts`) checks the document.

### Data model notes (see `prisma/schema.prisma`)

- `RoomRound` (not `Room.topicRound1Id`/`topicRound2Id`) is authoritative for per-round speaker/listener,
  topic, swap count, and lock state. The legacy `Room` topic columns are read-only compatibility fields for
  pre-migration sessions.
- `RoomParticipant.pair` (`A`/`B`) is legacy seat/order metadata only; runtime speaker/listener authority
  comes from `RoomRound.speakerUserId`/`listenerUserId`, never a client-supplied role.
- `Friendship` uses a canonical sorted `pairKey` (one row per unordered pair); for `BLOCKED` status,
  `requesterId` is the blocker. `Conversation` likewise has one row per canonical pair.
- Finished/aborted rooms are immutable; aborted rooms get `finishedAt` set for auditing but are excluded from
  session history.

## Realtime/recovery behavior worth knowing before touching room code

- `roundEndsAt` (persisted) is the single source of truth for timers — countdowns emitted to clients are
  informational, not authoritative.
- A private-room disconnect while waiting frees the seat immediately; a matched-room disconnect before start
  aborts that room and requeues the remaining learner; a disconnect during a round or break gets
  `RECONNECT_GRACE_SEC` (default 45s) before the room aborts.
- A restart during the 5-second ready countdown returns the room to `waiting` rather than resuming the
  countdown.

## Frontend notes

- API base URL comes from `VITE_API_URL` (build-time, must end in `/api`); Socket.IO derives its origin from
  the same value.
- Auth tokens live in `sessionStorage` (tab-isolated) — for manual multi-user testing open separate
  tabs/profiles rather than duplicating a tab.
- LiveKit connects as soon as a room is `waiting` so server-driven publish-permission flips reach the client;
  microphone capture only starts once the local participant actually becomes Speaker, and is explicitly
  unpublished on a role flip to Listener even though the server also enforces it.
- The admin route and the LiveKit room route are separate lazy-loaded chunks.
- See `ASSUMPTIONS.md` for the full list of deliberate frontend/backend contract decisions (handles vs.
  email-derived identity, image-upload grant flow, onboarding field compatibility, etc.) before changing any
  cross-cutting contract.

## Deployment

Production topology is fixed: LiveKit Cloud + one always-on Railway API replica + Railway Postgres + static
Vercel frontend — see `DEPLOY.md` for the exact runbook. The Railway API **must stay at exactly one replica**
(matchmaking/timers are in-process); `railway.json` disables serverless/sleeping intentionally. Do not
suggest scaling the API horizontally without first addressing the single-process assumption above.
