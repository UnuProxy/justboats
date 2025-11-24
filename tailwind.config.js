// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        // Minimal system-inspired palette
        system: {
          // Primary accent - subtle blue
          blue: '#007AFF',
          blueTint: '#0A84FF',
          blueLight: '#E3F2FD',

          // Semantic colors - very subtle
          green: '#34C759',
          greenLight: '#E8F5E9',
          orange: '#FF9500',
          orangeLight: '#FFF3E0',
          red: '#FF3B30',
          redLight: '#FFEBEE',

          // Neutral grays (main palette)
          gray: {
            50: '#FAFAFA',
            100: '#F5F5F5',
            200: '#E5E5E5',
            300: '#D4D4D4',
            400: '#A3A3A3',
            500: '#737373',
            600: '#525252',
            700: '#404040',
            800: '#262626',
            900: '#171717',
          }
        }
      },
      boxShadow: {
        // Native app-like shadows
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        'md': '0 2px 6px -1px rgba(0, 0, 0, 0.1)',
        'lg': '0 4px 12px -2px rgba(0, 0, 0, 0.08)',
        'xl': '0 8px 24px -4px rgba(0, 0, 0, 0.08)',
      },
      borderRadius: {
        'DEFAULT': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.25rem'
      },
      backdropBlur: {
        'sm': '8px'
      },
    },
  },
  plugins: [],
}
