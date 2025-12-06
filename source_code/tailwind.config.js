/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#18181b', // Zinc 900 (Black-ish)
          dark: '#000000',    // Pure Black
          light: '#3f3f46',   // Zinc 700
        },
        secondary: {
          DEFAULT: '#71717a', // Zinc 500
          dark: '#3f3f46',
          light: '#a1a1aa',
        },
        surface: {
          dark: '#09090b',   // Zinc 950
          darker: '#000000', // Pure Black
          light: '#ffffff',
          lighter: '#fafafa', // Zinc 50
        },
        accent: {
          violet: '#18181b', // Muted to black
          cyan: '#71717a',   // Muted to gray
          indigo: '#3f3f46', // Muted to dark gray
        },
        status: {
          success: '#10B981', // Keep functional colors
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '16px',
        card: '16px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.05)',
        'glass-light': '0 4px 20px 0 rgba(0, 0, 0, 0.05)',
        soft: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
      backdropBlur: {
        glass: '12px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
};
