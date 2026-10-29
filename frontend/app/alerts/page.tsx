import type { Metadata } from "next";
import { PATTERNS } from "@/lib/constants";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Flight Alerts & Notifications",
  description:
    "How to set up automated Telegram and email notifications for big, rare, and military aircraft alerts.",
};

export default function AlertsPage() {
  const rawBotUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "";
  const isValidBot = PATTERNS.BOT_USERNAME.test(rawBotUsername);

  return (
    <div className="site-content-layout">
      <SiteHeader />
      <main id="main-content" className="main-content" tabIndex={-1}>
        <div className="container">
          <div className="content-page">
            <header className="page-header">
              <h1 className="page-title">Flight Alerts &amp; Notifications</h1>
              <p className="page-lead">
                Automated alerts for interesting aircraft near supported
                airports are delivered directly to your Telegram or email inbox
                via the Big Jets Alert bot.
              </p>
            </header>

            <section
              className="info-card telegram-hero-card"
              aria-labelledby="getting-started-heading"
            >
              <h2 id="getting-started-heading" className="section-title">
                Getting Started with Telegram
              </h2>
              <p>
                The website is a read-only viewer. To create and manage your
                personal alert subscriptions, use the Telegram bot directly.
                There are no accounts, passwords, or forms required on the
                website.
              </p>

              <div className="steps-list">
                <div className="step-item">
                  <span className="step-number">1</span>
                  <div>
                    <strong>Open the Telegram Bot:</strong> Launch the bot in
                    Telegram.
                    {isValidBot ? (
                      <div style={{ marginTop: "0.5rem" }}>
                        <a
                          href={`https://t.me/${rawBotUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary btn-sm"
                        >
                          Open @{rawBotUsername} on Telegram &rarr;
                        </a>
                      </div>
                    ) : (
                      <p className="step-hint">
                        Bot username: configured by your administrator.
                      </p>
                    )}
                  </div>
                </div>

                <div className="step-item">
                  <span className="step-number">2</span>
                  <div>
                    <strong>Start the Bot:</strong> Press the{" "}
                    <code>/start</code> button in your chat with the bot.
                  </div>
                </div>

                <div className="step-item">
                  <span className="step-number">3</span>
                  <div>
                    <strong>Send Watch Commands:</strong> Configure which
                    airports and aircraft categories you want to track.
                  </div>
                </div>
              </div>

              <div className="notice-banner" role="note">
                <strong>Access Control Notice:</strong> The bot is restricted to
                allowed users configured by the bot owner. If you receive an
                unauthorized message when running <code>/start</code>, contact
                the site administrator to add your Telegram User ID.
              </div>
            </section>

            <section
              className="commands-section"
              aria-labelledby="commands-heading"
            >
              <h2 id="commands-heading" className="section-title">
                Bot Command Reference
              </h2>

              <div className="command-grid">
                <div className="command-card">
                  <div className="command-header">
                    <code>
                      /watch &lt;ICAO&gt; &lt;FILTER&gt; [EVENT] [RADIUS]
                    </code>
                  </div>
                  <p className="command-desc">
                    Subscribe to aircraft alerts near an airport.
                  </p>
                  <ul className="command-examples">
                    <li>
                      <code>/watch VECC all</code> &mdash; All big/rare traffic
                      near Kolkata (40 NM)
                    </li>
                    <li>
                      <code>/watch VECC fighters nearby 50</code> &mdash;
                      Fighters within 50 NM
                    </li>
                    <li>
                      <code>/watch VIDP A388 land both</code> &mdash; Airbus
                      A380 arrivals at Delhi
                    </li>
                  </ul>
                </div>

                <div className="command-card">
                  <div className="command-header">
                    <code>/mywatches</code>
                  </div>
                  <p className="command-desc">
                    List all your active subscriptions with their numeric index
                    IDs.
                  </p>
                </div>

                <div className="command-card">
                  <div className="command-header">
                    <code>/stop &lt;number&gt;</code>
                  </div>
                  <p className="command-desc">
                    Remove a specific subscription by its number from{" "}
                    <code>/mywatches</code>.
                  </p>
                </div>

                <div className="command-card">
                  <div className="command-header">
                    <code>/pause</code> and <code>/resume</code>
                  </div>
                  <p className="command-desc">
                    Temporarily pause all notifications without deleting your
                    subscriptions, or resume them when ready.
                  </p>
                </div>

                <div className="command-card">
                  <div className="command-header">
                    <code>/email &lt;address&gt;</code>
                  </div>
                  <p className="command-desc">
                    Set up email notifications. A secure verification link will
                    be sent to confirm your email.
                  </p>
                  <ul className="command-examples">
                    <li>
                      <code>/email user@example.com</code> &mdash; Register
                      email
                    </li>
                    <li>
                      <code>/email off</code> &mdash; Disable email alerts
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
