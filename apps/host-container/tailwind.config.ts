// import type { Config } from 'tailwindcss';

// // Tailwind will automatically generate the CSS rules for every utility class used across your entire workspace.
// export default {
//   content: [
//     // 1. Scan the Host Container's own files
//     "./index.html",
//     "./src/**/*.{js,ts,jsx,tsx}",

//     // 2. Scan the Audio Generator Micro-Frontend
//     // This tells Tailwind: "Generate CSS for any classes used in this remote app!"
//     "../mfe-audio-generator/src/**/*.{js,ts,jsx,tsx}",

//     // 3. (Optional) Future-proofing for your other MFEs when you build them:
//     // "../mfe-audio-recommendations/src/**/*.{js,ts,jsx,tsx}",
//     // "../mfe-audio-editor/src/**/*.{js,ts,jsx,tsx}",
//   ],
//   theme: {
//     extend: {
//       colors: {
//         // You can also define custom brand colors here that all MFEs will inherit!
//         lyria: {
//           purple: '#8b5cf6',
//           pink: '#ec4899',
//           dark: '#0f172a',
//         }
//       }
//     },
//   },
//   plugins: [],
// } satisfies Config;