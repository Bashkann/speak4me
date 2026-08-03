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

Open `http://localhost:5173`. `VITE_API_URL` is read from the copied `.env` file; LiveKit’s URL always comes from the voice-token endpoint at runtime.

If 5173 is already occupied, Vite prints the next available URL (for example `http://localhost:5180`). Always open the exact URL shown by Vite.

Alternatively, `docker compose up --build` at the repository root builds and serves the frontend through Nginx at `http://localhost:5174` (override with `FRONTEND_PORT`). Vite development continues to use port 5173.

## Test the four-to-two-plus-two match

1. Start the backend and frontend. The seed accounts are `demo1@example.com` through `demo8@example.com`, all using `DemoPass123!`.
2. Open four **fresh** browser tabs, separate profiles, or incognito windows at `http://localhost:5173`. Session tokens use tab-scoped `sessionStorage`, so independent tabs can hold different users.
3. Sign into four compatible accounts—for example demo 1–4, whose A2/B1 levels are within one step.
4. Select **Find a partner** in each tab. The reveal shows all four learners splitting into two pairs; each pair receives a different room ID.
5. Allow microphone access only in the two tabs currently marked **You're speaking**—one Speaker in each independent room. Use headphones or mute extra physical outputs to prevent feedback.
6. Swap the topic twice in either Speaker tab and confirm the third offer locks with visual/haptic feedback. Listener tabs cannot publish or swap.
7. After the role hand-off, let each new Speaker either accept the new suggestion or choose **Continue previous topic**.
8. After both independent `session_finished` events, confirm each History entry contains two topics and one partner.

## Onboarding, profile, and admin

- **Create account** opens a six-step onboarding wizard. It requires at least one goal and interest, supports CEFR A1–C2, and signs the new user in when the review step completes.
- **Profile** allows inline editing of the name, level, native language, goals, and interests. It also shows completed sessions, total speaking-practice minutes, last-session date, theme controls, and logout.
- **Admin** is visible only to an administrator. Use `admin@example.com` / `DemoPass123!` in the local seeded environment to test stats, user suspension/roles, room force-close, reports, and topics. A normal user is redirected by the client and receives HTTP 403 from admin APIs.

## Mobile and accessibility notes

- The authenticated shell uses a bottom tab bar below the desktop breakpoint. Two participant cards stack at 375px, and Leave/microphone controls stay fixed within thumb reach.
- Safe-area padding is applied for notched devices. Auth and onboarding use document flow rather than a fixed viewport panel so the on-screen keyboard does not hide the active field.
- Motion respects the operating system’s reduced-motion preference. No action depends on an animation finishing.
- Listeners are intentionally never prompted for microphone permission. The browser asks only when that participant becomes a speaker and enables the microphone.
- Floating labels, inline validation, skeleton loaders, and empty states keep async and error feedback close to the affected control. Keyboard focus uses a consistent high-contrast ring.
- Reduced-motion mode removes ambient loops, directional movement, spring transforms, count-ups, and shimmer while preserving immediate opacity feedback and every interaction.

## Mascot system and replacing placeholder art

`CharacterBuddy` is one original rounded creature with idle, happy, thinking, celebrating, and password-peek SVG expressions. Routes select a semantic mood such as `searching` or `error`; [`src/components/character/character-registry.ts`](src/components/character/character-registry.ts) maps that mood to the SVG pose and optional Lottie effect. The buddy is always decorative, and all Lottie imports/autoplay are skipped when `prefers-reduced-motion` is enabled.

The three committed Lottie files are small CC0 placeholders layered behind the SVG buddy. Replace the file itself, or change the single matching `load` entry in the registry:

| Placeholder | Appears in | Final-art replacement |
| --- | --- | --- |
| `src/assets/lottie/search-orbit.json` | Matchmaking search and no-results states | A gentle look-around/search accent |
| `src/assets/lottie/loading-color.json` | Full-page, queue, and room loading states | A slow breathing/loading accent |
| `src/assets/lottie/celebration-star.json` | Account finish, match found, and session finish | A brief celebration accent |

The Vite build aliases `lottie-web` to its light SVG player because these placeholders use basic shapes and transforms. Remove that alias only if final art genuinely needs expressions, masks, or other full-player features. Record the final asset's author and license in [`CREDITS.md`](CREDITS.md); do not replace these files with unlicensed marketplace or brand artwork.

## Mascot production bundle note

Vite production output immediately before and after the mascot pass (uncompressed / gzip):

| Asset | Before | After |
| --- | ---: | ---: |
| Main application JS | 512.44 / 165.39 kB | 521.10 / 167.91 kB |
| Live room JS | 556.90 / 145.95 kB | 557.32 / 146.06 kB |
| Styles | 43.18 / 8.10 kB | 44.13 / 8.33 kB |
| Admin JS | 13.49 / 3.95 kB | 13.57 / 3.98 kB |
| Optional light Lottie player | — | 176.80 / 50.80 kB, lazy-loaded |
| Three Lottie effect chunks | — | 2.99 / 1.57 kB combined, lazy-loaded |

The ordinary first-paint main JS + CSS gzip payload grows by about 2.75 kB (1.6%). The 50.80 kB light player and individual JSON effects are separate on-demand chunks: an idle login or home visit does not request them. Reduced-motion users keep the static SVG pose and never load or autoplay the Lottie runtime.

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
