import type { Metadata } from "next";
import { SITE_DISCLAIMER } from "@/lib/constants";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "About & Data Sources",
  description:
    "Data source attribution, radar coverage limits, military tagging details, and safety disclaimer.",
};

export default function AboutPage() {
  return (
    <div className="site-content-layout">
      <SiteHeader />
      <main id="main-content" className="main-content" tabIndex={-1}>
        <div className="container">
          <div className="content-page">
            <header className="page-header">
              <h1 className="page-title">About Big Jets</h1>
              <p className="page-lead">
                Big Jets is an open live flight-tracking radar and notification
                service designed for aviation enthusiasts, planespotters, and
                travelers.
              </p>
            </header>

            <section className="disclaimer-callout" role="alert">
              <h2 className="disclaimer-title">
                Safety &amp; Operational Disclaimer
              </h2>
              <p className="disclaimer-text">{SITE_DISCLAIMER}</p>
            </section>

            {/* Honest Limits section per Section 2 */}
            <section className="info-section">
              <h2 className="section-title">
                Coverage Limits &amp; Regional Focus
              </h2>
              <ul className="info-bullets">
                <li>
                  <strong>Regional Airport Detection (up to 100 NM):</strong>{" "}
                  Our backend returns aircraft within up to 100 nautical miles
                  of each supported airport, not the whole world. The map is
                  therefore centred on one airport at a time and you can switch
                  airports instantly with the search box.
                </li>
                <li>
                  <strong>Community Receiver Coverage:</strong> Coverage depends
                  on community ADS-B receivers, so some geographic areas show
                  fewer aircraft.
                </li>
                <li>
                  <strong>No Arbitrary Worldwide Panning:</strong> Global or
                  unconstrained map positioning is not supported. Queries are
                  strictly bounded around supported airports to ensure fair use
                  and predictable server performance.
                </li>
              </ul>
            </section>

            <section className="info-section">
              <h2 className="section-title">Data Sources &amp; Attribution</h2>
              <p>
                Flight positions, altitude, and transponder telemetry are
                provided through public open data feeds from{" "}
                <strong>adsb.lol</strong> under the{" "}
                <a
                  href="https://opendatacommons.org/licenses/odbl/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="prose-link"
                >
                  Open Database License (ODbL)
                </a>
                .
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
                </a>
                . The radar map is intended for planespotting and enthusiast
                tracking.
              </p>
            </section>

            <section className="info-section">
              <h2 className="section-title">
                Military &amp; Special Aircraft Data
              </h2>
              <p>
                Aircraft categorized as &ldquo;Military&rdquo; or
                &ldquo;Fighter&rdquo; are identified solely using publicly
                accessible open ICAO type registries and ADS-B transponder
                database classifications.
              </p>
              <p style={{ marginTop: "0.5rem" }}>
                These classifications can include non-combat logistics
                transports, civil contractor flights, and governmental aircraft.
                In accordance with privacy and security principles, military
                flights are displayed in list views but excluded from the live
                map by default unless explicitly configured.
              </p>
            </section>

            <section className="info-section">
              <h2 className="section-title">
                Technical Coverage &amp; Privacy
              </h2>
              <ul className="info-bullets">
                <li>
                  <strong>Line-of-Sight Reception:</strong> ADS-B signals (1090
                  MHz) require direct radio line-of-sight. Aircraft on the
                  ground or below local terrain obstacles may not appear until
                  they gain altitude or enter a receiver&rsquo;s direct field.
                </li>
                <li>
                  <strong>Community Feed Continuity:</strong> Data relies on
                  voluntary community receiver availability and network uptime.
                  Occasional gaps, delayed packets, or missing attributes (such
                  as callsign or model) are normal characteristics of open ADS-B
                  data.
                </li>
                <li>
                  <strong>Privacy Architecture:</strong> The website operates in
                  read-only mode with zero cookies, zero user trackers, zero
                  third-party scripts, and zero personal data collection.
                </li>
              </ul>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
