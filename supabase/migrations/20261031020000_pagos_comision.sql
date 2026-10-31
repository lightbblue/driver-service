-- =============================================================================
-- REQ: B01, B02, A01 y F04 (Base de Datos)
--
-- RF-QUOTE-001, RF-QUOTE-002, RF-PAY-001, RF-PAY-002, RF-PAY-003, RF-SEC-001,
-- RF-AUTH-007, RF-PROF-003, RN-003, RN-007, RN-012, RN-013, RN-014, RN-015,
-- RNF-SEC-005
--
-- Cumple con los casos de prueba:
-- CP-DB-11, CP-DB-12, CP-DB-13, CP-DB-14, CP-DB-15, CP-DB-16, CP-DB-17,
-- CP-DB-18, CP-DB-19, CP-DB-20, CP-DB-21, CP-GOO-03, CP-DIS-01, CP-DIS-02.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. B01: Monto final en solicitudes (RF-QUOTE-001, RN-014)
-- -----------------------------------------------------------------------------

alter table public.solicitudes
  add column if not exists monto_final numeric(12,2);

alter table public.solicitudes
  drop constraint if exists solicitudes_monto_final_check;

alter table public.solicitudes
  add constraint solicitudes_monto_final_check
    check (monto_final is null or monto_final > 0);

-- Actualizar cambiar_estado_solicitud para admitir y exigir monto_final al finalizar
-- (RN-014: Solo el mecánico asignado carga el monto final, y solo al finalizar).

drop function if exists public.cambiar_estado_solicitud(uuid, text, text, integer);

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

  v_es_cliente  := coalesce(v_solicitud.usuario_id = auth.uid(), false);
  v_es_asignado := coalesce(v_solicitud.mecanico_id = public.mecanico_id_actual(), false);

  -- RN-014: Ni el cliente ni un mecánico no asignado pueden cargar monto_final (CP-DB-12)
  if p_monto_final is not null and not v_es_asignado then
    raise exception 'Solo el mecánico asignado puede cargar el monto final.' using errcode = 'P0001';
  end if;

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

  -- RF-STATE-002..005: solo el mecánico asignado opera el servicio.
  if not v_es_asignado then
    raise exception 'Solo el mecánico asignado puede actualizar el servicio.' using errcode = 'P0001';
  end if;

  -- RN-014 / CP-DB-13: Finalizar requiere monto final mayor que cero
  if p_estado = 'finalizado' then
    if p_monto_final is null or p_monto_final <= 0 then
      raise exception 'El monto final debe ser mayor a cero para finalizar el servicio.' using errcode = 'P0001';
    end if;
  else
    -- No se puede cargar monto en estados previos a finalizado
    if p_monto_final is not null then
      raise exception 'Solo se puede cargar el monto final al finalizar el servicio.' using errcode = 'P0001';
    end if;
  end if;

  update public.solicitudes
     set estado      = p_estado,
         eta_minutos = case when p_estado = 'en_camino' then coalesce(p_eta_minutos, eta_minutos) else eta_minutos end,
         monto_final = case when p_estado = 'finalizado' then p_monto_final else monto_final end
   where id = p_solicitud_id
  returning * into v_solicitud;

  return v_solicitud;
end;
$$;

revoke all on function public.cambiar_estado_solicitud(uuid, text, text, integer, numeric) from public, anon;
grant execute on function public.cambiar_estado_solicitud(uuid, text, text, integer, numeric) to authenticated;


-- -----------------------------------------------------------------------------
-- 2. B02: Tabla pagos (RF-PAY-002, RN-007, RN-013, RNF-SEC-005)
-- -----------------------------------------------------------------------------

create table if not exists public.pagos (
  id            uuid primary key default gen_random_uuid(),
  solicitud_id  uuid not null references public.solicitudes(id) on delete restrict,
  cliente_id    uuid not null references auth.users(id) on delete restrict,
  mecanico_id   uuid not null references public.mecanicos(id) on delete restrict,
  monto         numeric(12,2) not null check (monto > 0),
  comision      numeric(12,2) not null check (comision >= 0),
  neto_mecanico numeric(12,2) not null check (neto_mecanico >= 0),
  medio         text not null default 'simulado' check (medio in ('simulado')),
  estado        text not null default 'aprobado' check (estado in ('aprobado')),
  creado_en     timestamptz not null default now(),
  constraint pagos_solicitud_id_key unique (solicitud_id),
  constraint pagos_monto_suma_check check (monto = comision + neto_mecanico)
);

create index if not exists pagos_solicitud_idx on public.pagos (solicitud_id);
create index if not exists pagos_cliente_idx   on public.pagos (cliente_id, creado_en desc);
create index if not exists pagos_mecanico_idx  on public.pagos (mecanico_id, creado_en desc);

-- RLS y permisos para la tabla pagos (CP-DB-14, CP-DB-20)
alter table public.pagos enable row level security;

revoke all on public.pagos from anon;
revoke insert, update, delete on public.pagos from authenticated;
grant select on public.pagos to authenticated;

drop policy if exists "pagos: cliente o mecánico del servicio" on public.pagos;
create policy "pagos: cliente o mecánico del servicio"
  on public.pagos for select to authenticated
  using (
    cliente_id = auth.uid()
    or mecanico_id = public.mecanico_id_actual()
  );


-- -----------------------------------------------------------------------------
-- 3. B02: Función registrar_pago (RF-PAY-002, RN-012, RN-013, RNF-SEC-005)
-- -----------------------------------------------------------------------------

create or replace function public.registrar_pago(p_solicitud_id uuid)
returns public.pagos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitud   public.solicitudes;
  v_pago        public.pagos;
  v_neto        numeric(12,2);
  v_comision    numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión para registrar el pago.' using errcode = 'P0001';
  end if;

  select * into v_solicitud from public.solicitudes where id = p_solicitud_id for update;
  if v_solicitud.id is null then
    raise exception 'La solicitud no existe.' using errcode = 'P0001';
  end if;

  -- CP-DB-17: Solo el cliente de la solicitud puede registrar el pago
  if v_solicitud.usuario_id <> auth.uid() then
    raise exception 'No tenés permiso para pagar esta solicitud.' using errcode = 'P0001';
  end if;

  -- RN-013 / CP-DB-15: Solo se paga un servicio finalizado con monto cargado
  if v_solicitud.estado <> 'finalizado' then
    raise exception 'Solo se puede pagar un servicio finalizado.' using errcode = 'P0001';
  end if;

  if v_solicitud.monto_final is null or v_solicitud.monto_final <= 0 then
    raise exception 'El servicio no tiene un monto final cargado.' using errcode = 'P0001';
  end if;

  -- RN-013 / CP-DB-16: Solo una única vez
  if exists (select 1 from public.pagos where solicitud_id = p_solicitud_id) then
    raise exception 'El servicio ya fue pagado.' using errcode = 'P0001';
  end if;

  if v_solicitud.mecanico_id is null then
    raise exception 'La solicitud no tiene mecánico asignado.' using errcode = 'P0001';
  end if;

  -- RN-012 / CP-DB-18: 90% neto mecánico redondeado a 2 decimales;
  -- la comisión (10%) absorbe la diferencia.
  v_neto := round(v_solicitud.monto_final * 0.90, 2);
  v_comision := v_solicitud.monto_final - v_neto;

  insert into public.pagos (
    solicitud_id,
    cliente_id,
    mecanico_id,
    monto,
    comision,
    neto_mecanico,
    medio,
    estado
  )
  values (
    v_solicitud.id,
    v_solicitud.usuario_id,
    v_solicitud.mecanico_id,
    v_solicitud.monto_final,
    v_comision,
    v_neto,
    'simulado',
    'aprobado'
  )
  returning * into v_pago;

  -- RF-PAY-002 / CP-PAG-09: Registra el evento en la bitácora
  insert into public.historial_solicitudes (
    solicitud_id,
    estado_anterior,
    estado,
    nota,
    usuario_id
  )
  values (
    v_solicitud.id,
    'finalizado',
    'finalizado',
    'Pago confirmado por $' || trim(to_char(v_solicitud.monto_final, 'FM999999990.00')),
    auth.uid()
  );

  return v_pago;
end;
$$;

revoke all on function public.registrar_pago(uuid) from public, anon;
grant execute on function public.registrar_pago(uuid) to authenticated;

-- Realtime para pagos
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pagos') then
    alter publication supabase_realtime add table public.pagos;
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 4. A01: Trigger de creación de perfil para Google OAuth (RF-AUTH-007, RN-015)
-- (CP-GOO-03, CP-DB-21)
-- -----------------------------------------------------------------------------

create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  app_meta jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  es_google boolean := (app_meta ->> 'provider' = 'google') or (
    exists (
      select 1 from jsonb_array_elements(coalesce(app_meta -> 'providers', '[]'::jsonb)) p
      where p #>> '{}' = 'google'
    )
  );
  v_nombre text;
  v_avatar text;
  v_rol text;
begin
  -- Toma el nombre de nombre, full_name o name
  v_nombre := coalesce(
    nullif(meta ->> 'nombre', ''),
    nullif(meta ->> 'full_name', ''),
    nullif(meta ->> 'name', ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  -- Toma avatar_url o picture
  v_avatar := coalesce(
    nullif(meta ->> 'avatar_url', ''),
    nullif(meta ->> 'picture', '')
  );

  -- RN-015: si viene de Google, siempre es cliente aunque meta intente mandar mecánico
  if es_google then
    v_rol := 'cliente';
  else
    v_rol := coalesce(meta ->> 'rol', 'cliente');
  end if;

  insert into public.perfiles (id, nombre, telefono, avatar_url)
  values (
    new.id,
    coalesce(v_nombre, ''),
    nullif(meta ->> 'telefono', ''),
    v_avatar
  )
  on conflict (id) do update set
    nombre = case when public.perfiles.nombre is null or public.perfiles.nombre = '' then excluded.nombre else public.perfiles.nombre end,
    avatar_url = coalesce(public.perfiles.avatar_url, excluded.avatar_url);

  -- Solo crea ficha en mecánicos si NO es Google y su rol es mecánico
  if v_rol = 'mecanico' and not es_google then
    insert into public.mecanicos (usuario_id, nombre, descripcion, telefono, localidad, especialidades, disponible)
    values (
      new.id,
      coalesce(nullif(meta ->> 'taller_nombre', ''), nullif(meta ->> 'nombre', ''), 'Mecánico'),
      nullif(meta ->> 'taller_descripcion', ''),
      nullif(meta ->> 'telefono', ''),
      nullif(meta ->> 'taller_ubicacion', ''),
      case
        when jsonb_typeof(meta -> 'taller_especialidades') = 'array'
          then array(select jsonb_array_elements_text(meta -> 'taller_especialidades'))
        else '{}'::text[]
      end,
      true
    )
    on conflict (usuario_id) do nothing;
  end if;

  return new;
end;
$function$;

revoke execute on function public.crear_perfil_usuario() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 5. F04: Disponibilidad del mecánico (RF-PROF-003, RN-003, CP-DIS-01..03, CP-DB-11)
-- -----------------------------------------------------------------------------

create or replace function public.cambiar_disponibilidad_mecanico(p_disponible boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid();
begin
  if v_usuario_id is null then
    raise exception 'Tenés que iniciar sesión.' using errcode = 'P0001';
  end if;

  update public.mecanicos
     set disponible = p_disponible
   where usuario_id = v_usuario_id;

  if not found then
    raise exception 'No se encontró la ficha de mecánico para este usuario.' using errcode = 'P0001';
  end if;

  return p_disponible;
end;
$$;

revoke all on function public.cambiar_disponibilidad_mecanico(boolean) from public, anon;
grant execute on function public.cambiar_disponibilidad_mecanico(boolean) to authenticated;

drop policy if exists "mecanicos: actualizar propia ficha" on public.mecanicos;
create policy "mecanicos: actualizar propia ficha"
  on public.mecanicos for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

commit;

notify pgrst, 'reload schema';
