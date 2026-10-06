/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './(tabs)/**/*.{js,jsx,ts,tsx}', // Add this if you use the tabs template
    './*.{js,jsx,ts,tsx}' // Catches files in the root like App.js if you ever use it
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {}
  },
  plugins: []
}
