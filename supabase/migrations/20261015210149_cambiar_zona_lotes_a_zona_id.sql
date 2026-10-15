-- lotes.zona (texto libre) pasa a lotes.zona_id (catálogo zonas).
-- bitacora_lotes y alertas_comunitarias() ahora usan zona_id y devuelven el nombre de la zona.

-- No hay datos que migrar; si apareciera alguno, la migración se detiene sin cambiar nada.
do $$
begin
  if exists (select 1 from public.lotes where zona is not null) then
    raise exception 'Hay lotes con zona; migra esos valores antes de quitar la columna';
  end if;
end $$;

-- La vista y la función dependen de lotes.zona y cambian de columnas: se borran y se recrean.
drop view public.bitacora_lotes;
drop function public.alertas_comunitarias();

-- Al borrar la columna también se borra su índice lotes_zona_idx.
alter table public.lotes drop column zona;
alter table public.lotes add column zona_id integer references public.zonas (id);
create index lotes_zona_id_idx on public.lotes (zona_id);

-- ============ alertas_comunitarias ============
-- Security definer a propósito: agrega frutos de TODOS los usuarios para avisar de brotes
-- por zona. Solo devuelve datos agregados (sin usuario_id ni ids de lotes) y solo grupos
-- con al menos configuracion.alerta_min_lotes lotes distintos.
create function public.alertas_comunitarias()
returns table (
  zona_id integer,
  zona_nombre text,
  fruta_id text,
  clase_codigo text,
  lotes_afectados bigint,
  ultimo_reporte timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    z.id,
    z.nombre,
    f.fruta_id,
    c.codigo,
    count(distinct f.lote_id),
    max(f.created_at)
  from public.frutos f
  join public.lotes l on l.id = f.lote_id
  join public.zonas z on z.id = l.zona_id
  join public.clases c on c.id = f.clase_id
  where f.destino = 'separar'
    and f.created_at >= now() - make_interval(
      days => (select cfg.valor::integer from public.configuracion cfg where cfg.clave = 'alerta_dias')
    )
  group by z.id, z.nombre, f.fruta_id, c.codigo
  having count(distinct f.lote_id) >= (
    select cfg.valor from public.configuracion cfg where cfg.clave = 'alerta_min_lotes'
  )
  order by count(distinct f.lote_id) desc, max(f.created_at) desc;
$$;

revoke execute on function public.alertas_comunitarias() from public, anon;
grant execute on function public.alertas_comunitarias() to authenticated, service_role;

-- ============ Vista bitacora_lotes ============
-- Cada lote con el nombre de su zona y los datos de su análisis más reciente.
-- security_invoker hace que se apliquen las políticas RLS de lotes, zonas y analisis_lote.
create view public.bitacora_lotes
with (security_invoker = true)
as
select
  l.id,
  l.usuario_id,
  l.nombre,
  l.fruta_principal,
  l.parcela,
  l.zona_id,
  z.nombre as zona_nombre,
  l.latitud,
  l.longitud,
  l.fecha_cosecha,
  l.destino_buscado,
  l.estado,
  l.created_at,
  l.updated_at,
  a.id as analisis_id,
  a.total_frutos,
  a.frutos_sanos,
  a.frutos_separar,
  a.frutos_revision,
  a.pct_sanos,
  a.pct_separar,
  a.conteo_por_clase,
  a.grado,
  a.destino_lote,
  a.muestra_pequena,
  a.modelo_version,
  a.created_at as analizado_at
from public.lotes l
left join public.zonas z on z.id = l.zona_id
left join lateral (
  select al.*
  from public.analisis_lote al
  where al.lote_id = l.id
  order by al.created_at desc
  limit 1
) a on true;

revoke all on public.bitacora_lotes from anon, authenticated;
grant select on public.bitacora_lotes to authenticated;
