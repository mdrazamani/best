import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const withOpacity = (variable: string) => {
  return ({ opacityValue }: { opacityValue?: string }) => {
    if (opacityValue === undefined) {
      return `var(${variable})`;
    }
    return `color-mix(in srgb, var(${variable}) ${Number(opacityValue) * 100}%, transparent)`;
  };
};

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1320px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-mono)", ...defaultTheme.fontFamily.mono],
      },
      colors: {
        slate: {
          50: "#f3f5f8",
          100: "#e8ecf2",
          200: "#d7dee9",
          300: "#bec8d8",
          400: "#94a2b8",
          500: "#71819a",
          600: "#59677d",
          700: "#424e61",
          800: "#2e3747",
          900: "#1d2532",
          950: "#111722",
        },
        background: withOpacity("--background"),
        bg: withOpacity("--bg"),
        "bg-2": withOpacity("--bg-2"),
        "bg-3": withOpacity("--bg-3"),
        surface: withOpacity("--surface"),
        "surface-2": withOpacity("--surface-2"),
        "surface-3": withOpacity("--surface-3"),
        surface2: withOpacity("--surface-2"),
        card: withOpacity("--card"),
        popover: withOpacity("--popover"),
        border: withOpacity("--border"),
        "border-strong": withOpacity("--border-strong"),
        text: withOpacity("--text"),
        muted: withOpacity("--muted"),
        faint: withOpacity("--text-faint"),
        primary: {
          DEFAULT: withOpacity("--primary"),
          50: withOpacity("--primary-50"),
          100: withOpacity("--primary-100"),
          200: withOpacity("--primary-200"),
          300: withOpacity("--primary-300"),
          400: withOpacity("--primary-400"),
          500: withOpacity("--primary-500"),
          600: withOpacity("--primary-600"),
          700: withOpacity("--primary-700"),
          800: withOpacity("--primary-800"),
          900: withOpacity("--primary-900"),
        },
        "primary-soft": withOpacity("--primary-soft"),
        "primary-border": withOpacity("--primary-border"),
        "primary-glow": withOpacity("--primary-glow"),
        danger: withOpacity("--danger"),
        warning: withOpacity("--warning"),
        success: withOpacity("--success"),
        info: withOpacity("--info"),
        brand: {
          DEFAULT: withOpacity("--primary"),
          50: withOpacity("--primary-50"),
          100: withOpacity("--primary-100"),
          200: withOpacity("--primary-200"),
          300: withOpacity("--primary-300"),
          400: withOpacity("--primary-400"),
          500: withOpacity("--primary-500"),
          600: withOpacity("--primary-600"),
          700: withOpacity("--primary-700"),
          800: withOpacity("--primary-800"),
          900: withOpacity("--primary-900"),
        },
        accent: {
          DEFAULT: withOpacity("--primary"),
          50: withOpacity("--accent-50"),
          100: withOpacity("--accent-100"),
          200: withOpacity("--accent-200"),
          300: withOpacity("--accent-300"),
          400: withOpacity("--accent-400"),
          500: withOpacity("--accent-500"),
          600: withOpacity("--accent-600"),
          700: withOpacity("--accent-700"),
          800: withOpacity("--accent-800"),
          900: withOpacity("--accent-900"),
        },
      },
      borderRadius: {
        sm: "var(--radius-xs)",
        md: "var(--radius-sm)",
        lg: "var(--radius-sm)",
        xl: "var(--radius-md)",
        "2xl": "var(--radius-lg)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        glow: "var(--shadow-glow)",
        popover: "var(--shadow-popover)",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 180ms ease-out",
        "fade-in": "fade-in 180ms ease-out",
        "slide-up": "slide-up 180ms ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
