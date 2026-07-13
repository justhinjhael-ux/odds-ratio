import type { Config } from "tailwindcss";

// ## Paleta de marca — violeta/púrpura premium (#5B18D9 primario)
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#5B18D9",
        secondary: "#8A2BE2",
        accent: "#A855F7",
        brand: {
          50: "#F7F8FC",
          100: "#EDE7FB",
          200: "#D7C5F7",
          300: "#BB96F0",
          400: "#9D6FE8",
          500: "#8A2BE2",
          600: "#5B18D9",
          700: "#4A13B0",
          800: "#3B1A73",
          900: "#2E0F5C",
          950: "#1A0836",
        },
        success: {
          400: "#34D399",
          500: "#10B981",
        },
      },
      borderRadius: {
        pill: "9999px",
      },
      boxShadow: {
        deep: "0 25px 60px -15px rgba(46, 15, 92, 0.45)",
        lift: "0 10px 25px -8px rgba(91, 24, 217, 0.35)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        rise: "rise 0.6s ease-out both",
      },
      transitionTimingFunction: {
        ios: "cubic-bezier(0.25, 0.1, 0.25, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
