-- =============================================================================
-- B01: Monto final al finalizar el servicio (RF-STATE-005, RF-QUOTE-001)
-- Reglas de negocio: RN-004, RN-005, RN-014
-- Casos de prueba: CP-EST-01..05, CP-DB-05, CP-DB-06, CP-DB-12, CP-DB-13
--
-- Agrega monto_final a solicitudes y actualiza cambiar_estado_solicitud() para
-- exigir un monto en pesos mayor a cero al pasar a 'finalizado'.
-- =============================================================================

begin;

-- 1. Columna monto_final (numeric(12,2)) en solicitudes
alter table public.solicitudes
  add column if not exists monto_final numeric(12,2);

-- Restricción: si se define un monto, debe ser estrictamente positivo
alter table public.solicitudes
  drop constraint if exists solicitudes_monto_final_check;

alter table public.solicitudes
  add constraint solicitudes_monto_final_check
  check (monto_final is null or monto_final > 0);

-- 2. Eliminar firma anterior de cambiar_estado_solicitud para evitar colisión de sobrecarga
drop function if exists public.cambiar_estado_solicitud(uuid, text, text, integer);

-- 3. Nueva definición de cambiar_estado_solicitud con p_monto_final
create or replace function public.cambiar_estado_solicitud(
  p_solicitud_id uuid,
  p_estado       text,
  p_nota         text    default null,
  p_eta_minutos  integer default null,
  p_monto_final  numeric default null
)
returns public.solicitudes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitud   public.solicitudes;
  v_nota        text := nullif(btrim(coalesce(p_nota, '')), '');
  v_es_cliente  boolean;
  v_es_asignado boolean;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión para continuar.' using errcode = 'P0001';
  end if;

  perform set_config('rider.nota', coalesce(v_nota, ''), true);

  if p_estado = 'aceptado' then
    return public.aceptar_solicitud(p_solicitud_id, p_eta_minutos);
  end if;

  select * into v_solicitud from public.solicitudes where id = p_solicitud_id for update;
  if v_solicitud.id is null then
    raise exception 'La solicitud no existe.' using errcode = 'P0001';
  end if;

  -- RN-005: finalizado es terminal
  if v_solicitud.estado = 'finalizado' then
    raise exception 'No se puede modificar un servicio que ya está finalizado.' using errcode = 'P0001';
  end if;

  v_es_cliente  := coalesce(v_solicitud.usuario_id = auth.uid(), false);
  v_es_asignado := coalesce(v_solicitud.mecanico_id = public.mecanico_id_actual(), false);

  if p_estado = 'cancelada' then
    if not (v_es_cliente or v_es_asignado) then
      raise exception 'No tenés permiso para cancelar esta solicitud.' using errcode = 'P0001';
    end if;
    if v_nota is null and v_solicitud.mecanico_id is not null then
      raise exception 'Indicá el motivo de la cancelación.' using errcode = 'P0001';
    end if;

    update public.solicitudes
       set estado = 'cancelada', motivo_cancelacion = v_nota, eta_minutos = null
     where id = p_solicitud_id
    returning * into v_solicitud;
    return v_solicitud;
  end if;

  -- RF-STATE-002..005: solo el mecánico asignado opera el servicio (RN-014, CP-DB-12)
  if not v_es_asignado then
    raise exception 'Solo el mecánico asignado puede actualizar el servicio.' using errcode = 'P0001';
  end if;

  -- RN-014 / RF-QUOTE-001: al pasar a finalizado, el monto debe ser mayor a cero (CP-EST-03, CP-DB-13)
  if p_estado = 'finalizado' then
    if p_monto_final is null or p_monto_final <= 0 then
      raise exception 'El monto final debe ser mayor a cero.' using errcode = 'P0001';
    end if;
  else
    if p_monto_final is not null then
      raise exception 'Solo se puede cargar el monto final al finalizar el servicio.' using errcode = 'P0001';
    end if;
  end if;

  update public.solicitudes
     set estado      = p_estado,
         eta_minutos = case when p_estado = 'en_camino' then coalesce(p_eta_minutos, eta_minutos) end,
         monto_final = case when p_estado = 'finalizado' then round(p_monto_final, 2) else monto_final end
   where id = p_solicitud_id
  returning * into v_solicitud;

  return v_solicitud;
end;
$$;

revoke all on function public.cambiar_estado_solicitud(uuid, text, text, integer, numeric) from public, anon;
grant execute on function public.cambiar_estado_solicitud(uuid, text, text, integer, numeric) to authenticated;

commit;

notify pgrst, 'reload schema';

