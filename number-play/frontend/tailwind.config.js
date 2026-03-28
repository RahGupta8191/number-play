/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#6C63FF",
          bg:     "#f9fafb",
        },
      },
      fontFamily: {
        fun: ["'Inter'", "sans-serif"],
      },
      keyframes: {
        pop: {
          "0%":   { transform: "scale(0.97)", opacity: "0" },
          "100%": { transform: "scale(1)",    opacity: "1" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-4px)" },
          "40%, 80%": { transform: "translateX(4px)" },
        },
      },
      animation: {
        pop:   "pop 0.2s ease-out",
        shake: "shake 0.35s ease-in-out",
      },
    },
  },
  plugins: [],
};
