/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Login Page Colors
        "primary": "#6B46C1",
        "secondary": "#FFD700",
        "background-dark": "#17141e",
        "text-dark": "#E2E8F0",
        "placeholder-dark": "#718096",
        "border-dark": "#4A5568",
        
        // New Home Page Colors
        "brand-purple": "#6B46C1",
        "dark-bg": "#110E19",
        "surface": "rgba(23, 20, 30, 0.7)",
        "border-color": "rgba(107, 70, 193, 0.2)",
        "text-primary": "#F7F7F8",
        "text-secondary": "#A09CB0",
        "text-accent": "#D1C6F9",

        //admin dashboard colors
        "primary-glow": "#8b5cf6",
        "card-dark": "#1A1B26", 
        "text-secondary": "#A0AEC0",
        "danger": "#EF4444",
        "success": "#10B981",

        //admin appointments colors
        "event-blue": "#3B82F6",
        "event-green": "#22C55E",
        "event-purple": "#A855F7",
        "event-orange": "#F97316",





      },
      fontFamily: {
        "display": ["Inter", "sans-serif"]
      },
      boxShadow: {
        'glow': '0 0 20px rgba(107, 70, 193, 0.5)',
        'glow-primary-md': '0 0 15px rgba(107, 70, 193, 0.4)',
        "glow": "0 0 15px rgba(107, 70, 193, 0.3)",


      },
      backgroundImage: {
        'dashboard-gradient': 'radial-gradient(at 20% 20%, hsla(258, 60%, 15%, 0.3) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(258, 60%, 15%, 0.3) 0px, transparent 50%), radial-gradient(at 80% 90%, hsla(258, 60%, 25%, 0.2) 0px, transparent 50%)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

