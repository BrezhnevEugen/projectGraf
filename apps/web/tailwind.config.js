/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0e1116',
        panel: '#161b22',
        'panel-2': '#1f2731',
        edge: '#2d343d',
        accent: '#7c5cff',
        'accent-2': '#22d3ee',
        muted: '#8b949e',
      },
    },
  },
  plugins: [],
};
