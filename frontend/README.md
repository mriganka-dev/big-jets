# Big Jets - Flight-Radar Style Map Interface

Big Jets is a live, full-screen radar application for tracking wide-body, rare, VIP, and military aircraft near regional airports using open ADS-B community telemetry.

Built with **Next.js 16 (App Router)**, **TypeScript**, and **Leaflet**, it presents an accessible, information-first live radar display with an OpenStreetMap tile layer, smooth dead-reckoning marker animations, and synchronized detail panels.

---

## 1. Features & Architecture

- **Full-Screen Radar Map (`/` and `/airport/[icao]`):** Viewport-filling interactive radar map centered on a chosen airport with a dashed detection perimeter (5 to 100 NM).
- **Default Airport Fallback:** Reads `NEXT_PUBLIC_DEFAULT_AIRPORT` (default `VECC` Kolkata), verifies against backend airport registry, and falls back to the first airport if invalid.
- **Accessible Airport Combobox:** ARIA 1.2 compliant search combobox allowing instant keyboard selection (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`) by ICAO code, IATA code, or city name.
- **Live 15-Second Telemetry Feed:** Real-time polling with automatic Page Visibility API pause/resume, exponential connection backoff (30s to 120s), and stale data detection (>120s).
- **Client-Side Category Filters:** Instant filtering by "All traffic", "Big", "Rare", "Fighters", and "VIP/Business" with `aria-pressed` chips and horizontal mobile scrolling.
- **Configurable Detection Radius:** Radius selector supporting 10, 25, 40 (standard), 60, and 100 NM limits.
- **Phase-First Sortable Arrivals Drawer:** Left-hand list panel sorting flights by priority:
  1. *Landing approach* flights first (ordered nearest to airport with ETA calculation).
  2. *Ground and departing* flights next.
  3. *Enroute and remaining* flights nearest first.
- **Telemetry Detail Drawer & Mobile Bottom Sheet:** Detailed flight view displaying callsign, registration, model, operator, phase, altitude, speed, vertical rate with trend word, heading, distance (`NM` and `km`), landing ETA, category badges, and validated JetPhotos link.
- **Smooth Dead-Reckoning Marker Advance:** Projects airborne markers along their reported `track` at `speedKt` during the 15-second polling interval (strictly capped to 15s; disabled when `prefers-reduced-motion` is active).
- **In-Memory Flight Trails:** Retains up to 20 historical positions per flight in memory to render subtle flight path polylines.
- **Military Privacy Default:** Military and fighter aircraft are excluded from the live map unless `NEXT_PUBLIC_SHOW_MILITARY_ON_MAP=true` is set. They remain listed in the sortable text panel.
- **Content Pages (`/alerts` and `/about`):** Telegram bot configuration guide and data source attribution supporting both light and dark system color schemes.

---

## 2. Setup on Windows (PowerShell)

### Prerequisites
- Node.js (v20+ recommended)
- npm

### Installation
```powershell
cd d:\DEVELOPMENT\big-jets\frontend
npm install
```

---

## 3. Environment Variables

Create `.env.local` to configure environment parameters:

```powershell
Copy-Item .env.local.example .env.local
```

### Configuration Options

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend API base URL |
| `NEXT_PUBLIC_DEFAULT_AIRPORT` | `VECC` | Default airport ICAO code for the front page |
| `NEXT_PUBLIC_SHOW_MILITARY_ON_MAP` | `false` | Set to `true` to display military aircraft on the live map |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | `big_jets_alert_bot` | Telegram bot username used for alert subscription links |

> **Security Note:** All `NEXT_PUBLIC_` variables are public in client bundles. Never store secrets, API tokens, or credentials here.

---

## 4. Running Locally with Backend

### Terminal 1: Start Backend API
```powershell
cd d:\DEVELOPMENT\big-jets\backend
npm run dev
```

### Terminal 2: Start Frontend
```powershell
cd d:\DEVELOPMENT\big-jets\frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 5. Production Build & Linting

```powershell
cd d:\DEVELOPMENT\big-jets\frontend
npm run lint
npm run build
npm run start
```

---

## 6. Security & Privacy Architecture Checklist

- **Strict Content Security Policy (CSP):**
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline'` (`'unsafe-eval'` in development only)
  - `style-src 'self' 'unsafe-inline'`
  - `img-src 'self' data: https://*.tile.openstreetmap.org`
  - `connect-src 'self' <API_URL>`
  - `frame-ancestors 'none'`
  - `object-src 'none'`
  - `base-uri 'self'`
  - `form-action 'self'`
- **Zero Inline Style Strings in Leaflet:** Markers are created using CSS class names and `data-hex` attributes. Heading rotation is set strictly via DOM APIs (`element.style.transform = rotate(${track}deg)`), satisfying strict CSP directives.
- **Zero XSS Risk:** All dynamic transponder strings, tooltips, and popups are rendered using standard React escaping or DOM `document.createElement` with `textContent`. Zero `innerHTML` or `dangerouslySetInnerHTML`.
- **Response Validation:** All API payloads are strictly validated at runtime using **Zod** schemas before reaching UI components.
- **Sanitized Links:** Photo links validate registrations against `^[A-Z0-9-]{3,10}$` before invoking `encodeURIComponent` and always include `rel="noopener noreferrer"`.
- **Security Headers:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` (camera, microphone, geolocation, payment disabled), and HSTS in production.
- **Permanent Attribution:** Visible bottom-left attribution to `adsb.lol (ODbL)` and `© OpenStreetMap contributors` is preserved at all times.
- **Zero User Storage:** No cookies, no session tokens, no user telemetry trackers, and no external advertising scripts.

---

## 7. Honest Regional Limits & Disclaimer

1. **Regional Airport Range (up to 100 NM):** Telemetry is retrieved within up to 100 nautical miles of supported regional airports, not the entire globe. The map centers on one airport at a time, selectable via the combobox.
2. **Community ADS-B Coverage:** Flight detection relies on volunteer-operated 1090 MHz receiver stations. Aircraft on the ground or obstructed by terrain line-of-sight may not appear until airborne.
3. **No Arbitrary Worldwide Panning:** Global or unbounded map panning is disabled; queries are strictly bounded to supported airport perimeters.
4. **Safety Disclaimer:** Positions are community-reported and may be delayed or inaccurate. Not for navigation or safety-critical aviation operations.
