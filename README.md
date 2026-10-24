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

## Where things are

| File | Ported from |
|---|---|
| `src/App.tsx` | `ContentView.swift` (form, calculations, history, delete) |
| `src/fuel.ts` | Computed properties and formatting from `ContentView.swift` / `FuelLog.swift` |
| `src/api.ts` | SwiftData `modelContext` insert/delete/query → REST calls |
| `src/FuelLogEditor.tsx` | New: edit a history row in place (Save / Cancel) |

## Phones and installing (PWA)

The layout adapts to phone widths (bigger tap targets, edit row stacks its buttons) and keeps clear
of the notch when installed. The app can be added to the home screen:

- **Android (Chrome):** menu → *Add to Home screen* / *Install app*.
- **iPhone (Safari):** Share → *Add to Home Screen*.

Installing needs the app served over **HTTPS** (or `localhost`), from a production build
(`npm run build`). The service worker (`public/sw.js`) only registers in production builds; it keeps
the app shell available offline and never caches `/api` calls. Icons are in `public/`; the PNGs were
generated from `public/favicon.svg` and `icons/icon-full-bleed.svg` (the full-bleed one is used where
the OS crops the icon: Android "maskable" and the iOS home-screen icon).

## Tests

Vitest + React Testing Library, with the API mocked (no backend needed).
Tests sit next to the code as `*.test.ts(x)`; shared helpers are in `src/test/`.

```powershell
npm test               # run once
npm run coverage       # also prints coverage and writes coverage/index.html
```

Other scripts: `npm run build` (type-check + production build), `npm run lint`.
