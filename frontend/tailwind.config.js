/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-dark': 'var(--bg-dark)',
        'bg-panel': 'var(--bg-panel)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'primary-light': 'var(--primary)',
        'primary': 'var(--primary)',
        'secondary': 'var(--secondary)',
        'accent': 'var(--accent)',
        'premium': 'var(--premium)',
      },
      fontFamily: {
        'main': 'var(--font-main)',
        'heading': 'var(--font-heading)',
        'ui': 'var(--font-ui)',
      },
      boxShadow: {
        'neon-blue': '0 0 15px rgba(0, 242, 255, 0.4)',
        'neon-green': '0 0 15px rgba(0, 255, 136, 0.4)',
        'neon-purple': '0 0 15px rgba(112, 0, 255, 0.4)',
      }
    },
  },
  plugins: [],
}
