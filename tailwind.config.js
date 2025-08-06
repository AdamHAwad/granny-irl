/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Horror-themed dark palette
        'granny': {
          'bg': '#0a0a0b',
          'surface': '#1a1a1d',
          'surface-light': '#252529',
          'border': '#2a2a2d',
          'danger': '#c41e3a',
          'survivor': '#2d5a3d',
          'text': '#f5f5f5',
          'text-muted': '#a0a0a0',
          'warning': '#f59e0b',
          'success': '#4ade80',
          'error': '#ef4444',
        }
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        'xs': '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(196, 30, 58, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(196, 30, 58, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}