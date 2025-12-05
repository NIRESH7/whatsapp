/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#8b5cf6',
          dark: '#7c3aed',
          light: '#a78bfa',
        },
        secondary: {
          DEFAULT: '#06b6d4',
          dark: '#0891b2',
          light: '#22d3ee',
        },
        surface: {
          dark: '#1e293b',
          darker: '#0f172a',
          light: '#ffffff',
          lighter: '#f8fafc',
        },
        accent: {
          violet: '#8b5cf6',
          cyan: '#06b6d4',
          indigo: '#6366f1',
        },
        status: {
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '12px',
        card: '12px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glass-light': '0 8px 32px 0 rgba(200, 200, 200, 0.2)',
        neon: '0 0 20px rgba(139, 92, 246, 0.5)',
        'neon-cyan': '0 0 20px rgba(6, 182, 212, 0.5)',
      },
      backdropBlur: {
        glass: '10px',
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
