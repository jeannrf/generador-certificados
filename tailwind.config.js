/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        cormorant: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        montserrat: ['Montserrat', 'sans-serif'],
        poppins: ['Poppins', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          50: '#f0faf9',
          100: '#daf2ef',
          200: '#b2e5df',
          300: '#7ed1c7',
          400: '#4eb8ac',
          500: '#2a9c91',
          600: '#208077',
          700: '#18655e',
          800: '#14504b',
          900: '#0e3834',
          950: '#072220',
        },
        forest: {
          50: '#f2f8f7',
          100: '#dfeeed',
          500: '#208077',
          700: '#18655e',
          800: '#14504b',
          900: '#0e3834',
          950: '#082522',
        },
        deep: {
          DEFAULT: '#09252c',
          card: '#0c353f',
        },
      },
      boxShadow: {
        'glow': '0 0 25px -5px rgba(13, 118, 110, 0.25)',
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card': '0 4px 24px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
        'float': '0 20px 35px -8px rgba(11, 46, 60, 0.2), 0 10px 15px -4px rgba(11, 46, 60, 0.08)',
      },
    },
  },
  plugins: [],
}
