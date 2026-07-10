/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0A0E1F",
          900: "#0F1530",
          800: "#161D3F",
        },
        evablue: {
          400: "#4C8DFF",
          500: "#2E6BFF",
          600: "#1F4FE0",
        },
        evacyan: {
          300: "#7DF1E8",
          400: "#3FDFD1",
          500: "#17C4B6",
        },
        evapink: {
          500: "#EC4899",
        },
      },
      fontFamily: {
        sans: ["Inter", "Manrope", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 20px 60px -20px rgba(15, 21, 48, 0.25)",
        glow: "0 0 60px -10px rgba(46, 107, 255, 0.45)",
      },
    },
  },
  plugins: [],
};
