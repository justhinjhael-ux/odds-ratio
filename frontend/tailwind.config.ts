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
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(24px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "60%": { opacity: "1", transform: "scale(1.08)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        rise: "rise 0.6s ease-out both",
        "slide-in-right": "slide-in-right 0.35s cubic-bezier(0.25,0.1,0.25,1) both",
        pop: "pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
        shimmer: "shimmer 1.6s ease-in-out infinite",
      },
      transitionTimingFunction: {
        ios: "cubic-bezier(0.25, 0.1, 0.25, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
