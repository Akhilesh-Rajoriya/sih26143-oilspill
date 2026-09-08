/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          darkest: '#050811',
          darker: '#0b1120',
          dark: '#111b2e',
          surface: '#182438',
          border: '#24344d',
          accent: '#06b6d4',      // Cyan radar
          accentGlow: 'rgba(6, 182, 212, 0.25)',
          warning: '#f59e0b',     // Amber alert
          danger: '#ef4444',      // Red critical
          success: '#10b981',     // Green cleared
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}

