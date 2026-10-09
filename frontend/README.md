# Big Jets Alert - Frontend

Big Jets Alert is a fast, accessible, privacy-first web application for tracking wide-body, rare, VIP, and military aircraft near airports using open ADS-B community telemetry.

The frontend is built with **Next.js 16 (App Router)** and **TypeScript**, designed with a calm, information-first airport arrivals board theme that supports both light and dark modes.

---

## 1. Features

- **Dynamic Airport Picker (`/`):** Browse supported airports (e.g. Kolkata `VECC`, Delhi `VIDP`, Mumbai `VABB`, Bengaluru `VOBL`) with instant live text filtering.
- **Live Arrivals Radar Board (`/airport/[icao]`):** Telemetry board refreshing automatically every 15 seconds, sorting landing approach aircraft with ETA calculations on top, followed by departing/ground flights and enroute traffic.
- **Interactive Radar Map:** Optional Leaflet map with OpenStreetMap tiles, dashed radius perimeter, and CSS-rotated aircraft markers displaying telemetry popups.
- **Background Tab Efficiency:** Automatically pauses polling when the browser tab is hidden (Page Visibility API) and resumes immediately upon focus.
- **Alerts Guide (`/alerts`):** Command reference and instructions for configuring personal automated alerts via the Telegram bot.
- **About & Credits (`/about`):** Transparent attribution to adsb.lol (ODbL) and OpenStreetMap contributors with safety disclaimers.

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

Copy the example file to configure your local environment:
```powershell
Copy-Item .env.local.example .env.local
```

### Available Variables

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend Express API base URL |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | `big_jets_alert_bot` | Telegram bot username (without `@`) used for alert links |
| `NEXT_PUBLIC_SHOW_MILITARY_ON_MAP` | `false` | Set to `true` to display military aircraft on the live map |

> **Security Note:** All `NEXT_PUBLIC_` variables are public in the client bundle. Never place secret keys or tokens in frontend configuration.

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

## 5. Building for Production

```powershell
cd d:\DEVELOPMENT\big-jets\frontend
npm run build
npm run start
```

---

## 6. Security & Privacy Architecture

- **Strict Content Security Policy (CSP):** Configured in `next.config.ts` (`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `connect-src 'self' <API_URL>`, `img-src 'self' data: https://*.tile.openstreetmap.org`). `'unsafe-eval'` is restricted strictly to development.
- **Security Headers:** Response headers include `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` (disabling microphone, camera, geolocation, payment), and HSTS (`Strict-Transport-Security`) in production.
- **Zero Sensitive Storage:** No cookies, no session storage, no tokens, and no user tracking scripts.
- **Zero XSS Risk:** All dynamic API data is rendered through standard React escaping or DOM `textContent`. No `dangerouslySetInnerHTML` or `innerHTML` is used.
- **Response Validation:** Every backend API response is strictly validated at runtime with **Zod** schemas before reaching UI components.
- **Sanitized Links:** External links use `rel="noopener noreferrer"` and validate registrations against strict alphanumeric patterns before generating photo links.
- **No Production Source Maps:** `productionBrowserSourceMaps` is disabled to prevent leaking source structures.

---

## 7. Known Limitations

- **Community ADS-B Coverage:** Flight positions rely on community-operated 1090 MHz receiver stations. Aircraft on the ground or beyond line-of-sight terrain may not appear until airborne.
- **Demonstration Map Tiles:** OpenStreetMap public tile servers are used for demonstration and low-traffic use. High-volume deployments require a dedicated tile provider.
- **Read-Only Interface:** Alert subscriptions are created and managed exclusively via the Telegram bot; the web frontend never collects credentials or user data.

---

## 8. Future Roadmap

- Dedicated Vector Tile provider integration (e.g., MapLibre GL)
- Multi-airport comparison split view
- Audio chime notifications on high-priority rare aircraft arrivals
