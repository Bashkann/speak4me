# Frontend assumptions and backend compatibility

The existing backend implementation and its served OpenAPI document are the integration source of truth. The frontend prompt used several earlier contract names, so the web app makes these explicit adaptations:

- Registration sends `englishLevel`, not `cefrLevel`. The backend and topic enums were extended additively to support the full A1–C2 range; topics also retain the `ALL` level.
- Registration accepts optional `nativeLanguage`, `goals`, and `interests` so older clients remain compatible. The onboarding wizard makes them part of its own completion rules.
- The existing current-user convention remains `/api/me`, so profile editing uses `PATCH /api/me` rather than introducing a duplicate `/api/users/me` route. Session history remains `/api/me/sessions`, and the compact totals endpoint is `/api/me/stats`.
- Interests are stored and editable but do not alter matchmaking. Level compatibility and queue age remain authoritative so an interest preference can never delay a valid group.
- Roles are `USER` and `ADMIN`, with `USER` as the database default. Client-side admin routing is only a convenience; all `/api/admin/*` endpoints use server-side `requireAdmin` authorization.
- Suspension uses a nullable `suspendedAt` timestamp and is checked during login, refresh, authenticated REST requests, Socket.IO authentication, and matchmaking. An administrator cannot demote or suspend their own active account through the admin endpoint.
- Admin topic deletion is implemented as a soft archive (`isActive = false`) to preserve topic references in finished session history. Reports similarly retain their record and use `resolvedAt`.
- Private-room create and join return a room snapshot directly rather than `{ room, code }`. The frontend reads `id` and `code` from that snapshot.
- Realtime events use the implemented payloads: `room_ready { endsAt }`, `countdown { seconds }`, `round_started { round, speakingPair, topicText, endsAt }`, and `round_break { endsAt }`. The UI normalizes these into its room store.
- Absolute `endsAt`/`roundEndsAt` timestamps are authoritative. The emitted countdown seconds are not used as a client-started timer.
- History items expose `topics` and `partners` but no historical CEFR level, so the History page does not invent one.
- Matchmade and private sessions both require exactly four current room participants before the ready countdown.
- Authentication is stored in `sessionStorage`, which is isolated per independently opened tab/profile. A duplicated tab may initially clone browser session storage, so multi-user tests should open fresh tabs or profiles before logging in.
- LiveKit connects while the room is waiting so server permission changes can reach the participant. Microphone capture is requested only when the local participant becomes a speaker. On a role change to listener, the frontend disables and unpublishes all local microphone tracks even though the server also enforces the restriction.
- Socket authentication failures use the same deduplicated refresh-token rotation as REST requests, then explicitly reconnect with the new access token. A refresh failure clears the tab-scoped session.
- Docker uses the internal `LIVEKIT_URL` for API-to-LiveKit RPC and `LIVEKIT_PUBLIC_URL` for the browser URL returned by the voice-token endpoint. Local non-Docker development can omit the public override.
- Local LiveKit advertises `127.0.0.1` as its ICE node address. Without that explicit Docker development setting, the browser can receive an unreachable container address even though token creation succeeds.
- The craft pass changes presentation only. Authentication timing, onboarding payloads, matchmaking, room state, LiveKit permissions, and every backend contract remain unchanged.
- Ambient authentication motion is intentionally slower than interaction feedback, but it is decorative, transform-only, and completely disabled when reduced motion is requested. Interactive feedback stays within roughly 120–320 ms and never gates input.
- Loading skeletons are visual placeholders only; existing query loading/error/data states remain authoritative. Empty-state copy does not fabricate application records.
- Dashboard counters animate only for the first non-zero value mounted in that view. Later live refreshes update immediately instead of replaying the count-up.
- CSS/typographic symbols are used for onboarding micro-illustrations so the pass adds no image payload or extra animation dependency.
- The admin page is lazy-loaded because normal learners cannot reach it. The LiveKit room was already isolated as a separate route chunk and remains lazy-loaded.
- V1 runs one API process because matchmaking presence and timer leadership are intentionally in process and Redis is out of scope.
- React Router is kept on the current patched SPA release to address its link/navigation advisories. `npm audit` also flags an RSC action advisory in that package line; this Vite client does not enable React Server Components, server actions, SSR, or framework mode, so the affected execution path is absent.
