import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        'base-blue': '#0000ff',
      },
      fontFamily: {
        orbitron: ['var(--font-orbitron)'],
        roboto: ['var(--font-roboto)'],
      }
    },
  },
  plugins: [],
};
export default config;