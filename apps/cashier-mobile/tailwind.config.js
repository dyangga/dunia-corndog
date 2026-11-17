module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        canvas: "#FAF9F6",
        ink: "#292929",
        cream: "#FFF4DC",
        brand: "#E63946",
      },
    },
  },
  plugins: [],
};
