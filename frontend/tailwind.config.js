/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#d3f7eb",
          100: "#a8f0da",
          200: "#6fe1c5",
          300: "#3ac5a6",
          400: "#02b5b1",
          500: "#238878",
          600: "#238878",
          700: "#238878",
          800: "#1b6f65",
          900: "#14554e",
        },
        accent: {
          50: "#d3f7eb",
          100: "#a8f0da",
          200: "#6fe1c5",
          300: "#3ac5a6",
          400: "#02b5b1",
          500: "#238878",
          600: "#1b6f65",
          700: "#185e56",
          800: "#124c45",
          900: "#0c3d38",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
