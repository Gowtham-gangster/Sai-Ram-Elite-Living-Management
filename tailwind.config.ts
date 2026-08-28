import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: "#fdf8ee",
          100: "#faefd5",
          200: "#f5dda8",
          300: "#efc470",
          400: "#e9a83d",
          500: "#d98a1b",
          600: "#be6e13",
          700: "#984e12",
          800: "#7b3e15",
          900: "#653415",
          950: "#3a1906",
        },
        navy: {
          800: "#0f172a",
          850: "#0b1324",
          900: "#090d16",
          950: "#040711",
        },
      },
      boxShadow: {
        'glow': '0 0 25px -5px rgba(217, 138, 27, 0.25)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
        'card-dark': '0 10px 30px -5px rgba(0, 0, 0, 0.4)',
      }
    },
  },
  plugins: [],
};
export default config;
