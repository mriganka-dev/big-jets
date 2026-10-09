# Big Jets Backend

Backend service for **Big Jets Alert** — tracking wide-body, heavy, rare, military, and VIP aircraft near airports (e.g. `VECC` Kolkata) using free public ADS-B data from [adsb.lol](https://api.adsb.lol) and sending instant alerts via **Telegram** and **Email**.

---

## 1. Features

- **Real-time ADS-B Polling**: Polls public ADS-B feeds for watched airports at configurable intervals (shared across subscribers to minimize API traffic).
- **Flight Event Detection**:
  - **Landing**: Triggered after aircraft is confirmed on approach across consecutive polling cycles.
  - **Takeoff**: Triggered when a stationary aircraft near the airport begins moving.
  - **Nearby**: Triggered when an aircraft first enters the airport radius or returns after an absence.
- **Categorization & Filtering**: Wide-body (`BIG`), rare types (`RARE`), military fighters (`MIL_FIGHTER`), other military (`MIL_OTHER`), and VIP business jets (`VIP_JET`).
- **Telegram Bot Control**: Fully interactive Telegram bot interface (`/watch`, `/mywatches`, `/stop`, `/pause`, `/resume`, `/email`).
- **Email Alert Delivery**: One-click verification and unsubscribe links with hashed single-use tokens and HTML notifications.
- **Lightweight JSON Store**: Single JSON file persistence with atomic file writes, corrupt recovery, and automatic hourly housekeeping.
- **Security Hardened**: Helmet, strict CORS allow-list, rate limiters, constant-time token comparison, and Zod input validation across all endpoints.

---

## 2. Requirements

- **Node.js**: v18.0.0 or newer (ES Modules support with native `fetch` and `crypto`).
- **Operating System**: Windows (PowerShell), Linux, or macOS.

---

## 3. Windows Setup & Installation

Open PowerShell in the project directory:

```powershell
# Navigate to the backend directory
cd backend

# Install dependencies (pinned packages only)
npm install

# Copy environment template to .env
Copy-Item .env.example .env
```

---

## 4. Configuration & Environment Variables

Edit `.env` in the `backend/` directory. The service validates all variables on startup with Zod.

| Variable                    | Required            | Default                   | Description                                                         |
| --------------------------- | ------------------- | ------------------------- | ------------------------------------------------------------------- |
| `NODE_ENV`                  | No                  | `development`             | Environment mode (`development`, `production`, `test`)              |
| `PORT`                      | No                  | `4000`                    | HTTP port for the Express server                                    |
| `FRONTEND_ORIGIN`           | No                  | `http://localhost:3000`   | Allowed CORS origins (comma-separated for multiple)                 |
| `TRUST_PROXY`               | No                  | `false`                   | Enable if running behind a reverse proxy (e.g., Nginx / Cloudflare) |
| `ADSB_API`                  | No                  | `https://api.adsb.lol/v2` | Base URL of the ADS-B data provider                                 |
| `POLL_MS`                   | No                  | `20000`                   | Poller interval in milliseconds (default: 20 seconds)               |
| `STORE_PATH`                | No                  | `./src/data/store.json`   | Path to the JSON data storage file                                  |
| `PUBLIC_URL`                | No                  | `http://localhost:4000`   | Public base URL used for verify and unsubscribe links               |
| `TELEGRAM_BOT_TOKEN`        | Optional            | `""`                      | Telegram bot API token from @BotFather                              |
| `TELEGRAM_MODE`             | No                  | `polling`                 | Telegram mode: `polling` (for local dev) or `webhook` (production)  |
| `TELEGRAM_WEBHOOK_SECRET`   | Required if webhook | `""`                      | Secret token verified on webhook updates                            |
| `TELEGRAM_ALLOWED_USER_IDS` | Optional            | `""`                      | Comma-separated Telegram user IDs allowed to interact with the bot  |
| `SMTP_HOST`                 | Optional            | `""`                      | SMTP mail server hostname                                           |
| `SMTP_PORT`                 | No                  | `587`                     | SMTP mail server port                                               |
| `SMTP_SECURE`               | No                  | `false`                   | Set `true` for TLS (port 465), `false` for STARTTLS (port 587)      |
| `SMTP_USER`                 | Optional            | `""`                      | SMTP username / login                                               |
| `SMTP_PASS`                 | Optional            | `""`                      | SMTP password / app password                                        |
| `EMAIL_FROM`                | Optional            | `""`                      | Sender address (e.g., `"Big Jets Alert <alerts@example.com>"`)      |

_(Note: The server starts cleanly in local development even if Telegram or SMTP are omitted)._

---

## 5. Setting up the Telegram Bot

### Step 1: Create the Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts to choose a display name and username.
3. Copy the HTTP API token provided by @BotFather and paste it into `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
   TELEGRAM_MODE=polling
   ```

### Step 2: Find Your Telegram User ID

1. In Telegram, search for [@userinfobot](https://t.me/userinfobot) or [@raw_data_bot](https://t.me/raw_data_bot).
2. Send `/start`. The bot will reply with your numeric `Id` (e.g., `987654321`).
3. Add this ID to `.env` to restrict bot access to authorized users:
   ```env
   TELEGRAM_ALLOWED_USER_IDS=987654321
   ```

---

## 6. Running the Server

### Development Mode (with automatic reload)

```powershell
npm run dev
```

### Production Mode

```powershell
npm start
```

---

## 7. Telegram Bot Commands Reference

Interact with your bot in a direct private chat:

| Command                              | Description                                              | Example                                                                               |
| ------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/start`, `/help`                    | Shows instructions and available airports                | `/help`                                                                               |
| `/watch <ICAO> <what> [event] [via]` | Subscribes to aircraft alerts                            | `/watch VECC all`<br>`/watch VECC fighters nearby 50`<br>`/watch VIDP A388 land both` |
| `/mywatches`                         | Lists all your active subscriptions                      | `/mywatches`                                                                          |
| `/stop <number>`                     | Removes a subscription by number                         | `/stop 1`                                                                             |
| `/pause`                             | Temporarily silences all alerts                          | `/pause`                                                                              |
| `/resume`                            | Resumes receiving alert notifications                    | `/resume`                                                                             |
| `/email <address>`                   | Registers an email address and sends a verification link | `/email user@example.com`                                                             |
| `/email off`                         | Disables email alert delivery                            | `/email off`                                                                          |

---

## 8. API Endpoints & Testing

### 1. Health Check

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/health" -Method Get
```

Response:

```json
{ "ok": true }
```

### 2. Airport Aircraft Query (Public)

Retrieve current aircraft near an airport (e.g., `VECC` Kolkata):

```powershell
# Get all detected aircraft within 40 NM
Invoke-RestMethod -Uri "http://localhost:4000/api/airports/VECC/aircraft?all=true" -Method Get

# Get only heavy / big aircraft within 60 NM
Invoke-RestMethod -Uri "http://localhost:4000/api/airports/VECC/aircraft?category=BIG&radius=60" -Method Get
```

### 3. Email Verification Link

```powershell
# Valid or invalid token returns neutral HTML confirmation page
Invoke-WebRequest -Uri "http://localhost:4000/api/email/verify?token=SAMPLE_64_CHAR_HEX_TOKEN"
```

### 4. Email Unsubscribe Link

```powershell
Invoke-WebRequest -Uri "http://localhost:4000/api/email/unsubscribe?token=SAMPLE_64_CHAR_HEX_TOKEN"
```

---

## 9. Deployment Notes

- **Persistent Disk**: The JSON store (`src/data/store.json`) must reside on a persistent volume. If deployed on container platforms (Railway, Render, Fly.io, Docker), mount a persistent volume at the path configured in `STORE_PATH`.
- **Single Instance**: Because state is managed in-memory and synchronized to a single JSON file, run a single server replica.
- **Production Webhook Setup**:
  1. Set `TELEGRAM_MODE=webhook`.
  2. Set `TELEGRAM_WEBHOOK_SECRET` to a random hex string.
  3. Set `PUBLIC_URL` to your HTTPS domain (e.g. `https://bigjets.example.com`).
  4. The server automatically registers the webhook endpoint on startup.

---

## 10. Known Limitations

- **Ground & Takeoff Data**: ADS-B receiver coverage at ground level can be patchy depending on local receiver density. Takeoff events are triggered when ground movement is detected near the runway.
- **Military / Fighter Data**: Military aircraft frequently fly with transponders off or without position broadcasting (MLAT only).
- **Single Server Architecture**: Designed for personal and small group monitoring (up to 200 users, 10 watches per user) using file-based storage.

---

## 11. Future Roadmap

- Next.js Web Frontend for live radar visualization and interactive flight tracking.
- Web push notification support.
- Custom user-defined geographic geofences / corridors.
