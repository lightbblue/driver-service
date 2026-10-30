-- Diagnóstico del esquema de solicitudes. Solo lectura: se puede correr en el
-- SQL Editor antes y después de aplicar las migraciones.

-- Columnas
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('solicitudes', 'historial_solicitudes', 'mecanicos', 'categorias_averia', 'perfiles')
order by table_name, ordinal_position;

-- Claves foráneas y restricciones
select conrelid::regclass as tabla, conname, pg_get_constraintdef(oid) as definicion
from pg_constraint
where connamespace = 'public'::regnamespace
order by 1, 2;

-- RLS habilitado
select relname as tabla, relrowsecurity as rls
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
order by 1;

-- Políticas
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- Triggers (incluido el de alta de perfiles en auth.users)
select event_object_table as tabla, trigger_name, action_timing, event_manipulation, action_statement
from information_schema.triggers
where event_object_schema in ('public', 'auth')
order by 1, 2;

-- Tablas publicadas en Realtime
select tablename from pg_publication_tables where pubname = 'supabase_realtime';

-- Solicitudes por estado y su historial
select estado, count(*) from public.solicitudes group by estado order by 1;
select count(*) as hitos_de_historial from public.historial_solicitudes;
