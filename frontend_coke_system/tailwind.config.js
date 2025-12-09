// tailwind.config.js
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      animation: {
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
      },
      colors: {
        // Custom dark mode colors
        'dark': {
          'bg': '#0f172a',
          'surface': '#1e293b', 
          'surface-2': '#334155',
          'border': '#475569',
          'text': '#f1f5f9',
          'text-secondary': '#cbd5e1',
          'text-muted': '#94a3b8'
        }
      },
      backgroundColor: {
        'dark-primary': '#0f172a',
        'dark-secondary': '#1e293b',
        'dark-tertiary': '#334155',
      },
      textColor: {
        'dark-primary': '#f1f5f9',
        'dark-secondary': '#cbd5e1', 
        'dark-muted': '#94a3b8',
      },
      borderColor: {
        'dark-border': '#475569',
        'dark-border-light': '#64748b',
      }
    },
  },
  plugins: [],
};