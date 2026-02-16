import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0f0f0f",
          card: "#161616",
          border: "#262626",
        },
        danger: "#dc2626",
        live: "#b91c1c",
        buy: "#16a34a",
        sell: "#ea580c",
        muted: "#737373",
      },
      height: {
        header: "56px",
      },
    },
  },
  plugins: [],
};

export default config;
