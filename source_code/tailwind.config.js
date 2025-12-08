/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#818cf8', // Pale Lavender (Indigo 400)
          dark: '#6366f1',    // Indigo 500
          light: '#a5b4fc',   // Indigo 300
        },
        secondary: {
          DEFAULT: '#c084fc', // Purple 400
          dark: '#a855f7',    // Purple 500
          light: '#e879f9',   // Fuchsia 400
        },
        surface: {
          dark: '#0f172a',   // Slate 900 (Soft Midnight)
          darker: '#020617', // Slate 950 (Deepest)
          light: '#ffffff',
          lighter: '#f1f5f9', // Slate 100
        },
        accent: {
          violet: '#818cf8', // Mapped to Primary
          cyan: '#22d3ee',   // Cyan 400
          indigo: '#4f46e5',
        },
        status: {
          success: '#34d399', // Emerald 400 (Softer)
          warning: '#fbbf24', // Amber 400
          error: '#f87171',   // Red 400
          info: '#818cf8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '16px',
        card: '24px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
        'glass-light': '0 4px 20px 0 rgba(0, 0, 0, 0.05)',
        soft: '0 10px 40px -10px rgba(0,0,0,0.1)',
        glow: '0 0 20px rgba(129, 140, 248, 0.4)', // Soft Lavender Glow
        'glow-sm': '0 0 10px rgba(129, 140, 248, 0.2)',
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
