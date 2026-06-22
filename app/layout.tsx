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

// Set NEXT_PUBLIC_SITE_URL to your production URL so social/OG links are
// absolute; falls back to localhost in dev.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const TITLE = "Flipkart Goat Sale — Out-bleat the Goat for 50% Off";
const DESCRIPTION =
  "Chat with the Flipkart Goat in fluent baa across 5 rounds. Bleat back, make him laugh, and unlock 50% off in this playful Flipkart Goat Sale experience.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Flipkart Goat Sale",
  keywords: [
    "Flipkart",
    "Goat Sale",
    "Big Billion Days",
    "50% off",
    "discount",
    "offers",
  ],
  openGraph: {
    type: "website",
    siteName: "Flipkart Goat Sale",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/GOAT.png",
        width: 941,
        height: 1672,
        alt: "Flipkart Goat Sale — the judgy goat",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/GOAT.png"],
  },
  icons: {
    icon: "/GOAT.png",
    apple: "/GOAT.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
