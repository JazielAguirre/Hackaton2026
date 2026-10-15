-- Tablas de operación: lotes, fotos, frutos, analisis_lote y sugerencias.
-- Incluye índices, triggers (updated_at y destino por fruto), RLS y permisos.

-- ============ Tablas ============
create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  fruta_principal text references public.frutas (id),
  parcela text,
  zona text,
  latitud numeric(9, 6) check (latitud between -90 and 90),
  longitud numeric(9, 6) check (longitud between -180 and 180),
  fecha_cosecha date,
  destino_buscado public.destino,
  estado public.estado_lote not null default 'borrador',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete cascade,
  storage_path text not null,
  ancho integer check (ancho > 0),
  alto integer check (alto > 0),
  valida boolean not null default true,
  motivo_rechazo text,
  nitidez numeric,
  brillo numeric,
  created_at timestamptz not null default now()
);

-- Una fila por fruto detectado. Las coordenadas de la caja van normalizadas (0 a 1).
create table public.frutos (
  id uuid primary key default gen_random_uuid(),
  foto_id uuid not null references public.fotos (id) on delete cascade,
  lote_id uuid not null references public.lotes (id) on delete cascade,
  fruta_id text not null references public.frutas (id),
  conf_deteccion numeric(4, 3) not null check (conf_deteccion between 0 and 1),
  caja_x numeric not null check (caja_x between 0 and 1),
  caja_y numeric not null check (caja_y between 0 and 1),
  caja_ancho numeric not null check (caja_ancho > 0 and caja_ancho <= 1),
  caja_alto numeric not null check (caja_alto > 0 and caja_alto <= 1),
  clase_id integer references public.clases (id),
  conf_clasificacion numeric(4, 3) check (conf_clasificacion between 0 and 1),
  -- Lo sobrescribe siempre el trigger frutos_asignar_destino.
  destino public.destino not null default 'revision_manual',
  requiere_revision boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.analisis_lote (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete cascade,
  total_frutos integer not null check (total_frutos >= 0),
  frutos_sanos integer not null check (frutos_sanos >= 0),
  frutos_separar integer not null check (frutos_separar >= 0),
  frutos_revision integer not null check (frutos_revision >= 0),
  pct_sanos numeric(5, 2) check (pct_sanos between 0 and 100),
  pct_separar numeric(5, 2) check (pct_separar between 0 and 100),
  conteo_por_clase jsonb not null default '{}'::jsonb,
  grado public.grado_lote,
  destino_lote public.destino,
  muestra_pequena boolean not null,
  modelo_version text,
  created_at timestamptz not null default now()
);

create table public.sugerencias (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete cascade,
  analisis_id uuid not null references public.analisis_lote (id) on delete cascade,
  ficha_id integer references public.fichas (id),
  texto text not null,
  origen public.origen_sugerencia not null,
  created_at timestamptz not null default now()
);

-- ============ Índices ============
create index lotes_usuario_created_idx on public.lotes (usuario_id, created_at desc);
create index lotes_zona_idx on public.lotes (zona);
create index lotes_fruta_principal_idx on public.lotes (fruta_principal);
create index fotos_lote_id_idx on public.fotos (lote_id);
create index frutos_lote_id_idx on public.frutos (lote_id);
create index frutos_foto_id_idx on public.frutos (foto_id);
create index frutos_clase_id_idx on public.frutos (clase_id);
create index frutos_fruta_id_idx on public.frutos (fruta_id);
create index analisis_lote_lote_created_idx on public.analisis_lote (lote_id, created_at desc);
create index sugerencias_lote_id_idx on public.sugerencias (lote_id);
create index sugerencias_analisis_id_idx on public.sugerencias (analisis_id);
create index sugerencias_ficha_id_idx on public.sugerencias (ficha_id);

-- ============ Triggers ============
create trigger lotes_set_updated_at
  before update on public.lotes
  for each row execute function public.set_updated_at();

-- Asigna destino y requiere_revision a cada fruto. Es la única fuente de esta regla:
-- no se duplica en Python ni en la web.
create function public.asignar_destino_fruto()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_umbral numeric;
  v_fruta_de_clase text;
  v_destino_default public.destino;
begin
  if not exists (
    select 1 from public.fotos f where f.id = new.foto_id and f.lote_id = new.lote_id
  ) then
    raise exception 'La foto % no pertenece al lote %', new.foto_id, new.lote_id;
  end if;

  if new.clase_id is not null then
    select c.fruta_id, c.destino_default
      into v_fruta_de_clase, v_destino_default
      from public.clases c
      where c.id = new.clase_id;

    if v_fruta_de_clase is distinct from new.fruta_id then
      raise exception 'La clase % no corresponde a la fruta %', new.clase_id, new.fruta_id;
    end if;
  end if;

  select valor into v_umbral from public.configuracion where clave = 'umbral_confianza';
  if v_umbral is null then
    raise exception 'Falta configuracion.umbral_confianza';
  end if;

  if new.clase_id is null
     or new.conf_clasificacion is null
     or new.conf_clasificacion < v_umbral then
    new.destino := 'revision_manual';
    new.requiere_revision := true;
  else
    new.destino := v_destino_default;
    new.requiere_revision := false;
  end if;

  return new;
end;
$$;

revoke execute on function public.asignar_destino_fruto() from public, anon, authenticated;

create trigger frutos_asignar_destino
  before insert or update on public.frutos
  for each row execute function public.asignar_destino_fruto();

-- ============ RLS: cada usuario solo ve lo de sus propios lotes ============
-- lotes y fotos: el usuario los crea y edita desde la web.
-- frutos, analisis_lote y sugerencias: solo lectura; los escribe la API con service role,
-- así nadie puede falsear su grado ni las alertas comunitarias.
alter table public.lotes enable row level security;
alter table public.fotos enable row level security;
alter table public.frutos enable row level security;
alter table public.analisis_lote enable row level security;
alter table public.sugerencias enable row level security;

create policy lotes_propios on public.lotes
  for all to authenticated
  using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

create policy fotos_de_lotes_propios on public.fotos
  for all to authenticated
  using (lote_id in (select l.id from public.lotes l where l.usuario_id = (select auth.uid())))
  with check (lote_id in (select l.id from public.lotes l where l.usuario_id = (select auth.uid())));

create policy frutos_de_lotes_propios on public.frutos
  for select to authenticated
  using (lote_id in (select l.id from public.lotes l where l.usuario_id = (select auth.uid())));

create policy analisis_de_lotes_propios on public.analisis_lote
  for select to authenticated
  using (lote_id in (select l.id from public.lotes l where l.usuario_id = (select auth.uid())));

create policy sugerencias_de_lotes_propios on public.sugerencias
  for select to authenticated
  using (lote_id in (select l.id from public.lotes l where l.usuario_id = (select auth.uid())));

-- anon nada; RLS decide qué filas ve authenticated.
revoke all on public.lotes, public.fotos, public.frutos, public.analisis_lote, public.sugerencias
  from anon, authenticated;
grant select, insert, update, delete on public.lotes, public.fotos to authenticated;
grant select on public.frutos, public.analisis_lote, public.sugerencias to authenticated;
