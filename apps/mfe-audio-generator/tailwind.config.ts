/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // 👈 This makes sure it scans GeneratorStudio.tsx!
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}