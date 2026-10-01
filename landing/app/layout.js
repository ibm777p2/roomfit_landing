import { EB_Garamond, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/content";
import "./globals.css";

// Self-hosted by Next at build time: no request to Google from visitors.
// EB Garamond loads its real italic, per the design system.
const display = EB_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const body = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});
const data = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-data",
  display: "swap",
});

const title = "roomfit — Find a room that fits in San Francisco";
const description =
  "Rooms ranked by how you actually live, with the reason for every score. Join roomfit in your SF neighborhood.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  openGraph: { title, description, url: "/", siteName: "roomfit", type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport = {
  themeColor: "#f4f1e5",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${data.variable}`}>
      <body>{children}</body>
    </html>
  );
}
