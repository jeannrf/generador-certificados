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
        sans: ['Archivo', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        display: ['Archivo', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        // Neutros teñidos de la tinta verde (#0F2E2B) en vez del gris azulado de Tailwind (DESIGN.md: "Tinted, never gray").
        // 400 se oscureció para que el texto secundario cumpla contraste sobre blanco.
        slate: {
          50: '#F5F8F7',
          100: '#ECF1F0',
          200: '#DAE3E1',
          300: '#BFCDCA',
          400: '#647974',
          500: '#526864',
          600: '#4B635F',
          700: '#2E4642',
          800: '#1C3734',
          900: '#0F2E2B',
          950: '#0A201E',
        },
        // Un solo verde (DESIGN.md: "One green"): los estados de éxito usan la escala de la marca
        emerald: {
          50: '#F0FAF9',
          100: '#DAF2EF',
          200: '#B2E5DF',
          300: '#7ED1C7',
          400: '#3FAE9F',
          500: '#208077',
          600: '#1B6F67',
          700: '#18655E',
          800: '#14524C',
          900: '#0F3F3A',
          950: '#0A2C29',
        },
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
        'card': '0 1px 2px rgba(15, 46, 43, 0.04)',
        'float': '0 20px 35px -8px rgba(11, 46, 60, 0.2), 0 10px 15px -4px rgba(11, 46, 60, 0.08)',
      },
    },
  },
  plugins: [],
}
