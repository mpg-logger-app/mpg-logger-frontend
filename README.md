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

## Install as an app (PWA)

MPG Logger is a progressive web app: on a phone, **Share › Add to Home Screen** (iPhone) or
**Install app** (Android/Chrome); on a computer, the install icon in the address bar. It then opens
full screen with its own icon.

- `public/manifest.webmanifest`: name, colors and icons (`public/icons/`, drawn from `favicon.svg`).
- `public/sw.js`: the service worker. It caches the app itself so it opens offline, but never
  caches `/api`, so fuel logs are always live; without a connection the app says it can't connect.
  Bump `VERSION` in it to drop old caches.
- The service worker only runs in production builds. Try it locally with
  `npm run build` then `npm run preview` (http://localhost:4173, also proxies `/api` to 8080).
- Installing needs HTTPS when hosted (localhost is exempt).

## Hosting

- Serve the app and the API from **one origin**, e.g. `https://mpg.example.com` for the app and
  `https://mpg.example.com/api/*` forwarded to Spring Boot, the same way Vite does in development.
  The session cookie is `SameSite=Lax` and scoped to `/api`, so a backend on a different site
  won't receive it.
- Use HTTPS, so the cookie is sent with `Secure`.
- Paths like `/home` are handled in the browser, so the host must answer unknown paths with
  `index.html` (the "SPA fallback" / rewrite setting on Netlify, Vercel, nginx `try_files`, etc.).

## Where things are

| File | What it is |
|---|---|
| `src/main.tsx`, `src/AppRoutes.tsx` | Router and the list of pages |
| `src/auth.tsx`, `src/useAuth.ts` | Who is signed in; `RequireAuth` / `RedirectIfSignedIn` guards |
| `src/Landing.tsx` | Landing page |
| `src/AuthPage.tsx` | Sign in / sign up |
| `src/AppLayout.tsx` | Top bar on signed-in pages (account link, sign out) |
| `src/AccountPage.tsx` | Account details |
| `src/account.ts` | `Account` type and sign-up rules (same as the backend's) |
| `src/App.tsx` | The fuel log, ported from `ContentView.swift` (form, calculations, history, delete) |
| `src/fuel.ts` | Computed properties and formatting from `ContentView.swift` / `FuelLog.swift` |
| `src/api.ts` | REST calls (SwiftData `modelContext` insert/delete/query, plus accounts) |
| `src/FuelLogEditor.tsx` | Edit a history row in place (Save / Cancel) |

## Tests

Vitest + React Testing Library, with the API mocked (no backend needed).
Tests sit next to the code as `*.test.ts(x)`; shared helpers are in `src/test/`.

```powershell
npm test               # run once
npm run coverage       # also prints coverage and writes coverage/index.html
```

Other scripts: `npm run build` (type-check + production build), `npm run lint`.
