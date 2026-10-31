# Rider Service — Especificación de Requerimientos (SRS)

**Proyecto:** Sistema Integral de Asistencia al Motociclista
**Producto:** Rider Service — *"Nunca viajes solo"*
**Materia:** Aplicaciones Móviles
**Versión:** 4.0
**Estado:** baseline de la entrega final (lunes 2 de noviembre de 2026)
**Fecha:** octubre de 2026

> La versión 4.0 reemplaza a la 3.0. Ya no hay entregas por etapas: hay una sola entrega final con el
> proyecto completo. La priorización MoSCoW se expresa respecto de esa entrega, y cada requisito indica
> su estado de implementación.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React Native + Expo SDK 57 (Expo Router) |
| Estilos | NativeWind (Tailwind CSS para React Native) con tema centralizado |
| Lenguaje | TypeScript en modo estricto |
| Autenticación | Supabase Auth (correo y contraseña, Google OAuth) |
| Base de datos | PostgreSQL gestionado por Supabase, con RLS en todas las tablas |
| Tiempo real | Supabase Realtime |
| Archivos | Supabase Storage |
| Lógica del servidor | Funciones PL/pgSQL y triggers |
| Ubicación | expo-location; mapa Leaflet (WebView en móvil) |
| Contenido editorial | Archivos JSON locales (consejos y promociones) |
| Control de versiones | Git + GitHub (Pull Requests) |

---

## 1. Propósito y alcance

### 1.1 Propósito del producto

Los motociclistas son uno de los grupos más vulnerables ante imprevistos mecánicos en ruta. Rider
Service es una plataforma **bimodal** que conecta en tiempo real al **motociclista** que necesita ayuda
con el **mecánico** que puede prestarla. Centraliza:

- el diagnóstico inicial;
- la asignación del prestador;
- el seguimiento del servicio;
- el cobro.

El valor diferencial es **gestionar la incertidumbre** del usuario: quién viene, cuándo llega y cuánto
cuesta.

### 1.2 Modelo de negocio

Rider Service obtiene ingresos mediante una **comisión del 10 %** sobre cada servicio finalizado y
pagado a través de la aplicación.

- **Cobro centralizado.** El cliente paga el monto total del servicio a Rider Service. El sistema
  registra, por cada pago:
  - el monto total;
  - la comisión de la plataforma (10 %);
  - el neto que le corresponde al mecánico (90 %).
- **Liquidación al mecánico.** El neto queda registrado como saldo a liquidar. En la entrega final la
  transferencia efectiva se documenta, pero no se ejecuta.
- **Pago simulado.** En la entrega final el pago no pasa por una pasarela real. Una pantalla de pago
  simulado reproduce el flujo completo (resumen, medio de pago y confirmación) y el registro del pago
  y de la comisión se hace en la base de datos, del lado del servidor.
- **Evolución prevista.** El paso siguiente es integrar Mercado Pago:
  - **Checkout Pro**, con las credenciales del lado del servidor y la confirmación por webhook;
  - después, el modelo **marketplace** (`marketplace_fee`), que divide el pago en el momento entre el
    mecánico y la plataforma.

### 1.3 Alcance de la entrega final

| Incluido | Fuera de alcance (documentado como futuro) |
|---|---|
| Autenticación real (correo y contraseña, Google para clientes) | Recuperación de contraseña por correo |
| Registro de cliente y de mecánico | Notificaciones push |
| Solicitud de asistencia con GPS | Seguimiento GPS del mecánico en vivo |
| Asignación y máquina de estados con bitácora | Presupuesto con desglose y versiones |
| Seguimiento en tiempo real | Pasarela de pago real (Mercado Pago) |
| Lado del mecánico (bandeja, aceptar, avanzar estados) | Traslado con mini-tráiler y talleres asociados |
| Perfil editable con foto | Rider Shop, comunidad y calificaciones |
| Mapa de mecánicos cercanos y su ficha | Panel de administración |
| Monto final del servicio, pago simulado y comisión | |

### 1.4 Estados de implementación

| Estado | Significado |
|---|---|
| ✅ Hecho | Implementado e integrado en la rama `integracion-final` |
| 🟡 Parcial | Implementado con una parte pendiente, indicada en la descripción |
| ⏳ Pendiente | Comprometido para la entrega final, todavía sin implementar |
| — | No se implementa en esta entrega (COULD o WON'T) |

---

## 2. Convenciones

### 2.1 Priorización MoSCoW (respecto de la entrega final)

| Prioridad | Significado |
|---|---|
| **MUST** | Sin este requisito la entrega no es válida. |
| **SHOULD** | De alto valor; se implementa si el tiempo lo permite. |
| **COULD** | Deseable, prescindible. Solo se documenta. |
| **WON'T** | Fuera de alcance por decisión explícita. Se documenta para evitar el *scope creep*. |

### 2.2 Identificadores

`RF-<MÓDULO>-<NNN>` (funcional), `RNF-<ÁREA>-<NNN>` (no funcional), `RN-<NNN>` (regla de negocio).
Los identificadores son **inmutables**:

- los requisitos de la v3.0 conservan su ID;
- los requisitos nuevos se marcan con **(nuevo v4)**;
- los requisitos modificados se marcan con **(modificado v4)**.

---

## 3. Actores

| ID | Actor | Descripción | En la entrega final |
|---|---|---|---|
| ACT-01 | Cliente | Motociclista que solicita asistencia, sigue el servicio y lo paga. | Sí |
| ACT-02 | Mecánico | Prestador que recibe, acepta y ejecuta servicios, y carga su monto final. | Sí |
| ACT-03 | Taller asociado | Recibe motos cuando se requiere traslado. | No |
| ACT-04 | Sistema | Validaciones, transiciones, código de solicitud, cálculo de comisión. | Sí (base de datos) |
| ACT-05 | Administrador | Catálogo, moderación, disputas, liquidaciones. | No |

---

## 4. Mapa de pantallas

| # | Pantalla | Ruta | Requisito | Prioridad | Estado |
|---|---|---|---|---|---|
| 1 | Iniciar sesión | `/(auth)/login` | RF-VIEW-002 | MUST | ✅ |
| 2 | Registro (Usuario / Mecánico) | `/(auth)/register` | RF-VIEW-003 | MUST | ✅ |
| 3 | Inicio | `/(tabs)/inicio` | RF-VIEW-004 | MUST | ✅ |
| 4 | Perfil | `/(tabs)/perfil` | RF-VIEW-005 | MUST | ✅ |
| 5 | Editar perfil | `/editar-perfil` | RF-VIEW-013 (nuevo v4) | MUST | ✅ |
| 6 | Solicitar asistencia (4 pasos) | `/solicitud/nueva` | RF-VIEW-006 | MUST | ✅ |
| 7 | Solicitud confirmada | `/solicitud/confirmada` | RF-VIEW-006 | MUST | ✅ |
| 8 | Seguimiento de solicitud | `/solicitud/[id]` | RF-VIEW-008 | MUST (modificado v4) | ✅ |
| 9 | Mis solicitudes / Mis servicios | `/(tabs)/solicitudes` | RF-VIEW-009 | MUST (modificado v4) | ✅ |
| 10 | Pago del servicio | `/solicitud/pago` | RF-VIEW-014 (nuevo v4) | MUST | ⏳ |
| 11 | Mecánicos cerca tuyo | `/(tabs)/mapa` | RF-VIEW-007 | SHOULD | ⏳ |
| 12 | Detalle de mecánico | `/mecanico/[id]` | RF-VIEW-010 | SHOULD | ⏳ |
| 13 | Mis ganancias (mecánico) | `/ganancias` | RF-VIEW-015 (nuevo v4) | SHOULD | ⏳ |
| — | Selección de rol | `/(auth)/role` | RF-VIEW-001 | WON'T (modificado v4) | — |

### 4.1 Definición de "pantalla terminada"

Una pantalla está terminada cuando:

- usa exclusivamente el tema de NativeWind (colores, medidas y tipografías), sin valores escritos a mano;
- obtiene sus datos solo a través de `/services`;
- contempla los estados de carga, de lista vacía y de error;
- es navegable, y el botón Atrás de Android se comporta de forma coherente;
- no se rompe con textos largos ni campos nulos;
- no genera errores ni advertencias en consola, y pasa `tsc` y `expo lint`;
- fue probada en Android, en un dispositivo físico o un emulador.

---

## 5. Requisitos funcionales

### 5.1 Pantallas

| ID | Requisito | Prioridad | Estado | Notas |
|---|---|---|---|---|
| RF-VIEW-001 | Pantalla de selección de rol | WON'T (modificado v4) | — | Reemplazada por el conmutador Usuario/Mecánico del registro; el rol queda en la cuenta. |
| RF-VIEW-002 | Inicio de sesión | MUST | ✅ | Correo y contraseña reales. El botón de Google pasa a ser funcional (RF-AUTH-007). |
| RF-VIEW-003 | Registro con variantes Usuario y Mecánico | MUST | ✅ | La variante Mecánico incluye taller, ubicación, especialidades y descripción. |
| RF-VIEW-004 | Inicio | MUST | ✅ | Saludo con el perfil real; mecánicos destacados desde la base; consejos y promociones desde JSON. |
| RF-VIEW-005 | Perfil | MUST | ✅ | Datos, foto y estadísticas reales; la calificación queda como "—" hasta implementar reseñas. |
| RF-VIEW-006 | Flujo de solicitud en 4 pasos | MUST | 🟡 | Funcional, con GPS. Pendiente: el botón Atrás de Android debe volver al paso anterior. |
| RF-VIEW-007 | Mecánicos cerca tuyo | SHOULD | ⏳ | Mapa con marcadores, distancia, filtro por especialidad y botón "Ver perfil". |
| RF-VIEW-008 | Seguimiento de solicitud | MUST (modificado v4) | ✅ | Estado, línea de tiempo de 6 estados, mapa, mecánico, contacto y cancelación. |
| RF-VIEW-009 | Mis solicitudes / Mis servicios | MUST (modificado v4) | ✅ | Cliente: activas y finalizadas. Mecánico: "Mis servicios" y "Disponibles". |
| RF-VIEW-010 | Detalle de mecánico | SHOULD | ⏳ | Datos, descripción, especialidades, ubicación y contacto. |
| RF-VIEW-011 | Estructura de navegación con botón SOS | MUST | 🟡 | Pestaña Mapa en "Próximamente" hasta que se haga RF-VIEW-007. |
| RF-VIEW-012 | Contenido desde la capa de servicios | MUST (modificado v4) | ✅ | Datos operativos desde Supabase; contenido editorial desde JSON. Ninguna vista accede a Supabase ni a un JSON directamente. |
| RF-VIEW-013 | Editar perfil (nuevo v4) | MUST | ✅ | Nombre y teléfono con validación. |
| RF-VIEW-014 | Pago del servicio (nuevo v4) | MUST | ⏳ | Ver 5.9. |
| RF-VIEW-015 | Mis ganancias del mecánico (nuevo v4) | SHOULD | ⏳ | Ver RF-PAY-004. |

### 5.2 Autenticación y sesión

| ID | Requisito | Prioridad | Estado | Descripción |
|---|---|---|---|---|
| RF-AUTH-001 | Rol con efecto real | MUST | ✅ | El rol de la cuenta determina las pantallas y acciones disponibles. |
| RF-AUTH-002 | Inicio de sesión | MUST | ✅ | Contra Supabase Auth. El mensaje de error no revela qué campo falló. La sesión se guarda en el dispositivo. |
| RF-AUTH-003 | Registro de cliente | MUST | ✅ | Validación de campos, mínimo de 6 caracteres, coincidencia de contraseñas y términos. |
| RF-AUTH-004 | Registro de mecánico | MUST | ✅ | Un trigger crea el perfil y la ficha del mecánico con taller, ubicación y especialidades. |
| RF-AUTH-005 | Cierre de sesión | MUST | 🟡 | Limpia la sesión y vuelve al login. Pendiente: pedir confirmación antes de cerrar. |
| RF-AUTH-006 | Control de acceso por rol | MUST | ✅ | Reforzado con RLS en la base. |
| RF-AUTH-007 | Inicio de sesión con Google (modificado v4) | MUST | ⏳ | Ver detalle abajo. |
| RF-AUTH-008 | Recuperación de contraseña | COULD | — | Requiere configurar el correo de Supabase con enlaces de vuelta a la app. |
| RF-AUTH-009 | Validación de formularios | MUST | ✅ | Mensajes de error en pantalla. |

**RF-AUTH-007: inicio de sesión con Google.** OAuth 2.0 mediante Supabase Auth, con el proveedor
Google y el navegador del sistema (`expo-web-browser`, con flujo PKCE).

Criterios de aceptación:

- El botón "Continuar con Google" del login abre la selección de cuenta de Google y, al volver,
  ingresa al Inicio con la sesión creada.
- La cuenta creada con Google tiene siempre el rol **cliente** (RN-015). El nombre y la foto se toman
  de Google.
- El registro de mecánicos se hace solo con el formulario completo, porque necesita taller,
  ubicación y especialidades.
- Si el correo ya existía con contraseña, Supabase vincula las dos identidades a la misma cuenta.
- El *client secret* de Google se configura en Supabase y nunca forma parte del repositorio.
- Funciona en Expo Go: las URL de retorno `exp://**` y `riderservice://**` están habilitadas en Supabase.
- Si el usuario cancela, vuelve al login sin error.

### 5.3 Perfil

| ID | Requisito | Prioridad | Estado | Descripción |
|---|---|---|---|---|
| RF-PROF-001 | Perfil con datos propios | MUST | ✅ | RLS impide leer perfiles ajenos. |
| RF-PROF-002 | Edición de datos personales | MUST | ✅ | Nombre y teléfono. La localidad queda como COULD. |
| RF-PROF-003 | Disponibilidad del mecánico | SHOULD | ⏳ | El mecánico activa o desactiva su disponibilidad. Un mecánico no disponible no ve solicitudes nuevas (RN-003). |
| RF-PROF-004 | Mis motos | WON'T | — | Futuro. |
| RF-PROF-005 | Mecánicos favoritos | WON'T | — | Futuro. |
| RF-PROF-006 | Notificaciones y seguridad | WON'T | — | Futuro. |
| RF-PROF-007 | Foto de perfil (nuevo v4) | MUST | ✅ | Hasta 5 MB, en formato JPG, PNG o WebP. Se guarda en el bucket `avatars`, en la carpeta del usuario. |

### 5.4 Solicitud de asistencia

| ID | Requisito | Prioridad | Estado | Descripción |
|---|---|---|---|---|
| RF-ASSIST-001 | Flujo con validación por paso | MUST | ✅ | No se avanza sin completar los campos obligatorios. |
| RF-ASSIST-002 | Tipo de avería obligatorio | MUST | ✅ | 8 categorías, desde la base. |
| RF-ASSIST-003 | Ubicación real por GPS | MUST | ✅ | Con expo-location. Si el GPS falla, se informa al usuario. |
| RF-ASSIST-004 | Descripción opcional | MUST | ✅ | Hasta 200 caracteres. |
| RF-ASSIST-005 | Creación de la solicitud | MUST | ✅ | Código `RS-AAAA-NNNN`, fecha y hora, estado inicial *pendiente*. |
| RF-ASSIST-006 | Selección de vehículo | WON'T | — | Depende de RF-PROF-004. |
| RF-ASSIST-007 | Evidencia fotográfica | COULD | — | El bucket privado `archivos` ya existe. |
| RF-ASSIST-008 | Cancelar solicitud | MUST | ✅ | Antes de *trabajando* (RN-009), con motivo, y queda registrada en la bitácora. |
| RF-SOS-001 | Acceso rápido SOS | MUST | ✅ | El botón central abre el flujo de solicitud. |

### 5.5 Asignación

| ID | Requisito | Prioridad | Estado | Descripción |
|---|---|---|---|---|
| RF-MATCH-001 | Mecánicos disponibles ven las solicitudes pendientes | MUST | ✅ | Bandeja "Disponibles", restringida por RLS. |
| RF-MATCH-002 | Notificación push de oportunidades | WON'T | — | Futuro. La bandeja se actualiza por Realtime. |
| RF-MATCH-003 | Aceptar servicio | MUST | ✅ | El mecánico informa el tiempo estimado de llegada (ETA). |
| RF-MATCH-004 | Evitar asignación múltiple | MUST | ✅ | Actualización condicional atómica en `aceptar_solicitud` (RN-002). |

### 5.6 Máquina de estados

```
pendiente → aceptado → en_camino → llegue → trabajando → finalizado
     └──────────┴───────────┴─────────┘
                    ↓
                cancelada
```

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-STATE-001 | Gestión de estados con transiciones validadas en la base | MUST | ✅ |
| RF-STATE-002 | → En camino (solo el mecánico asignado) | MUST | ✅ |
| RF-STATE-003 | → Llegué | MUST | ✅ |
| RF-STATE-004 | → Trabajando | MUST | ✅ |
| RF-STATE-005 | → Finalizado (modificado v4: requiere cargar el monto final, RF-QUOTE-001) | MUST | 🟡 |

### 5.7 Seguimiento

| ID | Requisito | Prioridad | Estado | Descripción |
|---|---|---|---|---|
| RF-TRACK-001 | Seguimiento con datos reales | MUST | ✅ | |
| RF-TRACK-002 | Línea de tiempo en tiempo real | MUST | ✅ | Supabase Realtime. |
| RF-TRACK-003 | Contacto con el mecánico | MUST | ✅ | Llamada y WhatsApp mediante `Linking`. |
| RF-TRACK-004 | Historial de solicitudes | MUST | ✅ | |

### 5.8 GPS

| ID | Requisito | Prioridad | Estado |
|---|---|---|---|
| RF-GPS-001 | Ver la ubicación del mecánico en el mapa | COULD | — |
| RF-GPS-002 | Emitir la ubicación del mecánico en vivo | WON'T | — |
| RF-GPS-003 | Geofencing de llegada | WON'T | — |

### 5.9 Presupuesto, pago y comisión

| ID | Requisito | Prioridad | Estado | Descripción |
|---|---|---|---|---|
| RF-QUOTE-001 | Monto final del servicio (modificado v4) | MUST | ⏳ | Al pasar a *finalizado*, el mecánico carga el monto final en pesos, mayor que cero. Queda asociado a la solicitud. |
| RF-QUOTE-002 | Consultar el monto | MUST | ⏳ | El cliente ve el monto en el seguimiento y en la pantalla de pago. |
| RF-QUOTE-003 | Presupuesto con desglose y aceptación previa | WON'T | — | Desglose en mano de obra, repuestos y tasa; con versiones. Futuro. |
| RF-PAY-001 | Pago simulado del servicio (nuevo v4) | MUST | ⏳ | Ver detalle abajo. |
| RF-PAY-002 | Registro del pago con comisión (nuevo v4) | MUST | ⏳ | Ver detalle abajo. |
| RF-PAY-003 | Estado de pago visible (nuevo v4) | MUST | ⏳ | Mis solicitudes y el seguimiento muestran "Pendiente de pago" o "Pagado". |
| RF-PAY-004 | Ganancias del mecánico (nuevo v4) | SHOULD | ⏳ | El mecánico ve sus servicios cobrados, el neto de cada uno (90 %) y el total a liquidar. |
| RF-PAY-005 | Integración con Mercado Pago (nuevo v4) | WON'T | — | Checkout Pro en modo de prueba, con Edge Functions y webhook. Futuro. |
| RF-PAY-006 | Pago dividido marketplace (nuevo v4) | WON'T | — | `marketplace_fee` con la cuenta del mecánico vinculada por OAuth. Futuro. |

**RF-PAY-001: pago simulado del servicio.** Con la solicitud *finalizada* y un monto cargado, el
cliente ve el botón "Pagar servicio".

La pantalla de pago muestra:

- el código de la solicitud, el mecánico y el monto total;
- un medio de pago de prueba, identificado claramente como **simulado**;
- el botón de confirmación.

**RF-PAY-002: registro del pago con comisión.** El pago se registra con una función de la base, nunca
con un cálculo de la app. La función:

- calcula la comisión de la plataforma (10 %) y el neto del mecánico;
- guarda el pago con estado *aprobado*;
- registra el evento en la bitácora;
- no permite pagar dos veces el mismo servicio (RN-013).

### 5.10 Otros módulos

| ID | Requisito | Prioridad |
|---|---|---|
| RF-RATING-001/002 | Calificación del servicio y promedio del mecánico | COULD |
| RF-NOTIF-001 | Avisos dentro de la app (campana) | COULD |
| RF-NOTIF-002 | Notificaciones push | WON'T |
| RF-TRANSFER-001 a 003 | Traslado con mini-tráiler | WON'T |
| RF-SHOP-001 a 005 | Rider Shop | WON'T |
| RF-COMM-001 | Comunidad | WON'T |

### 5.11 Datos, archivos y seguridad

| ID | Requisito | Prioridad | Estado | Descripción |
|---|---|---|---|---|
| RF-DATA-001 | Persistencia real | MUST | ✅ | PostgreSQL. |
| RF-DATA-002 | Estado de sesión compartido | MUST | ✅ | `useSesion` y `RequiereSesion`. |
| RF-DATA-003 | Sesión persistente en el dispositivo | MUST | ✅ | AsyncStorage. |
| RF-DATA-004 | Bitácora de estados | MUST | ✅ | `historial_solicitudes`: estado anterior, estado nuevo, fecha y hora, actor y nota. |
| RF-FILE-001 | Archivos en Storage | MUST | ✅ | `avatars` es público con escritura por carpeta del usuario; `archivos` es privado. |
| RF-SEC-001 | Acceso a datos mediante RLS | MUST | ✅ | Ver detalle abajo. |

**RF-SEC-001.** RLS controla el acceso a los datos:

- un cliente no ve ni modifica servicios ajenos;
- un mecánico solo opera los servicios que tiene asignados;
- los pagos solo los ven el cliente y el mecánico del servicio.

---

## 6. Requisitos no funcionales

| ID | Requisito | Prioridad | Estado | Criterio de aceptación |
|---|---|---|---|---|
| RNF-UX-001 | Sistema de diseño consistente | MUST | 🟡 | Tema en `tailwind.config.js`; los colores para íconos salen de `src/lib/tema.ts`. Pendiente: quitar los hex que quedan en los componentes. |
| RNF-UX-002 | Fidelidad a la maqueta | MUST | ✅ | |
| RNF-UX-003 | Estados de carga, vacío y error | MUST | ✅ | Ninguna pantalla queda en blanco. |
| RNF-UX-004 | Respuesta táctil de los controles | MUST | ✅ | |
| RNF-UX-005 | Legibilidad en exteriores | SHOULD | ✅ | Contraste de 4.5:1 o más y área táctil de 44×44 pt o más. |
| RNF-UX-006 | Teclado que no tapa el campo activo | SHOULD | ✅ | |
| RNF-UX-007 | Accesibilidad | COULD | 🟡 | Etiquetas de accesibilidad en los controles principales. |
| RNF-UX-008 | Flujo de emergencia | SHOULD | ✅ | 60 segundos o menos y 8 interacciones o menos. |
| RNF-PERF-001 | Fluidez de la interfaz | MUST | ✅ | Navegación en 300 ms o menos. |
| RNF-PERF-002 | Arranque | SHOULD | ✅ | Menos de 3 segundos. |
| RNF-COMP-001 | Android | MUST | ✅ | Android 10 o superior, Expo Go y dispositivo físico. |
| RNF-COMP-002 | iOS | SHOULD | 🟡 | Código compatible; no se verificó en un dispositivo. |
| RNF-COMP-003 | Diseño adaptable | MUST | ✅ | Pantallas de 5" a 6.7", respetando las áreas seguras. |
| RNF-SEC-001 | Protección de secretos | MUST | ✅ | Ver detalle abajo. |
| RNF-SEC-002 | Autenticación segura | MUST | ✅ | Supabase Auth; la contraseña nunca se guarda en el dispositivo. |
| RNF-SEC-003 | Autorización por políticas | MUST | ✅ | RLS en todas las tablas con políticas explícitas. |
| RNF-SEC-004 | Seguridad de archivos | MUST | ✅ | Escritura solo en la carpeta propia. |
| RNF-SEC-005 | Montos calculados en el servidor (nuevo v4) | MUST | ⏳ | La comisión y el neto los calcula la base; la app no puede enviarlos ni modificarlos. |
| RNF-MAIN-001 | Control de versiones | MUST | ✅ | `main` siempre ejecutable. |
| RNF-MAIN-002 | Integración por Pull Request con revisión | MUST | ✅ | |
| RNF-MAIN-003 | Modularidad | MUST | ✅ | `/app`, `/components`, `/services`, `/types`, `/data`, `/lib`, `/hooks`. Solo `/services` accede a datos. |
| RNF-MAIN-004 | TypeScript en modo estricto | SHOULD | ✅ | |
| RNF-MAIN-005 | ESLint | SHOULD | ✅ | `expo lint` sin errores. |
| RNF-MAIN-006 | README completo | MUST | 🟡 | Pendiente: integrantes y alcance actualizado. |
| RNF-MAIN-007 | Migraciones versionadas (nuevo v4) | MUST | ✅ | Todo cambio de esquema queda en `supabase/migrations/`. |
| RNF-SCAL-001 | Independencia del origen de datos | MUST | ✅ | La migración de JSON a Supabase solo tocó `/services`. |
| RNF-SCAL-002 | Categorías y especialidades declarativas | SHOULD | ✅ | |
| RNF-REL-001 | Robustez ante datos | MUST | ✅ | Nulos, listas vacías y textos largos. |
| RNF-REL-002 | Manejo de errores de operación | MUST | ✅ | Una operación fallida nunca se informa como exitosa. |
| RNF-REL-003 | Persistencia confiable | MUST | ✅ | |
| RNF-TRACE-001 a 003 | Trazabilidad | MUST | ✅ | Los commits y PR referencian el ID del requisito. |
| RNF-TEST-002 | Datos de prueba | MUST | ✅ | Migración idempotente con mecánicos de ejemplo en distintas ubicaciones y especialidades, incluido uno no disponible. |
| RNF-TEST-003 | Estados determinísticos | MUST | ✅ | `scripts/verificar-supabase.mjs`. |
| RNF-PRIV-001 | Minimización de datos | MUST | ✅ | |
| RNF-PRIV-002 | Protección de la ubicación | MUST | ✅ | El permiso se pide al momento de usarla, explicando el motivo. |
| RNF-AI-001 | Transparencia sobre el uso de IA | SHOULD | ⏳ | Documentar en el README. |
| RNF-AI-002 | Validación humana | MUST | ✅ | |
| RNF-AI-003 | Protección de información | MUST | ✅ | |

**RNF-SEC-001.** Ningún secreto forma parte del repositorio:

- `.env` está en `.gitignore`;
- la clave *publishable* de Supabase es pública por diseño y figura en `.env.example`;
- las claves privadas (`service_role` y el *client secret* de Google) nunca entran al repositorio.

---

## 7. Reglas de negocio

| ID | Regla | Prioridad | Estado |
|---|---|---|---|
| RN-001 | Toda solicitud está asociada a un cliente autenticado. | MUST | ✅ |
| RN-002 | Una solicitud no puede tener dos mecánicos asignados. | MUST | ✅ |
| RN-003 | Un mecánico no disponible no recibe solicitudes nuevas. | MUST | ✅ |
| RN-004 | Los estados respetan el flujo definido. | MUST | ✅ |
| RN-005 | *Finalizado* es terminal. | MUST | ✅ |
| RN-006 | Una venta no supera el stock disponible. | WON'T | — |
| RN-007 | Un servicio no se considera pagado sin un pago aprobado registrado por el servidor. | MUST (modificado v4) | ⏳ |
| RN-008 | Los datos de un servicio son visibles solo para sus actores. | MUST | ✅ |
| RN-009 | Solo se cancela antes de *trabajando*. | MUST | ✅ |
| RN-010 | Un cliente tiene como máximo una solicitud activa. | MUST | ✅ |
| RN-011 | Solo el cliente califica, y solo un servicio finalizado. | COULD | — |
| RN-012 | La comisión es el 10 % del monto final; el neto del mecánico es el 90 %. Se redondea a 2 decimales y la comisión absorbe la diferencia (nuevo v4). | MUST | ⏳ |
| RN-013 | Solo se paga un servicio *finalizado* con monto cargado, y una única vez (nuevo v4). | MUST | ⏳ |
| RN-014 | Solo el mecánico asignado carga el monto final, y solo al finalizar (nuevo v4). | MUST | ⏳ |
| RN-015 | Una cuenta creada con Google tiene el rol cliente (nuevo v4). | MUST | ⏳ |

---

## 8. Modelo de datos

**Tablas existentes:**

- `perfiles`
- `mecanicos`
- `categorias_averia`
- `solicitudes`
- `historial_solicitudes`

**Cambios previstos:**

- `solicitudes.monto_final numeric(12,2)`: el monto del servicio, que se carga al finalizar.
- Tabla `pagos`: `id`, `solicitud_id` (único), `cliente_id`, `mecanico_id`, `monto`, `comision`,
  `neto_mecanico`, `medio` (`'simulado'`), `estado` (`'aprobado'`) y `creado_en`. Con RLS: la ven
  solo el cliente y el mecánico del servicio.
- Función `registrar_pago(p_solicitud_id)`: valida RN-013, calcula RN-012 e inserta el pago (es
  `security definer`).
- `cambiar_estado_solicitud` exige el monto final para pasar a *finalizado* (RN-014).
- Trigger `crear_perfil_usuario` (RN-015):
  - toma el nombre de `full_name` o `name` y la foto de `avatar_url`;
  - asigna el rol cliente cuando el usuario viene de Google.

---

## 9. Recorridos de verificación

| # | Recorrido | Prioridad |
|---|---|---|
| 1 | Login con correo → Inicio → cerrar sesión → Login | MUST |
| 2 | Login → **Continuar con Google** → Inicio con nombre y foto de Google | MUST |
| 3 | Registro de cliente y de mecánico → Login con la cuenta nueva | MUST |
| 4 | Cliente: SOS → 4 pasos con GPS → Confirmada → Seguimiento en *pendiente* | MUST |
| 5 | Mecánico: Disponibles → Aceptar con ETA → En camino → Llegué → Trabajando → Finalizado con monto. El cliente ve cada cambio en tiempo real. | MUST |
| 6 | Cliente: Seguimiento finalizado → Pagar servicio → pago simulado → "Pagado" | MUST |
| 7 | Mecánico: Mis ganancias muestra el neto del servicio pagado (90 %) | SHOULD |
| 8 | Cliente: cancelar una solicitud antes de *trabajando* → queda *cancelada* con el motivo | MUST |
| 9 | Perfil → Editar perfil → guardar → Perfil actualizado; cambiar la foto | MUST |
| 10 | Inicio → Mecánicos cerca tuyo → Ver perfil → volver | SHOULD |

---

## 10. Criterio de aceptación global

La entrega final es conforme cuando:

1. Todos los requisitos **MUST** están en ✅.
2. Los recorridos MUST se completan sin errores en Android.
3. `npx tsc --noEmit` y `npx expo lint` terminan sin errores.
4. No hay colores ni medidas escritos a mano en los componentes.
5. Ningún secreto privado está versionado.
6. El README declara el alcance, la instalación, la estructura y los integrantes.
7. Todo cambio entró a `main` mediante un Pull Request revisado.

---

## 11. Registro de cambios

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0 | — | Baseline inicial, con stack Firebase. |
| 2.0 | Sep. 2026 | Migración a Expo + NativeWind + Supabase. Priorización MoSCoW. |
| 3.0 | Sep. 2026 | Entrega 1 como MVP de interfaz. Familia RF-VIEW. |
| 4.0 | Oct. 2026 | Ver detalle abajo. |

**Cambios de la versión 4.0:**

- Se eliminan las entregas por etapas: la MoSCoW pasa a referirse a la entrega final, y la
  funcionalidad que en la v3.0 era WON'T pasa a MUST.
- Se agregan el estado de implementación y el modelo de negocio (comisión del 10 % con cobro
  centralizado).
- Requisitos nuevos:
  - RF-AUTH-007 (Google solo para clientes);
  - RF-QUOTE-001 modificado a monto final;
  - RF-PAY-001 a 006 (pago simulado; Mercado Pago como futuro);
  - RF-VIEW-013 a 015;
  - RF-PROF-007;
  - RNF-SEC-005;
  - RNF-MAIN-007;
  - RN-012 a RN-015.
- RF-VIEW-001 queda reemplazado por el conmutador del registro.
