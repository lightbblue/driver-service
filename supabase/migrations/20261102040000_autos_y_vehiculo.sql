-- La app es para autos y motos.
-- - Especialidad "Autos" en el catálogo de tags.
-- - La solicitud guarda el vehículo: tipo (auto o moto) y modelo. El mecánico lo ve antes de aceptar.
-- - Textos de categorías y avisos que hablaban solo de motos.

begin;

insert into public.especialidades (nombre, orden) values ('Autos', 2)
on conflict (nombre) do nothing;

alter table public.solicitudes
  add column if not exists tipo_vehiculo text check (tipo_vehiculo is null or tipo_vehiculo in ('auto', 'moto')),
  add column if not exists vehiculo_modelo text check (vehiculo_modelo is null or char_length(vehiculo_modelo) <= 60);

comment on column public.solicitudes.tipo_vehiculo is 'Auto o moto: lo indica el cliente al pedir.';
comment on column public.solicitudes.vehiculo_modelo is 'Marca y modelo del vehículo (ej: Ford Fiesta 2015).';

grant insert (tipo_vehiculo, vehiculo_modelo) on public.solicitudes to authenticated;

update public.categorias_averia set descripcion = 'El vehículo no enciende' where nombre = 'Problemas de arranque';
update public.categorias_averia set descripcion = 'El vehículo anda mal o hace ruidos extraños' where nombre = 'Falla mecánica';

-- Mismo aviso de cambio de estado, sin hablar solo de motos.
create or replace function public.fn_notificar_cambio_estado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_titulo text;
  v_cuerpo text;
begin
  if new.estado is not distinct from old.estado then
    return new;
  end if;

  case new.estado
    when 'en_camino' then
      v_titulo := 'Un mecánico va en camino';
      v_cuerpo := case when new.eta_minutos is not null
                       then 'Llega en aproximadamente ' || new.eta_minutos || ' min.'
                       else 'Aceptó tu solicitud y salió hacia tu ubicación.' end;
    when 'trabajando' then
      v_titulo := 'El mecánico llegó';
      v_cuerpo := 'Ya está trabajando en tu vehículo.';
    when 'finalizado' then
      v_titulo := 'Servicio finalizado';
      v_cuerpo := 'Contanos cómo te fue: calificá al mecánico.';
    when 'no_resuelta' then
      v_titulo := 'No se pudo resolver';
      v_cuerpo := coalesce(new.motivo_no_resuelta, 'El mecánico no pudo resolver el problema.') || ' Se te devuelve el pago.';
    when 'cancelada' then
      if auth.uid() is not distinct from new.usuario_id then
        return new;
      end if;
      v_titulo := 'El mecánico canceló la solicitud';
      v_cuerpo := coalesce(new.motivo_cancelacion, 'Sin motivo indicado.') || ' Podés pedir asistencia de nuevo.';
    else
      return new;
  end case;

  insert into public.notificaciones (usuario_id, titulo, cuerpo, solicitud_id)
  values (new.usuario_id, v_titulo, v_cuerpo, new.id);

  return new;
end;
$function$;

revoke execute on function public.fn_notificar_cambio_estado() from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
