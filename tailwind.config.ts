/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ivory: '#F8F5F1', white: '#FFFDFC',
        brand: { DEFAULT: '#5B3D48', ink: '#48303A' },
        mauve: '#A9838B', blush: '#E7D6D4', sage: '#A9ADA2',
        charcoal: '#34302F', border: '#DDD6D1',
        gray: {
          50: '#F8F5F1', 100: '#F0EAE5', 200: '#DDD6D1',
          300: '#C8BEB8', 400: '#8A7B79', 500: '#655859',
          600: '#615556', 700: '#514749', 800: '#40383A', 900: '#34302F',
        },
      },
    },
  },
  plugins: [],
};
