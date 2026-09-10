import type { Config } from "tailwindcss";

/**
 * Puen Publishing design system.
 *
 * The palette is a "warm editorial publishing house": a cream paper ground,
 * warm ink text, a clay/terracotta brand colour, a spruce-green secondary,
 * and a crayon-gold accent used for the institutional "reward" state.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#FCF8F1", // page background
          deep: "#F4EBDD", // recessed / card sections
        },
        ink: {
          DEFAULT: "#26211C", // primary text
          soft: "#5A5148", // secondary text
        },
        clay: {
          DEFAULT: "#C65D3B", // brand / primary CTA
          dark: "#A94A2C",
          light: "#E8B39F",
        },
        spruce: {
          DEFAULT: "#2E6B5E", // secondary / trust
          dark: "#1F5346",
          light: "#CBE0D8",
        },
        crayon: {
          gold: "#E4A93C", // reward / celebration state
          goldsoft: "#F7E7C4",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        book: "0 24px 60px -20px rgba(38, 33, 28, 0.45)",
        card: "0 8px 30px -12px rgba(38, 33, 28, 0.18)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
