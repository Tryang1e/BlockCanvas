import type { Config } from "tailwindcss";

export default {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% center' },
          '100%': { backgroundPosition: '0 center' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        typing: {
          '0%': { width: '0' },
          '100%': { width: '100%' },
        },
        blink: {
          '0%, 100%': { borderColor: 'transparent' },
          '50%': { borderColor: 'inherit' },
        },
        slideUpGroup: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(calc(-100% + 1.5em))' },
        },
        fadeLoop: {
          '0%, 10%': { opacity: '1' },
          '15%, 95%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      },
      animation: {
        shimmer: 'shimmer 3s linear infinite',
        slideUp: 'slideUp 0.5s ease-out forwards',
        fadeIn: 'fadeIn 0.5s ease-out forwards',
        typing: 'typing 2s steps(40, end), blink 0.75s step-end infinite',
        slideUpGroup: 'slideUpGroup 10s linear infinite',
        fadeLoop: 'fadeLoop 10s linear infinite',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
} satisfies Config;
