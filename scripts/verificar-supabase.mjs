// Verifica que las migraciones de las etapas 2.1 y 2.2 estén aplicadas. Solo hace lecturas.
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
  perfiles: ['nombre_completo', 'email', 'rol', 'localidad', 'eliminado_en'],
  mecanicos: ['perfil_id', 'nombre_taller', 'direccion_taller', 'radio_cobertura_km', 'calificacion_promedio'],
  especialidades: ['codigo', 'nombre'],
  categorias_averia: ['codigo', 'requiere_foto', 'activo', 'orden'],
  servicios: ['codigo', 'cliente_id', 'mecanico_id', 'estado', 'eta_minutos', 'referencia',
              'aceptado_en', 'en_camino_en', 'llegada_en', 'inicio_trabajo_en', 'finalizado_en',
              'cancelado_en', 'motivo_cancelacion'],
  servicio_estados: ['estado_anterior', 'estado_nuevo', 'actor_id', 'observacion', 'ocurrido_en'],
};

for (const [tabla, lista] of Object.entries(columnas)) {
  for (const columna of lista) {
    chequear(`columna ${tabla}.${columna}`, await existeColumna(tabla, columna));
  }
}

// Las funciones existen y rechazan a anon (404 significaría que no se crearon).
for (const [funcion, cuerpo] of [
  ['cambiar_estado_servicio', { p_servicio_id: '00000000-0000-0000-0000-000000000000', p_estado: 'aceptado' }],
  ['aceptar_servicio', { p_servicio_id: '00000000-0000-0000-0000-000000000000' }],
  ['mecanico_id_actual', {}],
]) {
  const r = await pedir(`rpc/${funcion}`, { method: 'POST', body: JSON.stringify(cuerpo) });
  chequear(`función ${funcion} creada`, r.status !== 404);
  chequear(`anon no puede ejecutar ${funcion}`, r.status === 401 || r.status === 403);
}

// Anon no puede leer datos de usuarios ni servicios.
for (const tabla of ['servicios', 'servicio_estados', 'perfiles', 'mecanicos']) {
  const r = await pedir(`${tabla}?select=id&limit=1`);
  const filas = r.ok ? await r.json() : [];
  chequear(`anon no lee ${tabla}`, !r.ok || filas.length === 0);
}

// El catálogo de categorías sigue siendo público y tiene código.
const categorias = await pedir('categorias_averia?select=codigo&activo=eq.true');
const lista = categorias.ok ? await categorias.json() : [];
chequear('categorías visibles con código', lista.length > 0 && lista.every((c) => c.codigo));

for (const { descripcion, ok } of chequeos) console.log(`${ok ? '✔' : '✘'} ${descripcion}`);
const fallidos = chequeos.filter((c) => !c.ok).length;
console.log(fallidos ? `\n${fallidos} chequeo(s) fallaron.` : '\nTodo en orden.');
process.exit(fallidos ? 1 : 0);
