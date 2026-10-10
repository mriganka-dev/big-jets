import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Big Jets | Live Flight Radar Map",
    template: "%s | Big Jets",
  },
  description:
    "Live radar tracker for big, rare, VIP, and military aircraft near airports using open ADS-B community data.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
