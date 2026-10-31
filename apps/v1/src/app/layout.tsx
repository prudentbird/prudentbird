import "./globals.css";
import { env } from "~/env";
import Providers from "./providers";
import type { Metadata } from "next";
import { Outfit } from "next/font/google";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "sans-serif"],
  adjustFontFallback: true,
});

const baseUrl = env.BASE_URL;
const canonicalUrl = "https://prudentbird.com";
const siteName = "Prudent Bird";
const siteDescription =
  "Prudent Bird - AI & Software Engineer. Building innovative products from concept to reality.";
const keywords = [
  "Prudent Bird",
  "Software Engineer",
  "AI Engineer",
  "Full Stack Developer",
  "Web Development",
  "React Developer",
  "Next.js",
  "TypeScript",
  "Portfolio",
  "FuseIon",
  "Retailytics",
];

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  referrer: "origin",
  description: siteDescription,
  keywords: keywords,
  authors: [
    {
      name: "Prudent Bird",
      url: baseUrl,
    },
  ],
  creator: "Prudent Bird",
  publisher: "Prudent Bird",
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: canonicalUrl,
    siteName: siteName,
    title: siteName,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    site: "@prudentbird",
    creator: "@prudentbird",
    title: siteName,
    description: siteDescription,
  },
  alternates: {
    canonical: canonicalUrl,
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
