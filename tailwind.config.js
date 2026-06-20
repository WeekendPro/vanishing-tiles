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
        // ── Afterglow (Vanishing Tiles) semantic palette ──
        vt: {
          void: '#06060B',
          panel: '#0E0E16',
          raised: '#15151F',
          grid: '#1C1C28',
          filled: '#2A2D3A',
          edge: '#3A3E4F',
          magenta: '#FF2D9B', // memory / the gap
          cyan: '#28F0FF',    // system / active
          amber: '#FFC23D',   // time / score
          red: '#FF3B47',     // danger / miss
          lime: '#B6FF3C',    // success / streak
          text: '#EAEAF2',
          dim: '#8A8AA0',
          faint: '#4A4A5C',
        },
      },
      boxShadow: {
        'neon-cyan': '0 0 8px rgba(34,211,238,0.55), 0 0 2px rgba(255,255,255,0.6) inset',
        'neon-magenta': '0 0 8px rgba(255,45,149,0.55)',
        'neon-green': '0 0 8px rgba(57,217,138,0.5)',
        'neon-red': '0 0 8px rgba(255,77,77,0.5)',
        'panel-inset': 'inset 0 0 14px rgba(0,0,0,0.6)',
        'vt-cyan': '0 0 6px #28F0FF, 0 0 22px rgba(40,240,255,0.45)',
        'vt-magenta': '0 0 6px #FF2D9B, 0 0 22px rgba(255,45,155,0.45)',
        'vt-amber': '0 0 6px #FFC23D, 0 0 22px rgba(255,194,61,0.45)',
        'vt-red': '0 0 6px #FF3B47, 0 0 22px rgba(255,59,71,0.45)',
        'vt-lime': '0 0 6px #B6FF3C, 0 0 22px rgba(182,255,60,0.45)',
      },
      fontFamily: {
        pixel: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        silk: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        grotesk: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
