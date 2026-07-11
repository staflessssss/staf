import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter, JetBrains_Mono, Manrope } from "next/font/google";

import "./globals.css";
import { BehalfyStructuredData } from "./structured-data";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Behalfy | Managed AI Agents for Customer Operations";
const description =
  "Fully managed AI agents that connect customer channels with CRM, calendars, booking tools, data, and custom business systems through native integrations or APIs.";

export const metadata: Metadata = {
  metadataBase: new URL("https://behalfy.io"),
  title: {
    default: title,
    template: "%s | Behalfy",
  },
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Behalfy",
    title,
    description,
    images: [
      {
        url: "/assets/behalfy-hero-coast.png",
        width: 1742,
        height: 903,
        alt: "Behalfy managed AI assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/assets/behalfy-hero-coast.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
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
      className={`${inter.variable} ${manrope.variable} ${fraunces.variable} ${jetBrainsMono.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans text-foreground">
        <BehalfyStructuredData />
        {children}
      </body>
    </html>
  );
}
