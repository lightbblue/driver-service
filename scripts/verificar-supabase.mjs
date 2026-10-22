// Verifica que la migración de solicitudes esté aplicada. Solo hace lecturas.
// Uso: node --env-file=.env scripts/verificar-supabase.mjs

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!URL || !KEY) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_KEY (usá --env-file=.env).');
  process.exit(1);
}

const pedir = (ruta, init = {}) =>
  fetch(`${URL}/rest/v1/${ruta}`, {
    ...init,
    headers: { apikey: KEY, 'Content-Type': 'application/json', ...init.headers },
  });

/** 200 = la columna existe; 42703 = no existe; 401/42501 = existe pero anon no puede leerla. */
async function existeColumna(tabla, columna) {
  const r = await pedir(`${tabla}?select=${columna}&limit=0`);
  if (r.ok) return true;
  const { code } = await r.json();
  return code === '42501';
}

const chequeos = [];
const chequear = (descripcion, ok) => chequeos.push({ descripcion, ok });

const columnas = {
  solicitudes: ['localidad', 'eta_minutos', 'motivo_cancelacion', 'cancelado_por', 'actualizado_en'],
  historial_solicitudes: ['estado_anterior', 'observacion', 'usuario_id'],
  mecanicos: ['usuario_id'],
};

for (const [tabla, lista] of Object.entries(columnas)) {
  for (const columna of lista) {
    chequear(`columna ${tabla}.${columna}`, await existeColumna(tabla, columna));
  }
}

// La función existe y rechaza a anon (404 significaría que no se creó).
const rpc = await pedir('rpc/cambiar_estado_solicitud', {
  method: 'POST',
  body: JSON.stringify({ p_solicitud_id: '00000000-0000-0000-0000-000000000000', p_estado: 'aceptado' }),
});
chequear('función cambiar_estado_solicitud creada', rpc.status !== 404);
chequear('anon no puede ejecutar cambiar_estado_solicitud', rpc.status === 401 || rpc.status === 403);

// Anon no puede leer solicitudes ni el historial.
for (const tabla of ['solicitudes', 'historial_solicitudes']) {
  const r = await pedir(`${tabla}?select=id&limit=1`);
  const filas = r.ok ? await r.json() : [];
  chequear(`anon no lee ${tabla}`, !r.ok || filas.length === 0);
}

// Las categorías siguen siendo públicas.
const categorias = await pedir('categorias_averia?select=id');
chequear('categorías visibles', categorias.ok && (await categorias.json()).length > 0);

for (const { descripcion, ok } of chequeos) console.log(`${ok ? '✔' : '✘'} ${descripcion}`);
const fallidos = chequeos.filter((c) => !c.ok).length;
console.log(fallidos ? `\n${fallidos} chequeo(s) fallaron.` : '\nTodo en orden.');
process.exit(fallidos ? 1 : 0);
