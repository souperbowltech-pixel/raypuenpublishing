import type { Config } from "tailwindcss";

// Slow in and slow out, shared by transitions and keyframe animations.
const EASE_OUT_SOFT = "cubic-bezier(0.22, 1, 0.36, 1)";
const MOTION_MS = { press: 120, fast: 200, medium: 320, slow: 600 } as const;

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
      // Motion tokens. Easing gives slow in and slow out; "spring" overshoots a
      // little so a press or a pop settles instead of stopping dead.
      transitionTimingFunction: {
        "out-soft": EASE_OUT_SOFT,
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      transitionDuration: {
        "120": `${MOTION_MS.press}ms`,
        "320": `${MOTION_MS.medium}ms`,
        "600": `${MOTION_MS.slow}ms`,
      },
      // Each keyframe is written as key poses. Overshoot then settle is the
      // follow through; the dip before the rise is the anticipation.
      keyframes: {
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "55%": { opacity: "1", transform: "scale(1.12)" },
          "80%": { transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        boing: {
          "0%": { transform: "scale(1)" },
          "20%": { transform: "scale(0.85)" },
          "55%": { transform: "scale(1.12)" },
          "80%": { transform: "scale(0.96)" },
          "100%": { transform: "scale(1)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-12deg)" },
          "50%": { transform: "rotate(10deg)" },
          "75%": { transform: "rotate(-6deg)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-6px)" },
          "40%": { transform: "translateX(6px)" },
          "60%": { transform: "translateX(-4px)" },
          "80%": { transform: "translateX(4px)" },
        },
        // Lands on a curve: up and to the left, then down onto its spot.
        stamp: {
          "0%": { opacity: "0", transform: "translate(-14px, -6px) rotate(-18deg) scale(1.4)" },
          "35%": { opacity: "1", transform: "translate(-8px, -20px) rotate(-8deg) scale(1.2)" },
          "70%": { transform: "translate(2px, 2px) rotate(4deg) scale(0.95)" },
          "100%": { opacity: "1", transform: "translate(0, 0) rotate(0deg) scale(1)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-scale": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "pop-in": `pop-in ${MOTION_MS.slow}ms ${EASE_OUT_SOFT} both`,
        boing: `boing ${MOTION_MS.slow}ms ${EASE_OUT_SOFT} both`,
        wiggle: "wiggle 700ms ease-in-out 150ms both",
        shake: `shake ${MOTION_MS.medium}ms ease-in-out both`,
        stamp: `stamp ${MOTION_MS.slow}ms ${EASE_OUT_SOFT} both`,
        rise: `rise ${MOTION_MS.medium}ms ${EASE_OUT_SOFT} both`,
        "fade-scale": `fade-scale ${MOTION_MS.fast}ms ${EASE_OUT_SOFT} both`,
      },
    },
  },
  plugins: [],
};

export default config;
