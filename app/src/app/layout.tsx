import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tech Resolutions Studio",
  description:
    "Interactive canvas for a 2025 tech resolutions video with scripted beats and instant browser renders.",
  openGraph: {
    title: "Tech Resolutions Studio",
    description:
      "Interactive canvas for a 2025 tech resolutions video with scripted beats and instant browser renders.",
    url: "https://agentic-9e18f076.vercel.app",
    siteName: "Tech Resolutions Studio",
    images: [
      {
        url: "https://agentic-9e18f076.vercel.app/og-cover.png",
        width: 1200,
        height: 630,
        alt: "Tech Resolutions storyboard preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tech Resolutions Studio",
    description:
      "Interactive canvas for a 2025 tech resolutions video with scripted beats and instant browser renders.",
    images: ["https://agentic-9e18f076.vercel.app/og-cover.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950`}
      >
        {children}
      </body>
    </html>
  );
}
