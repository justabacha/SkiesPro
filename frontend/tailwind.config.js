/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          light: '#DBEAFE',
          dark: '#1E40AF',
        },
        bg: {
          light: {
            primary: '#FFFFFF',
            secondary: '#F8F9FA',
            tertiary: '#F0F2F5',
          },
          dark: {
            primary: '#0F1117',
            secondary: '#1A1D26',
            tertiary: '#262933',
          },
        },
        text: {
          light: {
            primary: '#1A1D23',
            secondary: '#6B7280',
            tertiary: '#9CA3AF',
          },
          dark: {
            primary: '#F3F4F6',
            secondary: '#9CA3AF',
            tertiary: '#6B7280',
          },
        },
        border: {
          light: {
            DEFAULT: '#E5E7EB',
            hover: '#D1D5DB',
          },
          dark: {
            DEFAULT: '#2D313E',
            hover: '#3D4151',
          },
        },
        success: {
          DEFAULT: '#059669',
          light: '#D1FAE5',
        },
        warning: {
          DEFAULT: '#D97706',
          light: '#FEF3C7',
        },
        danger: {
          DEFAULT: '#DC2626',
          light: '#FEE2E2',
        },
        info: {
          DEFAULT: '#2563EB',
          light: '#DBEAFE',
        },
        risk: {
          low: '#059669',
          medium: '#D97706',
          high: '#DC2626',
          critical: '#7F1D1D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      spacing: {
        'xxs': '4px',
        'xs': '8px',
        'sm': '12px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        'xxl': '48px',
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0,0,0,0.05)',
        'md': '0 4px 6px rgba(0,0,0,0.07)',
        'lg': '0 10px 15px rgba(0,0,0,0.1)',
        'xl': '0 20px 25px rgba(0,0,0,0.15)',
        'dark-sm': '0 1px 2px rgba(0,0,0,0.3)',
        'dark-md': '0 4px 6px rgba(0,0,0,0.35)',
        'dark-lg': '0 10px 15px rgba(0,0,0,0.4)',
        'dark-xl': '0 20px 25px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
