const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL 
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` 
    : 'https://base-archery-game.vercel.app');

/**
 * MiniApp configuration following Base documentation standards
 * @see https://docs.base.org/mini-apps/quickstart/migrate-existing-apps
 */
export const minikitConfig = {
  accountAssociation: {
    header: "eyJmaWQiOjI4MTA4NiwidHlwZSI6ImF1dGgiLCJrZXkiOiIweDcwYzUzYjhhMmMxY2I4NzUwQTAwNDRFODNBQUZiOWM5OEE3NDU1NUYifQ",
    payload: "eyJkb21haW4iOiJiYXNlLWFyY2hlcnktZ2FtZS52ZXJjZWwuYXBwIn0",
    signature: "SOHHZWcekisbmPEzjLRo9sOYxludcqtuuWYCRluMUzxLfK9Z8GgZXV5Bk39PTSZEQrMmJl/R7U3JWrtWvTkddxw="
  },
  miniapp: {
    version: "1",
    name: "Base Archery",
    subtitle: "Base Archery: Hit the History",
    description: "An addictive precision arcade game on the Base network. Clear as many levels as possible without hitting other arrows.",
    screenshotUrls: [
      `${ROOT_URL}/scr1.png`,
      `${ROOT_URL}/scr2.png`,
      `${ROOT_URL}/scr3.png`
    ],
    iconUrl: `${ROOT_URL}/logo.png`,
    splashImageUrl: `${ROOT_URL}/splash.png`,
    splashBackgroundColor: "#ffffff",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "games",
    tags: ["game", "miniapp", "casual", "base", "nft"],
    heroImageUrl: `${ROOT_URL}/logo.png`,
    tagline: "Become a Base Legend",
    ogTitle: "Base Archery",
    ogDescription: "An addictive precision arcade game on the Base network.",
    ogImageUrl: `${ROOT_URL}/splash.png`,
  },
} as const;