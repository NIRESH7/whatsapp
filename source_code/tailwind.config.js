/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2C2A67', // SBI Dark Blue
          dark: '#1e1d4a',    // Darker Blue
          light: '#3d3b8f',   // Lighter Blue
        },
        secondary: {
          DEFAULT: '#00A3AB', // SBI Teal
          dark: '#008289',    // Darker Teal
          light: '#33b5bc',   // Lighter Teal
        },
        surface: {
          dark: '#0F172A',   // Slate 900 (Navy) - Replaced Black
          darker: '#020617', // Slate 950 (Darker Navy) - Replaced Pure Black
          light: '#ffffff',
          lighter: '#F8F9FA', // Light Gray
        },
        accent: {
          violet: '#2C2A67', // Muted to Primary
          cyan: '#00A3AB',   // Muted to Secondary
          indigo: '#1e1d4a', // Muted to Dark Primary
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
