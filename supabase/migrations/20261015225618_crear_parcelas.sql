-- Parcelas de cada productor: las registra una vez y luego las elige al crear un lote.
-- lotes.parcela (texto libre) se queda por ahora; la web y la API no cambian todavía.
--
-- PENDIENTE DE APLICAR (2026-10-15). Aplicar con el MCP de Supabase (apply_migration,
-- nombre "crear_parcelas") en el proyecto dylcucrhjxshpjqftgbe. Si la versión que asigna
-- Supabase es otra, renombrar este archivo con esa versión. Después: regenerar
-- frontend/src/types/database.ts y actualizar supabase/esquema_completo.sql.

-- ============ Tabla parcelas ============
create table public.parcelas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120),
  zona_id integer references public.zonas (id),
  latitud numeric(9, 6) check (latitud between -90 and 90),
  longitud numeric(9, 6) check (longitud between -180 and 180),
  -- Una parcela que ya no se usa se desactiva en vez de borrarse: así no se pierde el historial de sus lotes.
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Permite que lotes compruebe que la parcela es del mismo usuario (ver abajo).
  unique (id, usuario_id)
);

-- Sin nombres repetidos por usuario: "Parcela 3" y "parcela 3 " cuentan igual.
create unique index parcelas_usuario_nombre_key on public.parcelas (usuario_id, lower(btrim(nombre)));
create index parcelas_zona_id_idx on public.parcelas (zona_id);

create trigger parcelas_set_updated_at
  before update on public.parcelas
  for each row execute function public.set_updated_at();

-- ============ RLS: cada usuario ve y edita solo sus parcelas ============
alter table public.parcelas enable row level security;

create policy parcelas_propias on public.parcelas
  for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- anon nada. Update por columna: el usuario no puede cambiar el dueño de una parcela.
revoke all on public.parcelas from anon, authenticated;
grant select, insert, delete on public.parcelas to authenticated;
grant update (nombre, zona_id, latitud, longitud, activa) on public.parcelas to authenticated;

-- ============ Lotes: referencia opcional a la parcela ============
alter table public.lotes add column parcela_id uuid;

-- Llave compuesta: la parcela tiene que ser del mismo dueño que el lote.
-- Sin ON DELETE: una parcela con lotes no se puede borrar (se desactiva).
alter table public.lotes
  add constraint lotes_parcela_del_usuario_fkey
  foreign key (parcela_id, usuario_id) references public.parcelas (id, usuario_id);

create index lotes_parcela_id_idx on public.lotes (parcela_id);
