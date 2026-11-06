module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#1E3A5F",
          teal: "#0F766E",
          tealDark: "#0B5C55",
          amber: "#B45309",
          red: "#B91C1C",
          green: "#15803D",
          bg: "#F8FAFC",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};