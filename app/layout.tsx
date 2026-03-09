import type { Metadata } from "next";
import { Orbitron, Roboto } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import '@coinbase/onchainkit/styles.css';

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
  icons: {
    icon: 'https://citrea-archery-game.vercel.app/favicon.svg',
    shortcut: 'https://citrea-archery-game.vercel.app/favicon.svg',
    apple: 'https://citrea-archery-game.vercel.app/favicon.svg',
  },
  openGraph: {
    title: "Citrea Archery",
    description: "Compete in the Citrea Archery Tournament.",
    images: [`${APP_URL}/opengraph-image.png`],
  },
  other: {
    "base:app_id": "696eb06ac0ab25addaaaf6af",
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: `${APP_URL}/opengraph-image.png`,
      button: {
        title: "Play Archery",
        action: {
          type: "launch_frame",
          name: "Citrea Archery",
          url: APP_URL,
          splashImageUrl: `${APP_URL}/splash.png`,
          splashBackgroundColor: "#000010"
        }
      }
    }),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="base:app_id" content="696eb06ac0ab25addaaaf6af" />
      </head>
      <body className={`${orbitron.variable} ${roboto.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}