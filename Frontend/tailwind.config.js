/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
        // Dark surfaces — layered from page background up
        surface: {
          950: '#07070B', // page background
          900: '#0B0B12', // sidebar / sunken areas
          850: '#0F0F17', // raised panels
          800: '#13131D', // cards
          750: '#181824', // hovered cards
          700: '#1E1E2C', // inputs, nested surfaces
          600: '#282838', // borders-strong background
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
      },
      boxShadow: {
        // Dark theme elevations
        card: '0 1px 2px 0 rgb(0 0 0 / 0.4), 0 0 0 1px rgb(255 255 255 / 0.04)',
        'card-hover':
          '0 8px 24px -8px rgb(0 0 0 / 0.6), 0 0 0 1px rgb(255 255 255 / 0.07)',
        dialog: '0 24px 60px -12px rgb(0 0 0 / 0.8), 0 0 0 1px rgb(255 255 255 / 0.08)',
        // Accent glows (threeui-style)
        'glow-sm': '0 0 12px -2px rgb(99 102 241 / 0.35)',
        glow: '0 0 0 1px rgb(99 102 241 / 0.25), 0 8px 32px -8px rgb(99 102 241 / 0.45)',
        'glow-green': '0 0 12px -4px rgb(52 211 153 / 0.5)',
        'glow-amber': '0 0 12px -4px rgb(251 191 36 / 0.5)',
        'glow-red': '0 0 12px -4px rgb(248 113 113 / 0.5)',
        'glow-blue': '0 0 12px -4px rgb(96 165 250 / 0.5)',
        'text-glow': '0 0 24px rgb(129 140 248 / 0.45)',
      },
      transitionTimingFunction: {
        // Custom curves — UI enters with ease-out, never ease-in
        'out-expo': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out-strong': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          // Never from scale(0) — 0.96 with opacity reads as natural
          from: { opacity: '0', transform: 'scale(0.96) translateY(4px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to: { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 350ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'fade-in': 'fade-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'scale-in': 'scale-in 220ms cubic-bezier(0.23, 1, 0.32, 1) both',
        'slide-in-right': 'slide-in-right 300ms cubic-bezier(0.23, 1, 0.32, 1) both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
      fontSize: {
        display: ['2.25rem', { lineHeight: '2.5rem', fontWeight: '700' }],
        heading: ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
        subheading: ['1.125rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        body: ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        caption: ['0.75rem', { lineHeight: '1rem', fontWeight: '400' }],
      },
    },
  },
  plugins: [],
};
