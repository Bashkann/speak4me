# Frontend assumptions and backend compatibility

## Friends and direct-message decisions

- Registration derives a public, unique handle from the display name plus a random suffix. Existing accounts receive a non-email, ID-derived handle in the migration; changing handles is intentionally not part of this release.
- An unordered user pair is represented by a canonical sorted `pairKey`. `requesterId` and `addresseeId` preserve request direction while pending; for `BLOCKED`, `requesterId` is the blocker. Only the blocker can remove that block.
- One friendship record exists per pair. Blocking replaces any pending or accepted relationship, and unblocking removes the relationship entirely rather than restoring a previous friendship.
- User discovery returns only id, handle, display name, and relationship state. Emails remain available only in the authenticated user's own account payload and administrator views.
- A conversation is also unique per canonical pair. Existing history remains stored, but REST history, sends, read updates, typing, and realtime delivery require an accepted, unblocked friendship at the time of the action. Removing or blocking a friend makes that conversation unavailable until a new friendship is accepted.
- Message bodies are stored as plain text after Unicode normalization, trimming, control-character removal, and a 2,000-character cap. The React client renders them as text and never injects message HTML.
- Chat presence is process-local and represents active authenticated `/chat` socket connections. The app keeps that namespace connected even while a learner is inside a LiveKit room. The existing single-API-instance production requirement therefore also applies to friend presence.
- `POST /api/conversations/:id/messages` accepts either an existing conversation id or an accepted friend's user id; the latter creates the canonical conversation on the first message. The explicit `POST /api/conversations` route is used by the frontend when opening an empty chat.
- Images are off by default and never use local disk. Enabling them requires complete server-only S3-compatible configuration. A signed upload records an expiring, user-owned, single-use grant; sending a message references that grant id, so clients cannot persist an arbitrary image URL.
- Browser-side file checks improve feedback, but the server remains authoritative for allowed MIME types, configured maximum size, grant ownership, expiration, and one-time consumption. Bucket CORS and the signed content length provide the storage-side boundary.
- The responsive Messages view uses separate routes for the conversation list and selected chat. At the mobile breakpoint the selected chat hides the bottom navigation so the safe-area-aware composer remains above the keyboard.

## Mechanic v2 decisions

- A matchmaking batch is not a persistent gameplay container. Four compatible queue entries are shuffled and committed as two ordinary `Room` records in one transaction; from that point onward the rooms are independent.
- `Room.capacity` is persisted as 2 for new matched and private rooms. The legacy `Pair` field remains on participants only for seat/order compatibility; `RoomRound.speakerUserId` and `listenerUserId` are authoritative.
- The configurable topic-offer cap counts the initial suggestion. With the default value 3, a Speaker has two successful swaps. Reaching the third offer locks the card immediately; another request returns `topic_locked` without changing data.
- Choosing the previous topic in round two does not consume a swap. That prior topic is added to the round's shown-topic set so a later swap cannot immediately re-offer it.
- The 4→2+2 reveal is delivered in the realtime `matched` payload. If a client recovers the match only through the REST status fallback, it enters its assigned room without replaying a fabricated split animation.
- Legacy `Room.topicRound1Id` and `topicRound2Id` columns remain read-only compatibility fields for sessions created before the `RoomRound` migration. New sessions persist topics exclusively through `RoomRound`.

The existing backend implementation and its served OpenAPI document are the integration source of truth. The frontend prompt used several earlier contract names, so the web app makes these explicit adaptations:

- Registration sends `englishLevel`, not `cefrLevel`. The backend and topic enums were extended additively to support the full A1–C2 range; topics also retain the `ALL` level.
- Registration accepts optional `nativeLanguage`, `goals`, and `interests` so older clients remain compatible. The onboarding wizard makes them part of its own completion rules.
- The existing current-user convention remains `/api/me`, so profile editing uses `PATCH /api/me` rather than introducing a duplicate `/api/users/me` route. Session history remains `/api/me/sessions`, and the compact totals endpoint is `/api/me/stats`.
- Interests are stored and editable but do not alter matchmaking. Level compatibility and queue age remain authoritative so an interest preference can never delay a valid group.
- Roles are `USER` and `ADMIN`, with `USER` as the database default. Client-side admin routing is only a convenience; all `/api/admin/*` endpoints use server-side `requireAdmin` authorization.
- Suspension uses a nullable `suspendedAt` timestamp and is checked during login, refresh, authenticated REST requests, Socket.IO authentication, and matchmaking. An administrator cannot demote or suspend their own active account through the admin endpoint.
- Admin topic deletion is implemented as a soft archive (`isActive = false`) to preserve topic references in finished session history. Reports similarly retain their record and use `resolvedAt`.
- Private-room create and join return a room snapshot directly rather than `{ room, code }`. The frontend reads `id` and `code` from that snapshot.
- Realtime room state uses `speakerUserId` and `listenerUserId`, never a client-assigned role. `round_started` carries the topic, server deadline, remaining swaps, and the optional previous-topic choice; topic changes are emitted as `topic_updated` or `topic_locked`.
- Absolute `endsAt`/`roundEndsAt` timestamps are authoritative. The emitted countdown seconds are not used as a client-started timer.
- History items expose `topics` and `partners` but no historical CEFR level, so the History page does not invent one.
- Matchmaking still requires four compatible queued users, then atomically creates two independent two-person rooms. Private sessions require exactly two people and run the same cycle.
- Authentication is stored in `sessionStorage`, which is isolated per independently opened tab/profile. A duplicated tab may initially clone browser session storage, so multi-user tests should open fresh tabs or profiles before logging in.
- LiveKit connects while the room is waiting so server permission changes can reach the participant. Microphone capture is requested only when the local participant becomes a speaker. On a role change to listener, the frontend disables and unpublishes all local microphone tracks even though the server also enforces the restriction.
- Socket authentication failures use the same deduplicated refresh-token rotation as REST requests, then explicitly reconnect with the new access token. A refresh failure clears the tab-scoped session.
- Docker uses the internal `LIVEKIT_URL` for API-to-LiveKit RPC and `LIVEKIT_PUBLIC_URL` for the browser URL returned by the voice-token endpoint. Local non-Docker development can omit the public override.
- Local LiveKit advertises `127.0.0.1` as its ICE node address. Without that explicit Docker development setting, the browser can receive an unreachable container address even though token creation succeeds.
- The mechanic-v2 pass intentionally changes matchmaking, room state, Socket.IO payloads, and persisted rounds while leaving authentication, onboarding, profiles, admin panels, and the LiveKit integration approach intact.
- Ambient authentication motion is intentionally slower than interaction feedback, but it is decorative, transform-only, and completely disabled when reduced motion is requested. Interactive feedback stays within roughly 120–320 ms and never gates input.
- Loading skeletons are visual placeholders only; existing query loading/error/data states remain authoritative. Empty-state copy does not fabricate application records.
- Dashboard counters animate only for the first non-zero value mounted in that view. Later live refreshes update immediately instead of replaying the count-up.
- The mascot pass is frontend-only. It does not change authentication requests, matchmaking, room state, LiveKit permissions, database data, or any server event contract.
- The rounded green buddy is an original, deliberately simple inline SVG. Its expressions use only transform/opacity motion; required information and actions remain readable and usable if the character is removed.
- Three effects from the CC0 `LottieFiles/test-files` data set are temporary visual accents. Their local derivatives are recolored to the Speak Four palette and credited in `frontend/CREDITS.md`; they are not third-party brand characters.
- `CharacterBuddy` always renders a static SVG pose first. Optional Lottie JSON and the light `lottie-react` player are dynamically imported only for loading, searching, and celebrating moods. A reduced-motion preference skips those imports, loops, and autoplay entirely.
- The Vite alias to the light Lottie SVG player is safe for the current basic-shape placeholders. Future final art that uses expressions or unsupported effects must remove the alias and remeasure the production bundle.
- The admin page is lazy-loaded because normal learners cannot reach it. The LiveKit room was already isolated as a separate route chunk and remains lazy-loaded.
- The API runs one process because matchmaking presence and timer leadership are intentionally in process and Redis is out of scope.
- React Router is kept on the current patched SPA release to address its link/navigation advisories. `npm audit` also flags an RSC action advisory in that package line; this Vite client does not enable React Server Components, server actions, SSR, or framework mode, so the affected execution path is absent.

## Production deployment assumptions

- The production topology is intentionally fixed to LiveKit Cloud, one always-on Railway API replica plus Railway PostgreSQL, and a static Vite frontend on Vercel. The local Compose LiveKit container is never deployed to production.
- Railway deploys from the repository root and reads `railway.json`; Vercel imports the same repository with `frontend` as its Root Directory.
- Railway Serverless/App Sleeping remains disabled. Matchmaking presence and timer leadership are in process, so the API must remain at exactly one replica until a distributed coordinator/Redis design is implemented.
- Railway's PostgreSQL service is assumed to be named `Postgres` for the `${{Postgres.DATABASE_URL}}` reference shown in the runbook. If the human chooses another service name, they must update that reference.
- Production REST and Socket.IO CORS use an exact, comma-separated origin allowlist. Dynamic Vercel preview domains are not wildcarded; any preview origin must be added explicitly.
- `VITE_API_URL` is public build-time configuration and ends in `/api`. Socket.IO derives the backend origin from it; no independent WebSocket variable is necessary. Changing the backend domain requires a new Vercel build.
- The browser-facing LiveKit URL remains runtime data from `POST /api/rooms/:id/voice-token`; no LiveKit URL or credential is baked into the frontend. For LiveKit Cloud, internal and public URLs are normally the same `wss://` Project URL.
- Production pre-deploy runs the idempotent topics-only seed so sessions always have their required topic library. Administrator seeding remains explicitly opt-in through `npm run db:seed:production`; production never creates local demo users.
- The VPS Compose alternative binds the API to loopback and assumes a separately managed HTTPS reverse proxy with WebSocket upgrade support. TLS termination is intentionally not bundled with the API/PostgreSQL Compose file.
- LiveKit, Vercel, and Railway plan names, quotas, and pricing were checked against official documentation on 2026-08-03 and may change. Vercel Hobby is assumed only for a qualifying personal/non-commercial demo; the human must verify current terms before commercial use.

## One-way production audio (2026-08-04)

- Root cause: not a LiveKit Cloud/credentials/TURN/permission problem. `config.ts` already rejects a non-`wss://` `LIVEKIT_URL`/`LIVEKIT_PUBLIC_URL` at boot in production (health check would fail), and `VoiceService.updatePermissions` correctly flips `canPublish` server-side on every round/role change. The bug was purely client-side UI: `useLiveKitAudio` already tracked `playbackBlocked`/`resumeAudio` for the browser's autoplay-block on the dynamically created remote `<audio>` element, but `RoomPage` only ever surfaced the "enable audio" recovery control inside the desktop-only `AudioControls` panel (`hidden md:block`). Phones hitting the mobile layout (`MobileRoomControls`) had no way to unblock playback, so a listening phone stayed silently blocked while the same phone's own outgoing mic (phone-as-speaker) worked fine and needed no such recovery step — matching the reported one-way symptom and why two desktop tabs on one machine (autoplay rarely blocked) worked in both directions.
- Fix: added a viewport-independent "Tap to enable audio" banner in `RoomPage.tsx` driven by `audio.playbackBlocked`, and removed the now-redundant desktop-only button. Added dev-only (`import.meta.env.DEV`) console logging in `useLiveKitAudio.ts` of connection state, reconnection, ICE/connection quality, local/remote track publish/subscribe, subscription failures, and permission changes, to make future direction-of-failure diagnosis possible without re-deriving this from scratch.
- No changes were made to the LiveKit speaker/listener permission model; the server remains the sole authority for `canPublish`.

## Google sign-in (2026-08-04)

- `User.passwordHash` becomes nullable and `googleId`/`avatarUrl` are added; a Google-only account has no password and cannot use `/auth/login`. Linking sets `googleId`/`avatarUrl` on the existing password account rather than creating a second row for the same email.
- The server is the confidential OAuth client (authorization-code flow with `GOOGLE_CLIENT_SECRET`), not the browser. `GET /api/auth/google` sets a short-lived, httpOnly, `SameSite=Lax` state cookie and redirects to Google; `GET /api/auth/google/callback` verifies that state (mitigating login CSRF), exchanges the code server-to-server over HTTPS, and never receives or trusts a client-supplied ID token.
- Tokens are handed back to the SPA via the URL *fragment* (`/auth/callback#accessToken=...&refreshToken=...`), not a query string, so they never reach server access logs or `Referer` headers; the frontend strips the fragment immediately after reading it and stores tokens exactly like a password login.
- "Needs onboarding" is derived, not stored: `!nativeLanguage || goals.length === 0 || interests.length === 0`. The existing password `OnboardingWizard` already requires all three before it will call `register`, so this is `false` for every organic password signup and `true` for a fresh Google account, with no extra column or migration to keep in sync. New Google accounts default to `englishLevel: 'B1'` (same default the wizard offers) since that column stays `NOT NULL`.
- `/onboarding` reuses the wizard's existing goal/level/language/interest step components (now exported from `OnboardingWizard.tsx`) against `PATCH /api/me`, rather than introducing a second copy of that UI or a separate "complete profile" endpoint.
- `GET /api/auth/providers` is the single source of truth the frontend polls to decide whether to render the Google button; the client never infers this from a build-time env var, so the same frontend build works whether or not Google is configured on the backend.
- `FRONTEND_URL` is a new optional var (defaults to the first `CORS_ORIGIN` entry) used only to build OAuth/reset redirect targets; it does not affect CORS itself.
