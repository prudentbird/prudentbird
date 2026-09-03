import "./globals.css";
import { env } from "~/env";
import Providers from "./providers";
import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { PostHogProvider, PostHogPageView } from "@posthog/next";
import { SiteHeader } from "~/components/site-header";
import { SiteFooter } from "~/components/site-footer";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const siteName = "Sudoku";
const description =
  "Play sudoku with friends in real time. Team up on one board or race to finish first.";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: `${siteName} · Multiplayer`,
    template: `%s · ${siteName}`,
  },
  description,
  openGraph: {
    type: "website",
    siteName,
    title: `${siteName} · Multiplayer`,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} · Multiplayer`,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} antialiased`}>
        <PostHogProvider
          clientOptions={{
            api_host: "/ingest",
            person_profiles: "identified_only",
            disable_session_recording: true,
            autocapture: false,
          }}
        >
          <PostHogPageView />
          <Providers>
            <div className="flex min-h-dvh flex-col">
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </div>
          </Providers>
        </PostHogProvider>
      </body>
    </html>
  );
}
