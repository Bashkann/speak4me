/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#10211c',
        canvas: '#f5f7f3',
        brand: {
          50: '#eefbf5',
          100: '#d6f5e6',
          200: '#afeacc',
          300: '#7bd9ad',
          400: '#43bf89',
          500: '#22a36f',
          600: '#16835a',
          700: '#126849',
          800: '#11533d',
          900: '#0f4434'
        }
      },
      boxShadow: {
        soft: '0 24px 60px -32px rgba(16, 33, 28, 0.35)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
