# English Speaking Rooms API

Backend v1 for four-person English speaking practice sessions. It provides a REST API, JWT-authenticated Socket.IO channels, PostgreSQL matchmaking and recoverable timers, plus self-hosted LiveKit audio permissions.

## Quick start

Requirements: Docker with Compose. The API image uses Node.js 20 and PostgreSQL 16.

```bash
docker compose up --build
```

The stack automatically applies Prisma migrations and seeds 30 topics plus eight demo users. It exposes:

- API: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/openapi.json`
- LiveKit WebSocket: `ws://localhost:7880`
- PostgreSQL: `localhost:5432`

Health checks are available at both `/healthz` and `/api/healthz`. The Docker development LiveKit credentials are `devkey` / `secret`; change them outside local development.

Demo accounts are `demo1@example.com` through `demo8@example.com`, all with password `DemoPass123!`.

## Local development

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Run verification with:

```bash
npm run build
npm test
```

The tests include pure matchmaking/state/disconnect rules, an HTTP auth lifecycle, a fake-timer queue-to-finished session, and LiveKit JWT/permission-flip checks.

## Environment

| Variable | Default/example | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL URL | Prisma connection string |
| `PORT` | `3000` | HTTP port |
| `JWT_ACCESS_SECRET` | 32+ chars | Access-token signing key |
| `JWT_REFRESH_SECRET` | 32+ chars | Refresh-token signing key |
| `ACCESS_TOKEN_TTL` | `15m` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Refresh token lifetime |
| `LIVEKIT_URL` | `ws://localhost:7880` | Client LiveKit URL; converted to HTTP for server RPC |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | dev credentials | LiveKit token/RPC credentials |
| `MATCHMAKING_INTERVAL_MS` | `3000` | Queue scan interval |
| `MATCHMAKING_WIDEN_AFTER_SEC` | `120` | Wait before widening level range |
| `READY_COUNTDOWN_SEC` | `5` | Delay before round one |
| `ROUND_BREAK_SEC` | `20` | Break between rounds |
| `RECONNECT_GRACE_SEC` | `45` | Active-session reconnect grace |
| `DEFAULT_ROUND_DURATION_SEC` | `420` | Default round length; room requests accept 300–600 |
| `LOG_LEVEL` | `info` | Pino log level |

All environment input is validated at startup. Refresh tokens are stored only as SHA-256 hashes and rotate on use.

## One full session

1. Register or log in four users with `POST /api/auth/register` or `/api/auth/login`. Registration returns the public user and both tokens; login returns the same shape.
2. Connect each access token to Socket.IO namespace `/me` using `auth: { token }`.
3. Each user calls `POST /api/matchmaking/queue`. Every three seconds, the oldest compatible users are grouped. `/me` emits `matched { roomId }` to each user.
4. Connect all users to namespace `/rooms` with the same auth shape, then emit `join { roomId }`. Each receives `room_state`. Once all four are present, the server emits `room_ready` and `countdown`.
5. Each user requests `POST /api/rooms/:id/voice-token`, then joins the returned LiveKit `url` with the returned token. Tokens always grant subscription. In round one only pair A tokens grant publishing; the server also updates connected LiveKit participants when a round changes.
6. The server emits `round_started` for pair A, `round_break` after the configured duration, then a second `round_started` for pair B with a different topic. Publish rights flip to pair B.
7. After round two, `session_finished` is emitted, the room is persisted as history, and the LiveKit room is closed. `GET /api/me/sessions` returns paginated finished sessions.

Private rooms use `POST /api/rooms`, share the returned six-character `code`, and join through `POST /api/rooms/join`.

## Realtime and recovery behavior

The backend is authoritative for all transitions. `roundEndsAt` is persisted for ready/round/break timers. On startup, round one, break, and round two rooms are rescheduled from that timestamp; an expired transition runs immediately. Because socket presence cannot survive a process restart, active-room participants are marked disconnected and receive a fresh reconnect grace period. A restart during the five-second ready countdown returns the room to waiting.

Disconnects while waiting or ready free the seat immediately. During either round or the break, the participant is marked disconnected and gets 45 seconds to reconnect. Expiry aborts the session, closes LiveKit, and places the remaining matchmade users at the front of the PostgreSQL queue.

## Matchmaking details and explicit v1 choices

- The queue is ordered by `enqueuedAt`. The oldest user anchors each greedy search for three compatible users.
- Normal groups have a maximum level distance of one step. Once the anchor has waited more than the widening threshold, its group may span two steps.
- Incomplete waiting matchmade rooms are topped up before new rooms are formed.
- Seat assignment is cryptographically shuffled for new matches; seats 1–2 are pair A and 3–4 pair B.
- Private-room creators occupy seat 1. Registration immediately signs the new user in. Topic selection uses active topics matching any participant level plus `ALL`, and round two excludes round one's topic.
- Finished and aborted rooms are immutable. Aborted rooms have `finishedAt` set for operational auditing but are excluded from session history.

## Architecture

HTTP handling follows routes → controllers → services → repositories. Matchmaking compatibility, state transitions, and disconnect decisions live in `src/domain` and have no Express, Socket.IO, or Prisma dependencies. A single coordinator owns in-process presence/timers; durable room status and deadlines remain in PostgreSQL. This v1 intentionally assumes one API process because Redis and distributed timer leadership are out of scope.
