import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#f5f3ef',
        surface: '#ffffff',
        'surface-2': '#f0ede8',
        border: '#e2ddd6',
        text: '#1a1916',
        'text-2': '#6b6760',
        'text-3': '#9e9a94',
        accent: '#1d5c3a',
        'accent-light': '#e8f2ec',
        'accent-2': '#c8832a',
        'accent-2-light': '#fdf3e7',
        danger: '#c0392b',
        'danger-light': '#fdecea',
        warning: '#b45309',
        'warning-light': '#fef3c7',
        info: '#1e40af',
        'info-light': '#dbeafe',
        purple: '#6d28d9',
        'purple-light': '#ede9fe',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '10px',
      },
      boxShadow: {
        DEFAULT: '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
export default config
