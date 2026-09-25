/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0b',
        surface: '#131316',
        surface2: '#1a1a1f',
        border: '#26262c',
        text: '#ececec',
        muted: '#a1a1aa',
        accent: '#7fb685',
        accentDim: '#4a6b4e',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      borderRadius: { xl2: '14px' },
    },
  },
  plugins: [],
};
