import "./globals.css";
import Providers from "./providers";
import type { Metadata } from "next";
import { Outfit } from "next/font/google";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prudent Bird",
  description: "Prudent Bird - AI | Software Engineer",
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
