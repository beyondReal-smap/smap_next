/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      fontFamily: {
        'suite': ['var(--font-lineseed)', 'ui-sans-serif', 'system-ui'],
        'sans': ['var(--font-system)', 'ui-sans-serif', 'system-ui'],
      },
      colors: {
        primary: {
          50: '#f0f5ff',
          100: '#e0eaff',
          200: '#c9d5ff',
          300: '#a6b6ff',
          400: '#8091ff',
          500: '#5c69f5',
          600: '#4f46e5', // 인디고 600
          700: '#3832a8',
          800: '#292980',
          900: '#1e1b5b',
        },
      },
      animation: {
        'fadeIn': 'fadeIn 0.5s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme('colors.gray.700'),
            a: {
              color: theme('colors.indigo.600'),
              '&:hover': {
                color: theme('colors.indigo.800'),
              },
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}; 