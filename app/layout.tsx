import type { Metadata } from "next";
import { Orbitron, Roboto } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const orbitron = Orbitron({ 
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-orbitron",
});

const roboto = Roboto({ 
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-roboto",
});

const APP_URL = "https://citrea-archery-game.vercel.app";

export const metadata: Metadata = {
  title: "Citrea Archery",
  description: "Compete in the Citrea Archery Tournament. Mint your score as NFT on Citrea.",
  metadataBase: new URL(APP_URL),
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: "Citrea Archery",
    description: "Compete in the Citrea Archery Tournament.",
    url: APP_URL,
    siteName: "Citrea Archery",
    images: [
      {
        url: `/opengraph-img.png?v=3`,
        width: 1200,
        height: 630,
        alt: "Citrea Archery Tournament",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Citrea Archery",
    description: "Compete in the Citrea Archery Tournament. Mint your score as NFT on Citrea.",
    images: [`/opengraph-img.png?v=3`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${orbitron.variable} ${roboto.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
