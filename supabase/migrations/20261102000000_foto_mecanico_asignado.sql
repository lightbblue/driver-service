-- Cada parte ve a la otra en el seguimiento: el cliente, la foto de su mecánico;
-- el mecánico, el nombre, la foto y el teléfono del cliente.
-- Foto del mecánico en el seguimiento del cliente.
-- `perfiles` solo deja leer el propio perfil (RLS), así que esta función devuelve la foto
-- del mecánico únicamente al cliente que tiene una solicitud atendida por él.

create or replace function public.foto_mecanico_asignado(p_mecanico_id uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.avatar_url
    from public.mecanicos m
    join public.perfiles p on p.id = m.usuario_id
   where m.id = p_mecanico_id
     and exists (
       select 1 from public.solicitudes s
        where s.mecanico_id = m.id and s.usuario_id = auth.uid()
     );
$$;

revoke execute on function public.foto_mecanico_asignado(uuid) from public, anon;
grant execute on function public.foto_mecanico_asignado(uuid) to authenticated;

-- Cliente que pidió cada solicitud, para el mecánico (bandeja y seguimiento).
-- Lo ve el mecánico asignado, o un mecánico disponible que puede tomar la solicitud pendiente.
-- El teléfono va solo al mecánico asignado: antes de aceptar no hace falta.
create or replace function public.clientes_de_solicitudes(p_solicitudes uuid[])
returns table (solicitud_id uuid, nombre text, avatar_url text, telefono text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.id,
         coalesce(nullif(btrim(p.nombre), ''), 'Cliente'),
         p.avatar_url,
         case when s.mecanico_id = public.mecanico_id_actual() then p.telefono end
    from public.solicitudes s
    join public.perfiles p on p.id = s.usuario_id
   where s.id = any (p_solicitudes)
     and (
       s.mecanico_id = public.mecanico_id_actual()
       or (
         s.estado = 'pendiente'
         and s.mecanico_id is null
         and exists (select 1 from public.mecanicos where usuario_id = auth.uid() and disponible)
         and public.es_destinatario_solicitud(s.taller_solicitado_id, s.mecanico_solicitado_id)
       )
     );
$$;

revoke execute on function public.clientes_de_solicitudes(uuid[]) from public, anon;
grant execute on function public.clientes_de_solicitudes(uuid[]) to authenticated;

notify pgrst, 'reload schema';
