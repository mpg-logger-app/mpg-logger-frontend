# MPG Logger – Frontend

React + TypeScript (Vite) frontend for MPG Logger, migrated from the original SwiftUI iPad app.
It talks to the Spring Boot backend in the `mpg-logger-backend` repo.

## Run

Start the backend first (it must be on port 8080), then:

```powershell
npm install
npm run dev
```

Open http://localhost:5173. During development Vite forwards `/api/*` requests to
`http://localhost:8080` (see `vite.config.ts`), so no CORS setup is needed.

## Pages

| Path | Page |
|---|---|
| `/` | Landing page explaining the app, with **Sign in** / **Sign up** at the top right. Signed-in visitors skip to `/home`. |
| `/signin`, `/signup` | One page with a switch between the two. Sign-up asks for username, name and password only. |
| `/home` | The fuel log itself (signed in only). |
| `/account` | Change your name; says password changes are on the way (signed in only). |

Signing in sets an HttpOnly session cookie that lasts until **Sign out**, even after the tab or
browser is closed. On load the app asks `GET /api/account` who is signed in.

## Phones and installing (PWA)

The layout is one column on phones and two on desktop, with finger-sized tap targets, an edit row
that stacks its buttons on narrow screens, and padding that keeps clear of the notch when installed.
The app can be added to the home screen:

- **Android (Chrome):** menu → *Add to Home screen* / *Install app*.
- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Desktop (Chrome/Edge):** the install icon in the address bar.

Installing needs the app served over **HTTPS** (or `localhost`), from a production build.
The service worker (`public/sw.js`) only registers in production builds; it keeps the app shell
available offline and never caches `/api` calls, so fuel logs are always live. Without a connection,
signed-in pages say they can't connect instead of asking you to sign in. Bump `CACHE` in `sw.js`
when its caching rules change. Try it locally with `npm run build` then `npm run preview`
(http://localhost:4173, which also forwards `/api` to 8080).

Icons are in `public/`; the PNGs were generated from `public/favicon.svg` and
`icons/icon-full-bleed.svg` (the full-bleed one is used where the OS crops the icon: Android
"maskable" and the iOS home-screen icon).

## Hosting

The app is a free **Render static site**, with the Spring Boot API on Render too. Both are described
in [`render.yaml` in the backend repo](https://github.com/mpg-logger-app/mpg-logger-backend/blob/develop/render.yaml),
and the step-by-step guide is
[`HOSTING.md`](https://github.com/mpg-logger-app/mpg-logger-backend/blob/develop/HOSTING.md) there.
Render rebuilds the site on every push to `develop`:

- **Build:** `npm ci && npm run build` (Node 24), publishing `dist`.
- **`/api/*` is forwarded to the backend.** The browser only sees the site's address, so the app and
  the API share one origin, the same way Vite does in development. That matters because the session
  cookie is `SameSite=Lax` and scoped to `/api`: a backend on a different site wouldn't receive it.
- **SPA fallback:** paths like `/home` are handled in the browser, so every path that isn't a real
  file gets `index.html`.
- **Caching:** every file is revalidated (`Cache-Control: no-cache`), so a deploy shows up straight away.

Render serves everything over HTTPS, so the cookie is sent with `Secure` and the app can be installed.

## Where things are

| File | What it is |
|---|---|
| `src/main.tsx`, `src/AppRoutes.tsx` | Router and the list of pages |
| `src/auth.tsx`, `src/useAuth.ts` | Who is signed in; `RequireAuth` / `RedirectIfSignedIn` guards |
| `src/Landing.tsx` | Landing page |
| `src/AuthPage.tsx` | Sign in / sign up |
| `src/AppLayout.tsx` | Top bar on signed-in pages (menu with Profile / Sign out) |
| `src/AccountPage.tsx` | Account details |
| `src/account.ts` | `Account` type and sign-up rules (same as the backend's) |
| `src/App.tsx` | The fuel log, ported from `ContentView.swift` (form, calculations, history, delete) |
| `src/fuel.ts` | Computed properties and formatting from `ContentView.swift` / `FuelLog.swift` |
| `src/api.ts` | REST calls (SwiftData `modelContext` insert/delete/query, plus accounts) |
| `src/FuelLogEditor.tsx` | Edit a history row in place (Save / Cancel) |
| `src/registerServiceWorker.ts`, `public/sw.js` | PWA service worker and its registration |

## Tests

Vitest + React Testing Library, with the API mocked (no backend needed).
Tests sit next to the code as `*.test.ts(x)`; shared helpers are in `src/test/`.

```powershell
npm test               # run once
npm run coverage       # also prints coverage and writes coverage/index.html
```

Other scripts: `npm run build` (type-check + production build), `npm run lint`.
