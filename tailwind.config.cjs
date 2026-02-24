module.exports = {
  content: ["./webview/src/**/*.{ts,html}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfeff",
          100: "#cffafe",
          500: "#0891b2",
          600: "#0e7490",
          700: "#155e75",
          900: "#083344"
        }
      },
      boxShadow: {
        panel: "0 12px 30px rgba(15, 23, 42, 0.14)",
        card: "0 8px 20px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};
