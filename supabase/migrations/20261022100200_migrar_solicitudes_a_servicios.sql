-- =============================================================================
-- Migración de datos: solicitudes / historial_solicitudes → servicios / servicio_estados
--
-- Antes del modelo de datos, la app guardaba las solicitudes en `solicitudes`
-- (estado 'pendiente') y su historial en `historial_solicitudes`. Esta migración
-- copia esas filas al modelo conservando el id de cada solicitud.
--
-- - Se omiten las filas sin coordenadas o cuyo usuario ya no existe.
-- - RN-010: si un cliente tenía varias solicitudes activas, queda activa la más
--   reciente y las demás pasan a 'cancelada' con el motivo indicado abajo.
-- - Las tablas viejas NO se borran (ver el final del archivo).
--
-- Requiere las etapas 2.1 y 2.2. Es idempotente.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.solicitudes') is null then
    raise notice 'No existe la tabla solicitudes: no hay datos que migrar.';
    return;
  end if;

  -- Durante la copia el historial se importa tal cual, sin el registro automático del alta.
  alter table public.servicios disable trigger trg_estado_inicial;

  with origen as (
    select s.*,
           case lower(coalesce(s.estado, ''))
             when 'aceptado'   then 'aceptado'
             when 'aceptada'   then 'aceptado'
             when 'en_camino'  then 'en_camino'
             when 'llegue'     then 'llegue'
             when 'trabajando' then 'trabajando'
             when 'en_proceso' then 'trabajando'
             when 'finalizado' then 'finalizado'
             when 'finalizada' then 'finalizado'
             when 'completada' then 'finalizado'
             when 'cancelada'  then 'cancelada'
             when 'cancelado'  then 'cancelada'
             else 'solicitado'
           end::public.estado_servicio as estado_mapeado
    from public.solicitudes s
    where s.latitud is not null
      and s.longitud is not null
      and exists (select 1 from public.perfiles p where p.id = s.usuario_id)
      and not exists (select 1 from public.servicios x where x.id = s.id)
  ),
  ordenado as (
    select o.*,
           row_number() over (
             partition by o.usuario_id,
                          (o.estado_mapeado in ('solicitado', 'aceptado', 'en_camino', 'llegue', 'trabajando'))
             order by o.creado_en desc
           ) as orden_cliente,
           row_number() over (
             partition by o.mecanico_id,
                          (o.estado_mapeado in ('aceptado', 'en_camino', 'llegue', 'trabajando'))
             order by o.creado_en desc
           ) as orden_mecanico
    from origen o
  ),
  final as (
    select o.*,
           case
             when o.estado_mapeado in ('solicitado', 'aceptado', 'en_camino', 'llegue', 'trabajando')
              and (o.orden_cliente > 1
                   or exists (select 1 from public.servicios x
                              where x.cliente_id = o.usuario_id
                                and x.estado in ('solicitado', 'aceptado', 'en_camino', 'llegue', 'trabajando')))
               then true
             when o.mecanico_id is not null
              and o.estado_mapeado in ('aceptado', 'en_camino', 'llegue', 'trabajando')
              and (o.orden_mecanico > 1
                   or exists (select 1 from public.servicios x
                              where x.mecanico_id = o.mecanico_id
                                and x.estado in ('aceptado', 'en_camino', 'llegue', 'trabajando')))
               then true
             else false
           end as cerrar
    from ordenado o
  )
  insert into public.servicios (
    id, cliente_id, mecanico_id, categoria_id, descripcion,
    latitud, longitud, direccion, estado,
    creado_en, aceptado_en, finalizado_en, cancelado_en, motivo_cancelacion, actualizado_en
  )
  select
    f.id,
    f.usuario_id,
    m.id,
    coalesce(f.categoria_id, (select id from public.categorias_averia where codigo = 'OTRO')),
    left(f.descripcion, 200),
    round(f.latitud::numeric, 6),
    round(f.longitud::numeric, 6),
    coalesce(nullif(btrim(f.direccion), ''), round(f.latitud::numeric, 6) || ', ' || round(f.longitud::numeric, 6)),
    case when f.cerrar then 'cancelada' else f.estado_mapeado end,
    f.creado_en,
    case when m.id is not null then f.creado_en end,
    case when not f.cerrar and f.estado_mapeado = 'finalizado' then f.creado_en end,
    case when f.cerrar or f.estado_mapeado = 'cancelada' then f.creado_en end,
    case when f.cerrar then 'Cerrada al migrar: el cliente o el mecánico tenía otra solicitud activa (RN-010)' end,
    f.creado_en
  from final f
  left join public.mecanicos m on m.id = f.mecanico_id;

  -- Historial previo, con el estado anterior reconstruido.
  if to_regclass('public.historial_solicitudes') is not null then
    insert into public.servicio_estados (servicio_id, estado_anterior, estado_nuevo, ocurrido_en, observacion)
    select h.solicitud_id,
           lag(h.estado_mapeado) over (partition by h.solicitud_id order by h.creado_en),
           h.estado_mapeado,
           h.creado_en,
           'Importado de historial_solicitudes'
    from (
      select hs.solicitud_id, hs.creado_en,
             case lower(coalesce(hs.estado, ''))
               when 'aceptado' then 'aceptado'  when 'aceptada'   then 'aceptado'
               when 'en_camino' then 'en_camino' when 'llegue'    then 'llegue'
               when 'trabajando' then 'trabajando' when 'en_proceso' then 'trabajando'
               when 'finalizado' then 'finalizado' when 'finalizada' then 'finalizado'
               when 'completada' then 'finalizado'
               when 'cancelada' then 'cancelada' when 'cancelado' then 'cancelada'
               else 'solicitado'
             end::public.estado_servicio as estado_mapeado
      from public.historial_solicitudes hs
      join public.servicios sv on sv.id = hs.solicitud_id
      where not exists (select 1 from public.servicio_estados e where e.servicio_id = hs.solicitud_id)
    ) h;
  end if;

  -- Servicios sin historial: se registra el alta y, si corresponde, el estado actual.
  insert into public.servicio_estados (servicio_id, estado_anterior, estado_nuevo, actor_id, ocurrido_en, observacion)
  select sv.id, null, 'solicitado', sv.cliente_id, sv.creado_en, 'Importado de solicitudes'
  from public.servicios sv
  where not exists (select 1 from public.servicio_estados e where e.servicio_id = sv.id);

  insert into public.servicio_estados (servicio_id, estado_anterior, estado_nuevo, ocurrido_en, observacion)
  select sv.id, 'solicitado', sv.estado, sv.actualizado_en, coalesce(sv.motivo_cancelacion, 'Importado de solicitudes')
  from public.servicios sv
  where sv.estado <> 'solicitado'
    and not exists (select 1 from public.servicio_estados e
                    where e.servicio_id = sv.id and e.estado_nuevo = sv.estado);

  alter table public.servicios enable trigger trg_estado_inicial;
end $$;

commit;

-- Las tablas viejas quedan como respaldo. Una vez comprobada la migración, se
-- pueden eliminar desde el SQL Editor:
--
--   drop table public.historial_solicitudes;
--   drop table public.solicitudes;
