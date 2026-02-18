/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        ink: '#2f2a26',
        paper: '#f8f2ea',
        card: '#fffdf9',
        smoke: '#efe5d9',
        ash: '#7a6f66',
        warmLine: '#dfd3c3',
        teal: '#5bb5a2',
        mint: '#88d6c6',
        salmon: '#f3b49f',
      },
    },
  },
  plugins: [],
}

