/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './components/**/*.{vue,js,ts}',
    './themes/**/*.{vue,js,ts}',
    './pages/**/*.{vue,js,ts}',
    './app.vue',
    './error.vue',
  ],
  theme: {
    extend: {
      colors: {
        // AI 高级感色系：深空蓝底 + 电光青 + 品牌紫
        ink: {
          50:  '#F6F7FB',
          100: '#EDEFF7',
          200: '#D6D9E6',
          300: '#A9ADC1',
          400: '#7C8199',
          500: '#565B72',
          600: '#3A3E52',
          700: '#232637',
          800: '#14161F',
          900: '#0A0B10',
          950: '#050609',
        },
        primary: {
          DEFAULT: '#7C5CFF',
          50:  '#F1EDFF',
          100: '#E3DAFF',
          200: '#C6B4FF',
          300: '#A88EFF',
          400: '#8B6BFF',
          500: '#7C5CFF',
          600: '#5D3CEE',
          700: '#4627C7',
          800: '#321B94',
          900: '#22126B',
        },
        accent: {
          DEFAULT: '#22D3EE', // electric cyan
          400: '#5AE2F7',
          500: '#22D3EE',
          600: '#0FB5D1',
        },
        signal: {
          DEFAULT: '#F472B6', // CTA magenta
          500: '#F472B6',
          600: '#E64CA0',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'mesh-hero':
          'radial-gradient(60% 60% at 20% 10%, rgba(124,92,255,0.35) 0%, rgba(124,92,255,0) 60%),' +
          'radial-gradient(50% 50% at 85% 20%, rgba(34,211,238,0.25) 0%, rgba(34,211,238,0) 60%),' +
          'radial-gradient(45% 45% at 50% 90%, rgba(244,114,182,0.22) 0%, rgba(244,114,182,0) 60%)',
        'gradient-cta':
          'linear-gradient(135deg, #7C5CFF 0%, #22D3EE 100%)',
        'gradient-text':
          'linear-gradient(90deg, #A88EFF 0%, #22D3EE 50%, #F472B6 100%)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(124,92,255,0.35), 0 8px 40px -8px rgba(124,92,255,0.45)',
        'glow-accent': '0 0 0 1px rgba(34,211,238,0.35), 0 8px 40px -8px rgba(34,211,238,0.45)',
        'card-hover': '0 10px 40px -12px rgba(124,92,255,0.35)',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient-pan': 'gradientPan 8s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        gradientPan: {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
