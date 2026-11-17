/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        pitch: {
          950: '#05080D',
          900: '#070B10',
          850: '#0B121B',
          800: '#0E1621',
          750: '#131E2D',
          700: '#192739',
        },
        wateen: {
          emerald: '#10B981',
          crimson: '#E11D48',
          gold: '#F59E0B',
        },
      },
      boxShadow: {
        glow: '0 0 28px rgba(16, 185, 129, 0.18)',
        'glow-red': '0 0 24px rgba(225, 29, 72, 0.25)',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        pulseLive: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(1.25)' },
        },
      },
      animation: {
        'pulse-live': 'pulseLive 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
