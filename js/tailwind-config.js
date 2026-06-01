/** KODA UI v2 — shared Tailwind theme (legacy color names mapped to light palette) */
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#2563EB",
        success: "#059669",
        danger: "#DC2626",
        "background-light": "#F8FAFC",
        "background-dark": "#F8FAFC",
        "surface-dark": "#FFFFFF",
        "border-dark": "#E2E8F0",
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
      },
    },
  },
};
