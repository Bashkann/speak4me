# Frontend assumptions and backend compatibility

The existing backend implementation and its served OpenAPI document are the integration source of truth. The frontend prompt used several earlier contract names, so the web app makes these explicit adaptations:

- Registration sends `englishLevel`, not `cefrLevel`. The backend enum supports A2, B1, B2, and C1, so the UI does not offer A1 or C2 values that the API would reject.
- The current-user endpoint is `/api/me`; profile editing is not needed for this test app. Session history remains `/api/me/sessions`.
- Private-room create and join return a room snapshot directly rather than `{ room, code }`. The frontend reads `id` and `code` from that snapshot.
- Realtime events use the implemented payloads: `room_ready { endsAt }`, `countdown { seconds }`, `round_started { round, speakingPair, topicText, endsAt }`, and `round_break { endsAt }`. The UI normalizes these into its room store.
- Absolute `endsAt`/`roundEndsAt` timestamps are authoritative. The emitted countdown seconds are not used as a client-started timer.
- History items expose `topics` and `partners` but no historical CEFR level, so the History page does not invent one.
- Matchmade and private sessions both require exactly four current room participants before the ready countdown.
- Authentication is stored in `sessionStorage`, which is isolated per independently opened tab/profile. A duplicated tab may initially clone browser session storage, so multi-user tests should open fresh tabs or profiles before logging in.
- LiveKit connects while the room is waiting so server permission changes can reach the participant. Microphone capture is requested only when the local participant becomes a speaker. On a role change to listener, the frontend disables and unpublishes all local microphone tracks even though the server also enforces the restriction.
- Socket authentication failures use the same deduplicated refresh-token rotation as REST requests, then explicitly reconnect with the new access token. A refresh failure clears the tab-scoped session.
- Docker uses the internal `LIVEKIT_URL` for API-to-LiveKit RPC and `LIVEKIT_PUBLIC_URL` for the browser URL returned by the voice-token endpoint. Local non-Docker development can omit the public override.
- V1 runs one API process because matchmaking presence and timer leadership are intentionally in process and Redis is out of scope.
- React Router is kept on the current patched SPA release to address its link/navigation advisories. `npm audit` also flags an RSC action advisory in that package line; this Vite client does not enable React Server Components, server actions, SSR, or framework mode, so the affected execution path is absent.
