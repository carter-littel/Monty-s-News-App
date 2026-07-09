import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        mist: "#f8fafc",
        line: "#dbe4ee",
        accent: "#0f766e",
        warm: "#f59e0b",
      },
      boxShadow: {
        panel: "0 14px 30px rgba(15, 23, 42, 0.07)",
      },
    },
  },
  plugins: [],
};

export default config;
