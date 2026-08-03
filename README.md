# English Speaking Rooms API

Backend v2 for English speaking practice. Matchmaking gathers four compatible learners and atomically splits them into two independent two-person rooms. Each room has one server-authoritative Speaker, one Listener, two timed rounds, topic swaps, recoverable timers, and LiveKit audio permissions.

The repository also includes a React test frontend in [`frontend/`](frontend/README.md) that exercises the complete multi-user and LiveKit flow.

For the exact LiveKit Cloud + Railway + Vercel production procedure, use [`DEPLOY.md`](DEPLOY.md). It includes environment variables, first-admin seeding, smoke tests, custom domains, costs, and troubleshooting.

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
- Web test app (Docker): `http://localhost:5174`

Health checks are available at both `/healthz` and `/api/healthz`. The Docker development LiveKit credentials are `devkey` / `secret`; change them outside local development.

Demo accounts are `demo1@example.com` through `demo8@example.com`, all with password `DemoPass123!`. The seeded administrator is `admin@example.com` with the same password. These credentials are only for local development.

## Web experience

New accounts use a six-step onboarding flow that collects account details, goals, CEFR level (A1–C2), native language, and conversation interests. Signed-in users can edit those fields and view practice statistics at `/profile`.

Administrators see an additional `/admin` navigation item. The panel includes community statistics, searchable user/role/suspension controls, active-room force close, report resolution, and topic management. Every `/api/admin/*` endpoint also enforces the admin role server-side; hiding the navigation is not the security boundary.

The frontend includes light, dark, and system themes, responsive desktop navigation, and a mobile bottom tab bar. At 375px the two participant cards stack cleanly while large microphone/leave controls remain above the safe area.

Accepted friends can exchange persistent one-to-one messages through the `/chat` Socket.IO namespace. The Friends screen supports handle/name discovery, incoming and outgoing requests, removal, and blocking without exposing email addresses. Conversation access is checked again on every send, and unread, typing, read, and presence state update in real time.

The interface also includes reduced-motion-aware micro-interactions, floating-label authentication, animated onboarding feedback, loading skeletons, friendly empty states, sliding navigation indicators, audio-responsive room feedback, and an original contextual buddy that reacts without covering controls. Optional CC0 Lottie accents are credited and lazy-loaded. The admin route is lazy-loaded to keep it out of the normal learner path.

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

The tests include pure matchmaking/state/disconnect rules, an HTTP auth lifecycle, admin authorization, a fake-timer queue-to-finished session, and LiveKit JWT/permission-flip checks.

## Environment

| Variable | Default/example | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL URL | Prisma connection string |
| `PORT` | required; `3000` locally | HTTP port; Railway injects it |
| `CORS_ORIGIN` | comma-separated origins | Exact frontend origins allowed by REST and Socket.IO |
| `JWT_ACCESS_SECRET` | 32+ chars | Access-token signing key |
| `JWT_REFRESH_SECRET` | 32+ chars | Refresh-token signing key |
| `ACCESS_TOKEN_TTL` | `15m` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Refresh token lifetime |
| `LIVEKIT_URL` | `ws://localhost:7880` locally | Server-side LiveKit URL; production requires LiveKit Cloud `wss://` |
| `LIVEKIT_PUBLIC_URL` | optional | Browser-facing LiveKit URL when it differs from `LIVEKIT_URL` (for example in Docker) |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | dev credentials | LiveKit token/RPC credentials |
| `MATCHMAKING_INTERVAL_MS` | `3000` | Queue scan interval |
| `MATCHMAKING_WIDEN_AFTER_SEC` | `120` | Wait before widening level range |
| `READY_COUNTDOWN_SEC` | `5` | Delay before round one |
| `ROUND_BREAK_SEC` | `20` | Break between rounds |
| `RECONNECT_GRACE_SEC` | `45` | Active-session reconnect grace |
| `DEFAULT_ROUND_DURATION_SEC` | `420` | Default round length; room requests accept 300–600 |
| `TOPIC_OFFER_CAP` | `3` | Total topics offered per speaker, including the initial suggestion |
| `IMAGE_UPLOADS_ENABLED` | `false` | Enables the optional S3-compatible image-message module |
| `IMAGE_MAX_BYTES` | `5242880` | Maximum signed image size (hard capped at 10 MB) |
| `S3_ENDPOINT` | optional | S3-compatible endpoint, required for providers such as Cloudflare R2 |
| `S3_REGION` / `S3_BUCKET` | required when enabled | Object-store region and private upload bucket |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | required when enabled | Server-only object-store credentials |
| `S3_PUBLIC_BASE_URL` | required when enabled | Public HTTPS base URL used in persisted messages |
| `LOG_LEVEL` | `info` | Pino log level |

All environment input is validated at startup. Refresh tokens are stored only as SHA-256 hashes and rotate on use.

### Optional image messages

Text messaging works with no storage configuration. To enable images, create an S3-compatible bucket, expose objects through a public HTTPS base URL, and set all image variables above. Configure the bucket's CORS policy to allow `PUT` from the exact frontend origin with the `Content-Type` header. The API signs five-minute, size-bound image PUTs and records a one-use upload grant; clients cannot attach arbitrary image URLs. Production uploads never touch Railway's ephemeral filesystem. If any required value is absent, startup rejects `IMAGE_UPLOADS_ENABLED=true`; with the default `false`, the image button stays hidden.

## One full session

1. Register or log in four users with `POST /api/auth/register` or `/api/auth/login`, then connect each token to Socket.IO namespace `/me`.
2. Each user calls `POST /api/matchmaking/queue`. The oldest compatible four are shuffled and committed as two separate two-person `Room` records in one database transaction.
3. `/me` emits `matched { matchId, roomId, pairIndex, split }`. Each learner sees the 4→2+2 reveal and enters only their assigned room.
4. Both users in each room connect to `/rooms` and emit `join { roomId }`. When both are present, the room emits `room_ready`; the two rooms then advance independently.
5. `round_started` identifies the exact `speakerUserId` and `listenerUserId`. LiveKit grants publishing only to that Speaker. The Speaker may emit `topic_swap` twice with the default cap, while the server rejects Listener or over-cap attempts.
6. After round one, `round_ended`, `role_swap`, and `round_break` are emitted. Round two offers a new topic plus `topic_choose_previous`; LiveKit publishing flips to the former Listener.
7. After both users speak, `session_finished` persists both `RoomRound` records to history and closes that room's LiveKit session. The parallel room finishes on its own timer.

Private rooms use `POST /api/rooms`, share the returned six-character `code`, and join through `POST /api/rooms/join`.

Profile updates use `PATCH /api/me`; `GET /api/me/stats` returns completed sessions, total practice minutes, and the latest session date. Additive registration fields (`nativeLanguage`, `goals`, and `interests`) remain optional for older clients.

Administrative operations are grouped under `/api/admin`: stats, users, active rooms, reports, and topics. Suspended users cannot log in, refresh an existing session, authenticate an API request, connect a socket, or enter matchmaking.

## Realtime and recovery behavior

The backend is authoritative for all transitions. `roundEndsAt` is persisted for ready/round/break timers. On startup, round one, break, and round two rooms are rescheduled from that timestamp; an expired transition runs immediately. Because socket presence cannot survive a process restart, active-room participants are marked disconnected and receive a fresh reconnect grace period. A restart during the five-second ready countdown returns the room to waiting.

Private-room disconnects while waiting free the seat immediately. If a matched participant leaves before start, that two-person room aborts and its remaining learner is requeued. During either round or the break, the disconnected participant gets 45 seconds to return; expiry aborts only that pair's room and closes its LiveKit session.

## Matchmaking and session details

- The queue is ordered by `enqueuedAt`. The oldest user anchors each greedy search for three compatible users.
- Normal groups have a maximum level distance of one step. Once the anchor has waited more than the widening threshold, its group may span two steps.
- Each compatible group of four is cryptographically shuffled, then split into two pairs. Both two-person rooms are created atomically; they never share timers, audio, topics, or abort state.
- Seat 1 speaks first and seat 2 speaks second, but runtime authority comes from persisted `RoomRound.speakerUserId`, not a client-supplied role.
- Private-room creators occupy seat 1 and one invited partner occupies seat 2. Private rooms run the identical two-round mechanic.
- Topic selection uses active topics matching either participant level plus `ALL`. A round never repeats a topic already shown during that round. The default cap is one initial suggestion plus two swaps.
- Round two starts with a fresh suggestion and links to round one so the new Speaker can explicitly continue the previous topic.
- Finished and aborted rooms are immutable. Aborted rooms have `finishedAt` set for operational auditing but are excluded from session history.

## Architecture

HTTP handling follows routes → controllers → services → repositories. Matchmaking compatibility, topic-cap rules, state transitions, and disconnect decisions live in `src/domain`. A single coordinator owns in-process presence/timers; durable room, round, roles, topics, swap counts, and deadlines remain in PostgreSQL. This version intentionally assumes one API process because Redis and distributed timer leadership are out of scope.
