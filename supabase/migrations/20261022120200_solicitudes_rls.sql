-- =============================================================================
-- REQ-01 — Seguridad de solicitudes (RF-SEC-001, RN-001, RN-008, RNF-SEC-003)
--
-- Se eliminan las políticas previas de `solicitudes` e `historial_solicitudes`
-- para que no quede ninguna permisiva que abra lo que estas cierran.
-- `categorias_averia` y `perfiles` no se tocan.
--
-- Requiere 20261022120100_solicitudes_estados.sql. Es idempotente.
-- =============================================================================

begin;

do $$
declare
  r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('solicitudes', 'historial_solicitudes')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.solicitudes           enable row level security;
alter table public.historial_solicitudes enable row level security;

-- El cliente solo carga los datos de su pedido: código, estado, mecánico y
-- montos los pone la base. Nadie actualiza ni borra de forma directa: los
-- cambios pasan por cambiar_estado_solicitud().
revoke all on public.solicitudes, public.historial_solicitudes from anon;
revoke insert, update, delete on public.solicitudes from authenticated;
revoke insert, update, delete on public.historial_solicitudes from authenticated;
grant select on public.solicitudes, public.historial_solicitudes to authenticated;
grant insert (usuario_id, categoria_id, descripcion, direccion, latitud, longitud)
  on public.solicitudes to authenticated;

-- RN-008: la ven el cliente y el mecánico asignado.
create policy "solicitudes: cliente o mecánico asignado"
  on public.solicitudes for select to authenticated
  using (usuario_id = auth.uid() or mecanico_id = public.mecanico_id_actual());

-- RF-MATCH-001 / RN-003: las pendientes sin asignar, solo para mecánicos disponibles.
create policy "solicitudes: pendientes para mecánicos disponibles"
  on public.solicitudes for select to authenticated
  using (
    estado = 'pendiente'
    and mecanico_id is null
    and exists (select 1 from public.mecanicos where usuario_id = auth.uid() and disponible)
  );

-- RN-001: toda solicitud pertenece a un cliente autenticado, que solo crea las suyas.
create policy "solicitudes: alta del cliente"
  on public.solicitudes for insert to authenticated
  with check (usuario_id = auth.uid());

create policy "historial: participantes de la solicitud"
  on public.historial_solicitudes for select to authenticated
  using (public.participa_en_solicitud(solicitud_id));

-- Nombre y teléfono del mecánico asignado, para el seguimiento (RF-TRACK-003).
-- Solo tiene efecto si `mecanicos` tiene RLS habilitado.
drop policy if exists "mecanicos: lectura autenticados" on public.mecanicos;
create policy "mecanicos: lectura autenticados"
  on public.mecanicos for select to authenticated
  using (true);

-- Realtime: el cliente ve al instante cuando el mecánico acepta o sale en camino.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'solicitudes') then
    alter publication supabase_realtime add table public.solicitudes;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'historial_solicitudes') then
    alter publication supabase_realtime add table public.historial_solicitudes;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
