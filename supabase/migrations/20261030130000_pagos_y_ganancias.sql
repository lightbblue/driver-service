-- =============================================================================
-- B02 / P13: Tabla pagos, registrar_pago con comisión y ganancias del mecánico
-- Requisitos: RF-PAY-001, RF-PAY-002, RF-PAY-004, RF-VIEW-015, RF-AUTH-006
-- Reglas de negocio: RN-007, RN-012, RN-013, RNF-SEC-005
-- Casos de prueba: CP-PAG-04..07, CP-DB-14..20, CP-GAN-01..05
-- =============================================================================

begin;

-- 1. Tabla pagos
create table if not exists public.pagos (
  id              uuid primary key default gen_random_uuid(),
  solicitud_id    uuid not null unique references public.solicitudes (id) on delete cascade,
  cliente_id      uuid not null references auth.users (id) on delete cascade,
  mecanico_id     uuid not null references public.mecanicos (id) on delete cascade,
  monto           numeric(12,2) not null check (monto > 0),
  comision        numeric(12,2) not null check (comision >= 0),
  neto_mecanico   numeric(12,2) not null check (neto_mecanico >= 0),
  medio           text not null default 'simulado',
  estado          text not null default 'aprobado' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  creado_en       timestamptz not null default now()
);

-- Índices de consulta para cliente y mecánico
create index if not exists pagos_solicitud_idx on public.pagos (solicitud_id);
create index if not exists pagos_mecanico_idx  on public.pagos (mecanico_id, creado_en desc);
create index if not exists pagos_cliente_idx   on public.pagos (cliente_id, creado_en desc);

-- 2. Seguridad RLS (RF-SEC-001, RNF-SEC-005)
alter table public.pagos enable row level security;

-- La ven únicamente el cliente y el mecánico asignado al servicio (CP-DB-20)
drop policy if exists "pagos: cliente o mecánico asignado" on public.pagos;
create policy "pagos: cliente o mecánico asignado"
  on public.pagos for select to authenticated
  using (
    cliente_id = auth.uid()
    or mecanico_id = public.mecanico_id_actual()
  );

-- Nadie inserta, modifica ni borra directamente: todo pasa por registrar_pago() (CP-DB-14, RNF-SEC-005)
revoke insert, update, delete on public.pagos from anon, authenticated;
grant select on public.pagos to authenticated;

-- 3. Función registrar_pago (RF-PAY-002, RN-012, RN-013, RNF-SEC-005)
create or replace function public.registrar_pago(p_solicitud_id uuid)
returns public.pagos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitud   public.solicitudes;
  v_neto        numeric(12,2);
  v_comision    numeric(12,2);
  v_pago        public.pagos;
begin
  if auth.uid() is null then
    raise exception 'Tenés que iniciar sesión para continuar.' using errcode = 'P0001';
  end if;

  select * into v_solicitud from public.solicitudes where id = p_solicitud_id for update;
  if v_solicitud.id is null then
    raise exception 'La solicitud no existe.' using errcode = 'P0001';
  end if;

  -- Solo el cliente de la solicitud puede pagar (CP-DB-17)
  if v_solicitud.usuario_id <> auth.uid() then
    raise exception 'Solo el cliente que solicitó el servicio puede pagarlo.' using errcode = 'P0001';
  end if;

  -- RN-013: solo se paga un servicio finalizado con monto cargado (CP-DB-15)
  if v_solicitud.estado <> 'finalizado' or v_solicitud.monto_final is null then
    raise exception 'Solo se puede pagar un servicio finalizado con monto cargado.' using errcode = 'P0001';
  end if;

  -- RN-013: no permitir pagar dos veces el mismo servicio (CP-DB-16, CP-PAG-07)
  if exists (select 1 from public.pagos where solicitud_id = p_solicitud_id) then
    raise exception 'Este servicio ya fue pagado.' using errcode = 'P0001';
  end if;

  -- RN-012 / CP-DB-18:
  -- Neto mecánico = 90 % redondeado a 2 decimales
  -- Comisión plataforma = monto - neto (la comisión absorbe el centavo de diferencia)
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
  ) values (
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

  -- Registrar en la bitácora de la solicitud (RF-DATA-004, CP-PAG-09)
  insert into public.historial_solicitudes (
    solicitud_id,
    estado_anterior,
    estado,
    nota,
    usuario_id
  ) values (
    v_solicitud.id,
    v_solicitud.estado,
    v_solicitud.estado,
    'Pago aprobado de $' || to_char(v_solicitud.monto_final, 'FM999999990.00'),
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

commit;

notify pgrst, 'reload schema';

