/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7C3AED', // Attmosfire Purple
          dark: '#6D28D9',
          light: '#8B5CF6',
        },
        secondary: {
          DEFAULT: '#64748B', // Slate
          dark: '#475569',
          light: '#94A3B8',
        },
        surface: {
          dark: '#1E1E2E',   // Deep Charcoal (Sidebar)
          darker: '#181825', // Darker background
          light: '#F3F4F6',  // Light Gray (Main Content)
          lighter: '#FFFFFF',
        },
        accent: {
          violet: '#7C3AED',
          cyan: '#06B6D4',
          indigo: '#6366F1',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'], // Keeping Poppins as requested (no template changes)
      },
      borderRadius: {
        DEFAULT: '16px', // Rounded 2xl look
        card: '16px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.15)', // Softer glass
        'glass-light': '0 4px 20px 0 rgba(0, 0, 0, 0.05)', // Clean soft shadow
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
