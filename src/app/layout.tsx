import "./globals.css";
import { env } from "~/env";
import Providers from "./providers";
import type { Metadata } from "next";
import { Outfit } from "next/font/google";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const baseUrl = env.BASE_URL;
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
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: siteName,
    title: siteName,
    description: siteDescription,
    images: [
      {
        url: `${baseUrl}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@prudentbird",
    creator: "@prudentbird",
    title: siteName,
    description: siteDescription,
    images: [`${baseUrl}/twitter-image.png`],
  },
  alternates: {
    canonical: baseUrl,
  },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
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
      <body className={`${outfit.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
