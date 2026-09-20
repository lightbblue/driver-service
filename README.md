# Rider Service — *Nunca viajes solo*

Aplicación móvil de asistencia al motociclista: conecta en tiempo real a quien necesita ayuda en la ruta con el mecánico que puede prestarla.

**Materia:** Aplicaciones Móviles · **Entrega 1 — MVP de interfaz**

---

## ⚠️ Alcance de esta entrega

> **Esta entrega comprende pantallas, no funcionalidad.**

La Entrega 1 es un **MVP de interfaz**: un conjunto de pantallas terminadas y navegables cuyo contenido proviene de archivos JSON locales. Es una decisión documentada, no una omisión.

Si abrís la app y esperás que el login autentique, **no lo hace**. Tampoco valida formularios, ni guarda datos, ni registra solicitudes. Nada de eso está implementado todavía.

| Sí está implementado | No está implementado (y por qué) |
|---|---|
| Las pantallas completas, fieles a la maqueta | Autenticación y registro real — exige el backend operativo |
| Navegación entre todas las pantallas | Validación de formularios — es lógica, va junto con la autenticación |
| Contenido leído desde JSON vía capa de servicios | Persistencia y estado global — sin operaciones que persistir, no tiene sentido |
| Estado visual de los controles (selección, foco, pestaña activa) | Reglas de negocio, cálculos y decisiones del sistema |
| Avance y retroceso entre los pasos del flujo | Bloqueo del avance según lo ingresado |
| Estados de carga y de lista vacía | Manejo de errores de red o de operación |

El razonamiento: **autenticar exige que Supabase esté operativo**. Construir un simulacro de login ahora es escribir código que se descarta apenas llegue el backend. En esta etapa se invierte donde el trabajo se conserva — el sistema de diseño, la estructura de navegación y las pantallas.

El detalle completo está en `01-Rider-Service-Requerimientos-MoSCoW.md`, sección 1.3.

---

## Pantallas

### Comprometidas — MUST

| # | Pantalla | Ruta | Requisito |
|---|---|---|---|
| 1 | Iniciar sesión | `/login` | `RF-VIEW-002` |
| 2 | Registro (Usuario / Mecánico) | `/register` | `RF-VIEW-003` |
| 3 | Inicio | `/inicio` | `RF-VIEW-004` |
| 4 | Perfil | `/perfil` | `RF-VIEW-005` |
| 5 | Solicitar asistencia (4 pasos) | `/solicitud/nueva` | `RF-VIEW-006` |

Más la estructura de navegación (`RF-VIEW-011`) y la capa de datos (`RF-VIEW-012`).

### Fuera del alcance comprometido — SHOULD

`Mecánicos cerca tuyo` (`/mapa`) y `Mis solicitudes` (`/solicitudes`) muestran una pantalla de *Próximamente* que declara su requisito. Es lo que pide `RF-VIEW-011`: una pestaña sin pantalla nunca debe provocar un error.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | React Native + Expo (Expo Router) |
| Estilos | NativeWind (Tailwind CSS para React Native) |
| Lenguaje | TypeScript en modo estricto |
| Datos (Entrega 1) | Archivos JSON locales |
| Backend (Entrega 2) | Supabase — Auth, PostgreSQL, Realtime, Storage |

---

## Instalación y ejecución

Requiere Node.js 20 o superior.

```bash
npm install
npm start
```

Después, desde la terminal de Expo:

- `a` — abrir en emulador o dispositivo Android
- `i` — abrir en simulador de iOS
- o escanear el QR con **Expo Go**

Verificado en Android 10+ (`RNF-COMP-001`).

---

## Estructura del proyecto

```
src/
├── app/                    Rutas (Expo Router) — solo vistas
│   ├── _layout.tsx         Stack raíz
│   ├── index.tsx           Entrada → redirige a /login
│   ├── (auth)/             login · register
│   ├── (tabs)/             inicio · mapa · solicitudes · perfil
│   └── solicitud/          nueva · confirmada
├── components/
│   ├── ui/                 Sistema de diseño (Boton, CampoTexto, Tarjeta…)
│   ├── navegacion/         Barra inferior con el botón SOS
│   ├── home/  perfil/  solicitud/   Componentes por pantalla
├── services/               ÚNICO acceso a datos — funciones asíncronas
├── data/                   Archivos JSON
├── types/                  Interfaces del dominio
├── hooks/                  use-recurso (puente vistas ↔ servicios)
└── lib/                    Utilidades (formato, íconos, clases)
```

### Dos reglas que sostienen el proyecto

**1 · Ningún componente importa un JSON.** Todo pasa por `/services`, que expone funciones asíncronas. En la Entrega 2 se reimplementa `/services` con el cliente de Supabase y **no se toca ninguna vista** (`RNF-SCAL-001`). Es la razón por la que entregar solo pantallas no es tiempo perdido.

**2 · Ningún componente escribe un color o una medida a mano.** Todo sale del tema centralizado en `tailwind.config.js` mediante clases de NativeWind (`RNF-UX-001`).

Los tipos de `/types` espejan las tablas del modelo de datos (`03-Rider-Service-Modelo-de-Datos.md`), para que la migración no obligue a reescribir componentes.

---

## Recorridos de verificación

Al no haber funcionalidad, lo que se verifica son recorridos de navegación:

1. **Ingreso** — `Login → (botón principal) → Inicio`
2. **Registro** — `Login → Registrate → Usuario → conmutador → Mecánico → Inicio`
3. **Solicitud** — `Inicio → Solicitar asistencia → Paso 1 → 2 → 3 → 4 → Confirmar`
4. **Navegación** — `Inicio → Perfil → Inicio → SOS → Solicitar asistencia`

---

## Convención de commits

Cada commit referencia el ID del requisito que implementa (`RNF-TRACE-002`):

```
feat(RF-VIEW-004): pantalla de Inicio con contenido desde la capa de servicios
```

Relación esperada: `Requisito → Criterio de aceptación → Tarea → Commit → Evidencia`.

Toda pantalla se integra por Pull Request con revisión de otro integrante. No se admiten *pushes* directos a `main` (`RNF-MAIN-002`).

---

## Datos de prueba

Los JSON de `src/data/` incluyen casos límite deliberados (`RNF-TEST-002`): taller con nombre muy largo, logo nulo, mecánico sin calificaciones, mecánico no disponible, usuario sin localidad, consejo sin imagen y solicitud cancelada. Sirven para verificar que la interfaz no se rompe.

**No contienen datos personales reales** de los integrantes ni de terceros (`RNF-PRIV-001`): los correos usan el dominio `@riderservice.test` y los teléfonos son marcadores.

Ninguna credencial está versionada: `.env` figura en `.gitignore` (`RNF-SEC-001`).

---

## Uso de inteligencia artificial

El equipo utilizó asistencia de IA para la implementación de pantallas y la documentación. Todo el código generado fue revisado, comprendido y validado por un integrante antes de incorporarse: nadie integra código que no pueda explicar (`RNF-AI-002`). No se introdujeron credenciales ni información personal sensible en herramientas externas (`RNF-AI-003`).

---

## Integrantes

<!-- Completar con nombre y rol de cada integrante -->

| Integrante | Rol |
|---|---|
| | |
