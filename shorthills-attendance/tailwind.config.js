/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#04080f',
          900: '#070d1a',
          800: '#0f172a',
          700: '#1e293b',
          600: '#334155',
        },
        violet: {
          700: '#6d28d9',
          600: '#7c3aed',
          500: '#8b5cf6',
          400: '#a78bfa',
          300: '#c4b5fd',
        },
        electric: {
          500: '#3b82f6',
          600: '#2563eb',
          400: '#60a5fa',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
      },
      boxShadow: {
        'glow-violet': '0 0 30px rgba(124, 58, 237, 0.25)',
        'glow-blue': '0 0 30px rgba(59, 130, 246, 0.25)',
      },
    },
  },
  plugins: [],
}
