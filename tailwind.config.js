/**
 * Tema centralizado de Rider Service (RNF-UX-001).
 *
 * Ningún componente debe escribir colores, radios ni espaciados a mano:
 * todo sale de estos tokens a través de clases de NativeWind.
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Superficies
        fondo: '#0B0B0D',
        superficie: '#16161A',
        'superficie-alta': '#1F1F25',
        borde: '#2A2A32',

        // Marca
        acento: {
          DEFAULT: '#FFC107',
          suave: '#FFD966',
          oscuro: '#C79100',
        },

        // Texto
        texto: {
          DEFAULT: '#FFFFFF',
          tenue: '#9CA3AF',
          sutil: '#6B7280',
          inverso: '#0B0B0D',
        },

        // Semánticos
        exito: '#22C55E',
        peligro: '#EF4444',
        info: '#3B82F6',
      },
      borderRadius: {
        campo: '14px',
        tarjeta: '16px',
        panel: '20px',
      },
      fontSize: {
        micro: ['10px', '14px'],
        mini: ['11px', '15px'],
        chico: ['12px', '16px'],
      },
      spacing: {
        'barra-inferior': '96px',
      },
    },
  },
  plugins: [],
};
