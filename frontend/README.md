# Speak Four frontend

React 18 test client for the English Speaking Rooms API. It covers guided onboarding, profile editing, administration, matchmaking, private rooms, realtime two-round sessions, LiveKit audio, reconnect recovery, and history.

## Run locally

Start the backend stack from the repository root, then run Vite:

```bash
docker compose up -d postgres livekit api
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. `VITE_API_URL` defaults to `http://localhost:3000/api`; LiveKit’s URL always comes from the voice-token endpoint.

If 5173 is already occupied, Vite prints the next available URL (for example `http://localhost:5180`). Always open the exact URL shown by Vite.

Alternatively, `docker compose up --build` at the repository root builds and serves the frontend through Nginx at `http://localhost:5174` (override with `FRONTEND_PORT`). Vite development continues to use port 5173.

## Test a four-person match

1. Start the backend and frontend. The seed accounts are `demo1@example.com` through `demo8@example.com`, all using `DemoPass123!`.
2. Open four **fresh** browser tabs, separate profiles, or incognito windows at `http://localhost:5173`. Session tokens use tab-scoped `sessionStorage`, so independent tabs can hold different users.
3. Sign into four compatible accounts—for example demo 1–4, whose A2/B1 levels are within one step.
4. Select **Find a partner** in each tab. Keep all four waiting screens open until each receives the same matched room.
5. Allow microphone access only in the two tabs marked **You are speaking**. Use headphones or mute three physical outputs to prevent feedback when testing on one computer.
6. Round one gives Pair A publish permission. During the break microphones are unpublished. Round two flips publish permission to Pair B.
7. After `session_finished`, open History and confirm the two topics and three partners were saved.

## Onboarding, profile, and admin

- **Create account** opens a six-step onboarding wizard. It requires at least one goal and interest, supports CEFR A1–C2, and signs the new user in when the review step completes.
- **Profile** allows inline editing of the name, level, native language, goals, and interests. It also shows completed sessions, total speaking-practice minutes, last-session date, theme controls, and logout.
- **Admin** is visible only to an administrator. Use `admin@example.com` / `DemoPass123!` in the local seeded environment to test stats, user suspension/roles, room force-close, reports, and topics. A normal user is redirected by the client and receives HTTP 403 from admin APIs.

## Mobile and accessibility notes

- The authenticated shell uses a bottom tab bar below the desktop breakpoint. The room uses a 2×2 seat grid and keeps Leave and microphone controls fixed within thumb reach.
- Safe-area padding is applied for notched devices. Auth and onboarding use document flow rather than a fixed viewport panel so the on-screen keyboard does not hide the active field.
- Motion respects the operating system’s reduced-motion preference. No action depends on an animation finishing.
- Listeners are intentionally never prompted for microphone permission. The browser asks only when that participant becomes a speaker and enables the microphone.

For a faster manual test, set short non-production timer values in the backend environment or use the fake-timer integration suite. REST room creation still enforces round lengths between 5 and 10 minutes.

## Commands

```bash
npm run dev       # Vite development server on 5173
npm run build     # strict TypeScript check and production bundle
npm test          # Vitest + Testing Library
npm run preview   # serve the production bundle locally
```

## Behavior notes

- Socket.IO `/me` handles matches; `/rooms` handles room state. Reconnect handshakes always use the newest access token, refresh an expired token before retrying, and re-emit `join` for a fresh server snapshot.
- Countdown displays recompute from server timestamps every 250 ms. Reloading does not restart a local timer.
- LiveKit stays connected across Socket.IO blips. Remote audio tracks are attached automatically, and an autoplay recovery button appears when the browser blocks playback.
- Listeners never ask for microphone permission. Speaker failures—denied permission, missing device, or rejected publish—remain recoverable from the room UI.
- The matchmaking screen shows elapsed time and changes to a widened-search state after the backend’s two-minute compatibility threshold. Private-room codes can be copied or shared, and the lobby animates each occupied seat.
- The full list of backend-contract adaptations is in [`../ASSUMPTIONS.md`](../ASSUMPTIONS.md).
