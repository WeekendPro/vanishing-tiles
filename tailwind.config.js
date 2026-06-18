/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', './supabase/functions/_shared/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          cyan: '#22d3ee',
          magenta: '#ff2d95',
          green: '#39d98a',
          red: '#ff4d4d',
          yellow: '#facc15',
        },
        arcade: {
          bg: '#030712',
          panel: '#060d12',
          edge: '#0e2b33',
          well: '#0c1f25',
        },
      },
      boxShadow: {
        'neon-cyan': '0 0 8px rgba(34,211,238,0.55), 0 0 2px rgba(255,255,255,0.6) inset',
        'neon-magenta': '0 0 8px rgba(255,45,149,0.55)',
        'neon-green': '0 0 8px rgba(57,217,138,0.5)',
        'neon-red': '0 0 8px rgba(255,77,77,0.5)',
        'panel-inset': 'inset 0 0 14px rgba(0,0,0,0.6)',
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        display: ['Sora', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
