# TickerChart Live — Next.js

A Next.js 15 (App Router) web app that logs into [TickerChart](https://tickerchart.com) and
displays live top gainers and losers across supported markets
(EGY, TAD, DFM, ADX, KSE, DSM, FRX). Ready to deploy to Vercel.

This is a port of the WPF desktop app to the web. Because browsers cannot
set the `Origin` header (it's a forbidden header) and the TickerChart API
does not send CORS headers, login and live-data requests are made from
Next.js **API routes** server-side — which *can* freely set `Origin:
https://www.tickerchart.net`, sidestepping CORS entirely.

## Features

- Login screen with username / password
- Main screen after login:
  - Top bar: market dropdown, refresh button, auto-refresh toggle (60s), sign out
  - Summary cards: Gainers count, Losers count, Total tracked
  - Tabs: **Top Gainers** / **Top Losers**
  - Table of top 15: Symbol | Name | Price | Change % | Volume
  - Change % colored **green** for positive, **red** for negative
- Status bar with live indicator and last refresh time
- Token is held in React state only — never persisted to disk / localStorage

## Stack

- Next.js 15 (App Router) + React 18 + TypeScript
- Tailwind CSS for modern UI
- Native `fetch` in API routes (no extra HTTP library needed)

## Project layout

```
app/
  layout.tsx
  page.tsx                    # single-page: login ↔ dashboard
  globals.css
  api/
    login/route.ts            # proxies POST /m/v2/tickerchart/web/login
    live/route.ts             # proxies GET  /tickerchart_live/live_loader_json_v3.php
components/
  LoginForm.tsx
  Dashboard.tsx
  MoverTable.tsx
  SummaryCard.tsx
lib/
  types.ts
  markets.ts
```

## Local development

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy to Vercel

The app has **no environment variables** and **no build-time config** — it deploys
cleanly as a stock Next.js project.

### Option A — via the Vercel dashboard

1. Push this repo to GitHub (this repo is already at `m-hussien-a/tic-next`,
   branch `claude/wpf-tickerchart-app-dttKh`).
2. Go to <https://vercel.com/new> → **Import** the repo.
3. Framework preset should auto-detect as **Next.js**.
4. Leave Build / Output settings as default.
5. Click **Deploy**.

### Option B — via the Vercel CLI

```bash
npm i -g vercel
vercel login
vercel          # first deploy (preview)
vercel --prod   # production deploy
```

That's it — no env vars, no region tweaks, no custom routes needed.

## API routes (internals)

### `POST /api/login`

Body:

```json
{ "username": "USER", "password": "plain-text-password" }
```

The route base64-encodes the password (as required by TickerChart) and
forwards to `https://tickerchart.com/m/v2/tickerchart/web/login?...` with:

- `Content-Type: application/json`
- `Origin: https://www.tickerchart.net`
- Realistic `User-Agent` / `Referer`

Returns `{ "token": "TcToken..." }` on success, or `{ "error": "..." }` with
the appropriate HTTP status on failure.

### `GET /api/live?market=EGY`

Requires `Authorization: <token>` header (the token returned by `/api/login`).

Proxies to `https://tickerchart.com/tickerchart_live/live_loader_json_v3.php?...`
with the same `Origin` header.

Returns:

```json
{
  "market": "EGY",
  "count": 123,
  "movers": [
    {
      "symbol": "COMI",
      "market": "EGY",
      "name": "Commercial International Bank",
      "price": 87.12,
      "changePercent": 2.41,
      "change": 2.05,
      "volume": 1250000
    }
  ]
}
```

The route tolerates the several field name variants TickerChart uses —
`close`/`price`/`last`, `changePercent`/`cp`/`pcp`, `volume`/`vol`/`v`, etc.

## Security notes

- The token never touches `localStorage` / cookies / disk — it lives only
  in React state for the tab's lifetime. Refreshing the page forces a re-login.
- All upstream calls happen server-side in Next.js route handlers, so the
  TickerChart credentials and token only ever travel between your browser
  and your Vercel deployment.
