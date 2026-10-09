import type { Metadata } from "next";
import { SITE_DISCLAIMER } from "@/lib/constants";

export const metadata: Metadata = {
  title: "About & Data Sources",
  description:
    "Data source attribution, limitations, military tagging details, and safety disclaimer.",
};

export default function AboutPage() {
  return (
    <div className="container">
      <div className="content-page">
        <header className="page-header">
          <h1 className="page-title">About Big Jets Alert</h1>
          <p className="page-lead">
            Big Jets Alert is an open telemetry viewer and notification service designed for aviation enthusiasts, planespotters, and travelers.
          </p>
        </header>

        <section className="disclaimer-callout" role="alert">
          <h2 className="disclaimer-title">Safety &amp; Operational Disclaimer</h2>
          <p className="disclaimer-text">{SITE_DISCLAIMER}</p>
        </section>

        <section className="info-section">
          <h2 className="section-title">Data Sources &amp; Attribution</h2>
          <p>
            Flight positions, altitude, and transponder telemetry are provided through public open data feeds from{" "}
            <strong>adsb.lol</strong> under the{" "}
            <a
              href="https://opendatacommons.org/licenses/odbl/"
              target="_blank"
              rel="noopener noreferrer"
              className="prose-link"
            >
              Open Database License (ODbL)
            </a>.
          </p>
          <p style={{ marginTop: "0.5rem" }}>
            Map cartography and tile data are &copy;{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="prose-link"
            >
              OpenStreetMap contributors
            </a>. The interactive map is intended for demonstration purposes. High-traffic production deployments should configure a dedicated commercial tile provider.
          </p>
        </section>

        <section className="info-section">
          <h2 className="section-title">Military &amp; Special Aircraft Data</h2>
          <p>
            Aircraft categorized as &ldquo;Military&rdquo; or &ldquo;Fighter&rdquo; are identified solely using publicly accessible open ICAO type registries and ADS-B transponder database classifications.
          </p>
          <p style={{ marginTop: "0.5rem" }}>
            These classifications can include non-combat logistics transports, civil contractor flights, and governmental aircraft. In accordance with privacy and security principles, military flights are displayed on arrival text boards but excluded from the public live map by default.
          </p>
        </section>

        <section className="info-section">
          <h2 className="section-title">Technical Coverage &amp; Limitations</h2>
          <ul className="info-bullets">
            <li>
              <strong>Line-of-Sight Reception:</strong> ADS-B signals (1090 MHz) require direct radio line-of-sight. Aircraft on the ground or below local terrain obstacles may not appear until they gain altitude or enter a receiver&rsquo;s direct field.
            </li>
            <li>
              <strong>Community Feed Continuity:</strong> Data relies on voluntary community receiver availability and network uptime. Occasional gaps, delayed packets, or missing attributes (such as callsign or model) are normal characteristics of open ADS-B data.
            </li>
            <li>
              <strong>Rate Limiting:</strong> Public web queries are rate-limited to 60 requests per minute to ensure fair server availability.
            </li>
            <li>
              <strong>Privacy Architecture:</strong> The website operates in read-only mode with zero cookies, zero user trackers, zero third-party scripts, and zero personal data collection.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
