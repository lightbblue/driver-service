# Rider Service — *Nunca viajes solo*

Sistema integral de asistencia mecánica para **autos y motos**: conecta en tiempo real al conductor que necesita ayuda con un mecánico o un taller cercano, y centraliza el pedido, la asignación, el seguimiento, el cobro y la calificación del servicio.

**Materia:** Aplicaciones Móviles · **Entrega final**

La especificación completa está en [`docs/Rider-Service-SRS.pdf`](docs/Rider-Service-SRS.pdf). Los planes y casos de prueba están en la misma carpeta.

---

## Modelo de negocio

Cualquier conductor de un auto o una moto que tiene un problema en la calle o en la ruta (sin nafta, con una pinchadura, sin batería o con una falla) puede pedir ayuda, indicando su vehículo y modelo para que el mecánico sepa a qué va antes de aceptar.

- **Clientes:** conductores de autos y motos. Ven el precio fijo antes de pedir y pagan solo cuando confirman que el problema quedó resuelto.
- **Mecánicos y talleres:** mecánicos independientes que trabajan en ruta y talleres (de autos, motos o ambos) con uno o más mecánicos. Cada taller declara sus especialidades, entre ellas **Autos** y **Motos**, y el cliente puede filtrarlos en el mapa.
- **Plataforma:** cobra una **comisión del 10 %** de cada servicio cobrado; el mecánico recibe el 90 %. Si el servicio se cancela o no se resuelve, el pago se devuelve y no hay comisión.

---

## Integrantes

- Joaquín Stachioni
- Agustín Galeano
- Agustín Russo
- Víctor Aguilera
- Leo Franco
- Thiago Ferreyra
- Donato Díaz Cardozo
- Casandra Godoy
- Amir Gramajo
- Lucas González

---

## Qué hace la app

**Cliente**
- Pide asistencia en 4 pasos: problema, ubicación con GPS, vehículo (auto o moto y modelo) y confirmación con el precio fijo y el medio de pago.
- Puede pedirla con el botón **SOS** (la toma cualquier mecánico disponible) o a un **taller en particular** desde el mapa.
- Sigue al mecánico en vivo en el mapa, con la ruta por las calles y el tiempo estimado de llegada.
- **Confirma la llegada** del mecánico para que empiece el trabajo, y **confirma que quedó resuelto** para que se cobre. Si no quedó resuelto, se le devuelve el pago.
- Califica al mecánico y deja reseñas a los talleres.

**Mecánico**
- Ve las solicitudes disponibles (primero las pedidas a su taller), con el precio, su neto, el vehículo y el recorrido hasta el cliente.
- Acepta, sale en camino, marca la llegada y el trabajo terminado.
- Al registrarse crea su taller (y queda como dueño), se suma a uno existente (el dueño lo acepta) o trabaja en ruta.
- El dueño administra su taller desde **Mi taller**: datos, ubicación, fotos, especialidades y miembros.

**Para los dos:** notificaciones dentro de la app, perfil con foto y cobro simulado con Mercado Pago (retenido hasta que se confirma) o en efectivo.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | React Native + Expo SDK 58 (Expo Router) |
| Estilos | NativeWind (Tailwind CSS) con tema centralizado |
| Lenguaje | TypeScript en modo estricto |
| Backend | Supabase: Auth (correo y Google), PostgreSQL con RLS, Realtime y Storage |
| Lógica del servidor | Funciones y triggers en PL/pgSQL (estados, precio, cobro, permisos) |
| Mapas | Leaflet (WebView en el celular, librería en la web) con teselas de CARTO; rutas con OSRM |

---

## Instalación y ejecución

Requiere Node.js 20 o superior.

```bash
npm install
cp .env.example .env   # en Windows (PowerShell): Copy-Item .env.example .env
npx expo start -c
```

Después, desde la terminal de Expo: `a` abre Android, `w` abre la web, o se escanea el QR con **Expo Go**.

### Variables de entorno (`.env`)

| Variable | Para qué |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `EXPO_PUBLIC_SUPABASE_KEY` | Clave **publicable** de Supabase (viaja en la app; los datos los protege RLS) |
| `EXPO_PUBLIC_CARTO_KEY` | Opcional. Clave gratis de CARTO para el mapa Voyager; sin clave se usa el mapa de Esri |

Si cambia alguna variable, hay que reiniciar Expo con `-c`.

### Iniciar sesión con Google en el celular

En Expo Go, Google solo vuelve a la app si Expo se levanta **con túnel**, porque Supabase no acepta direcciones de vuelta con IP:

```bash
npx expo start --tunnel ngrok -c
```

Si `ngrok` da error la primera vez: `npm install --no-save @expo/ngrok@^4.1.0`. La app de Google está en modo Prueba: solo pueden entrar las cuentas cargadas como usuarios de prueba.

---

## Base de datos

Todo el esquema está versionado en [`supabase/migrations/`](supabase/migrations/). Para levantar una base nueva, se ejecutan los archivos **en orden** en el SQL Editor de Supabase. Después se puede comprobar con:

```bash
npm run verificar:supabase
```

Puntos clave:
- **RLS en todas las tablas.** Un cliente solo ve sus solicitudes; un mecánico, las que tiene asignadas o puede tomar.
- **La app no puede fijar montos ni saltear estados.** El precio, la comisión (10 %), el cobro y cada cambio de estado los valida la base.
- **Flujo del servicio:** `pendiente → en camino → llegó → trabajando → esperando confirmación → finalizado`, con `cancelada` (antes de empezar) y `no resuelta` (se devuelve el pago). El cliente es quien confirma la llegada y la resolución.

---

## Estructura del proyecto

```
src/
├── app/            Rutas (Expo Router): auth, pestañas, solicitud, mi-taller, editar-perfil
├── components/     ui (sistema de diseño), mapa, seguimiento, taller, home, perfil, registro…
├── services/       ÚNICO acceso a datos (Supabase y JSON)
├── types/          Tipos del dominio
├── hooks/          use-recurso y sesión
├── lib/            Tema, formato, íconos y utilidades
└── data/           Contenido editorial en JSON (consejos y promociones)
supabase/migrations/  Esquema, funciones, triggers, RLS y datos de prueba
docs/                 SRS, plan de testing, casos de test y status del proyecto
```

Dos reglas del proyecto:
1. **Ninguna vista accede a los datos directamente:** todo pasa por `/services`.
2. **Ningún componente escribe colores a mano:** salen del tema (`tailwind.config.js` y `src/lib/tema.ts`).

---

## Calidad

```bash
npx tsc --noEmit   # tipos
npm run lint       # ESLint
```

Cada commit referencia el requisito que implementa (por ejemplo `feat(RF-VIEW-004): …`) y todo entra a `main` por Pull Request.

---

## Datos de prueba

- 10 talleres reales de Pilar y Tortuguitas (datos públicos), cargados como talleres **no adheridos**: aparecen en el mapa y se los puede llamar.
- "Taller Demo", con su dueño, para probar el circuito completo de solicitud, confirmación, cobro y calificación.

Ninguna credencial privada está versionada: `.env` está en `.gitignore`, y las claves privadas (service role de Supabase, secreto de Google) nunca entran al repositorio.

---

## Uso de inteligencia artificial

El equipo usó **Claude** (Anthropic), mediante Claude Code, como asistente de desarrollo:

- generar y revisar código de pantallas, servicios y migraciones de la base;
- diagnosticar errores (por ejemplo, del inicio de sesión con Google o del mapa);
- redactar y actualizar la documentación (SRS y este README).

Todo lo generado fue revisado, probado en la app y validado por un integrante antes de incorporarse: nadie integra código que no pueda explicar. Las migraciones de la base las ejecutó el equipo a mano. No se compartieron con la herramienta claves privadas ni datos personales de terceros.
