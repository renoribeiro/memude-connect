import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";


/** Escalas da identidade MeMude. As cores "soltas" do Tailwind (blue-500, green-100, red-600…) usadas pelas telas
 *  passam a cair nos tons do guia, mantendo o sentido: roxo (azuis/violetas), rosa (vermelhos), sucesso (verdes),
 *  alerta (amarelos/laranjas) e neutros lilás (cinzas). */
const roxo = { 50: '#F5F3FA', 100: '#EEEAF8', 200: '#E4DEF7', 300: '#C9BDEE', 400: '#A08BDB', 500: '#7A62C4', 600: '#5A43A8', 700: '#422F91', 800: '#34247A', 900: '#281C5E', 950: '#1E1640' };
const rosa = { 50: '#FFF1F5', 100: '#FDE8EF', 200: '#F6CADA', 300: '#F09AB6', 400: '#EC5F8C', 500: '#E92662', 600: '#D41F58', 700: '#B0164A', 800: '#8E123D', 900: '#6E0E30', 950: '#45081D' };
const sucesso = { 50: '#EFF8F3', 100: '#E3F4EA', 200: '#C3E6D1', 300: '#93D1AE', 400: '#5DB585', 500: '#359A65', 600: '#258457', 700: '#1F7A4D', 800: '#1A5F3D', 900: '#154C32', 950: '#0B2B1C' };
const alerta = { 50: '#FFF8EA', 100: '#FFF1D6', 200: '#FCE0A8', 300: '#F7C76E', 400: '#EFAA3A', 500: '#D98C12', 600: '#B26E05', 700: '#935A02', 800: '#7A4A00', 900: '#5E3900', 950: '#382200' };
const neutro = { 50: '#FAF9FD', 100: '#F5F3FA', 200: '#E7E3F1', 300: '#DCD6EA', 400: '#A39CBB', 500: '#8A83A3', 600: '#6B6385', 700: '#4A4266', 800: '#2E2650', 900: '#1E1640', 950: '#120D28' };

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        inter: ['"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        gray: neutro, slate: neutro, zinc: neutro, neutral: neutro, stone: neutro,
        blue: roxo, sky: roxo, indigo: roxo, violet: roxo, purple: roxo,
        red: rosa, rose: rosa, pink: rosa, fuchsia: rosa,
        green: sucesso, emerald: sucesso, teal: sucesso, cyan: sucesso, lime: sucesso,
        amber: alerta, yellow: alerta, orange: alerta,
        /** Identidade visual do app MeMude (tokens em src/index.css) */
        mm: {
          'roxo': 'hsl(var(--mm-roxo) / <alpha-value>)',
          'rosa': 'hsl(var(--mm-rosa) / <alpha-value>)',
          'acao': 'hsl(var(--mm-acao) / <alpha-value>)',
          'rosa-texto': 'hsl(var(--mm-rosa-texto) / <alpha-value>)',
          'lilas': 'hsl(var(--mm-lilas) / <alpha-value>)',
          'rosa-claro': 'hsl(var(--mm-rosa-claro) / <alpha-value>)',
          'rosa-palido': 'hsl(var(--mm-rosa-palido) / <alpha-value>)',
          'borda-rosa': 'hsl(var(--mm-borda-rosa) / <alpha-value>)',
          'borda-suave': 'hsl(var(--mm-borda-suave) / <alpha-value>)',
          'campo': 'hsl(var(--mm-campo) / <alpha-value>)',
          'divisor': 'hsl(var(--mm-divisor) / <alpha-value>)',
          'sobre-roxo': 'hsl(var(--mm-sobre-roxo) / <alpha-value>)',
          'sucesso': 'hsl(var(--mm-sucesso) / <alpha-value>)',
          'sucesso-fundo': 'hsl(var(--mm-sucesso-fundo) / <alpha-value>)',
          'alerta': 'hsl(var(--mm-alerta) / <alpha-value>)',
          'alerta-fundo': 'hsl(var(--mm-alerta-fundo) / <alpha-value>)',
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          light: "hsl(var(--primary-light))",
          dark: "hsl(var(--primary-dark))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          light: "hsl(var(--secondary-light))",
          dark: "hsl(var(--secondary-dark))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          foreground: "hsl(var(--error-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
          border: "hsl(var(--card-border))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-subtle': 'var(--gradient-subtle)',
        'gradient-card': 'var(--gradient-card)',
      },
      boxShadow: {
        // Sombras sempre no tom do texto (#1E1640), quase nenhuma
        sm: '0 1px 2px hsl(var(--mm-sombra) / 0.05)',
        DEFAULT: '0 1px 3px hsl(var(--mm-sombra) / 0.07)',
        md: '0 4px 12px hsl(var(--mm-sombra) / 0.08)',
        lg: '0 10px 24px hsl(var(--mm-sombra) / 0.1)',
        xl: '0 14px 30px hsl(var(--mm-sombra) / 0.16)',
        '2xl': '0 20px 40px hsl(var(--mm-sombra) / 0.2)',
        'glow': 'var(--shadow-glow)',
        'glow-pink': 'var(--shadow-glow-pink)',
      },
      borderRadius: {
        lg: "var(--radius)", // cartão 16
        md: "calc(var(--radius) - 2px)", // campo 14
        sm: "calc(var(--radius) - 4px)", // miniatura 12
        xl: "calc(var(--radius) + 4px)", // 20 (destaque usa rounded-[22px])
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
