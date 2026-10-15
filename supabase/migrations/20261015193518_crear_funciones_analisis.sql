-- Funciones de análisis (cerrar_analisis_lote, alertas_comunitarias) y vista bitacora_lotes.

-- ============ cerrar_analisis_lote ============
-- Calcula el resumen del lote a partir de sus frutos, guarda una fila en analisis_lote,
-- marca el lote como analizado y devuelve la fila.
-- Los porcentajes y el conteo por clase usan solo frutos clasificados (sin revision_manual).
-- Solo la llama la API con service role, igual que la escritura de frutos.
create function public.cerrar_analisis_lote(p_lote_id uuid, p_modelo_version text)
returns public.analisis_lote
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
  v_sanos integer;
  v_separar integer;
  v_revision integer;
  v_pct_sanos numeric(5, 2);
  v_pct_separar numeric(5, 2);
  v_conteo jsonb;
  v_grado public.grado_lote;
  v_destino public.destino;
  v_min_muestra numeric;
  v_resultado public.analisis_lote;
begin
  if not exists (select 1 from public.lotes where id = p_lote_id) then
    raise exception 'Lote % no encontrado', p_lote_id;
  end if;

  select
    count(*) filter (where f.destino <> 'revision_manual'),
    count(*) filter (where f.destino <> 'revision_manual' and c.es_sana),
    count(*) filter (where f.destino = 'separar'),
    count(*) filter (where f.destino = 'revision_manual')
  into v_total, v_sanos, v_separar, v_revision
  from public.frutos f
  left join public.clases c on c.id = f.clase_id
  where f.lote_id = p_lote_id;

  -- { "mango": { "sano": 10, "antracnosis": 2 }, "fresa": { ... } }
  select coalesce(jsonb_object_agg(por_fruta.fruta_id, por_fruta.clases), '{}'::jsonb)
  into v_conteo
  from (
    select por_clase.fruta_id, jsonb_object_agg(por_clase.codigo, por_clase.n) as clases
    from (
      select f.fruta_id, c.codigo, count(*) as n
      from public.frutos f
      join public.clases c on c.id = f.clase_id
      where f.lote_id = p_lote_id and f.destino <> 'revision_manual'
      group by f.fruta_id, c.codigo
    ) por_clase
    group by por_clase.fruta_id
  ) por_fruta;

  -- Sin frutos clasificados no hay porcentajes ni grado.
  if v_total > 0 then
    v_pct_sanos := round(100.0 * v_sanos / v_total, 2);
    v_pct_separar := round(100.0 * v_separar / v_total, 2);

    select u.grado, u.destino_lote
      into v_grado, v_destino
      from public.umbrales_grado u
      where v_pct_sanos >= u.min_pct_sanos
        and v_pct_separar <= u.max_pct_separar
      order by u.orden
      limit 1;

    if v_grado is null then
      v_grado := 'rechazo';
      select u.destino_lote into v_destino from public.umbrales_grado u where u.grado = 'rechazo';
    end if;
  end if;

  select valor into v_min_muestra from public.configuracion where clave = 'min_frutos_muestra';
  if v_min_muestra is null then
    raise exception 'Falta configuracion.min_frutos_muestra';
  end if;

  insert into public.analisis_lote (
    lote_id, total_frutos, frutos_sanos, frutos_separar, frutos_revision,
    pct_sanos, pct_separar, conteo_por_clase, grado, destino_lote,
    muestra_pequena, modelo_version
  ) values (
    p_lote_id, v_total, v_sanos, v_separar, v_revision,
    v_pct_sanos, v_pct_separar, v_conteo, v_grado, v_destino,
    v_total < v_min_muestra, p_modelo_version
  )
  returning * into v_resultado;

  update public.lotes set estado = 'analizado' where id = p_lote_id;

  return v_resultado;
end;
$$;

revoke execute on function public.cerrar_analisis_lote(uuid, text) from public, anon, authenticated;
grant execute on function public.cerrar_analisis_lote(uuid, text) to service_role;

-- ============ alertas_comunitarias ============
-- Security definer a propósito: agrega frutos de TODOS los usuarios para avisar de brotes
-- por zona. Solo devuelve datos agregados (sin usuario_id ni ids de lotes) y solo grupos
-- con al menos configuracion.alerta_min_lotes lotes distintos.
create function public.alertas_comunitarias()
returns table (
  zona text,
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
    l.zona,
    f.fruta_id,
    c.codigo,
    count(distinct f.lote_id),
    max(f.created_at)
  from public.frutos f
  join public.lotes l on l.id = f.lote_id
  join public.clases c on c.id = f.clase_id
  where f.destino = 'separar'
    and l.zona is not null
    and f.created_at >= now() - make_interval(
      days => (select cfg.valor::integer from public.configuracion cfg where cfg.clave = 'alerta_dias')
    )
  group by l.zona, f.fruta_id, c.codigo
  having count(distinct f.lote_id) >= (
    select cfg.valor from public.configuracion cfg where cfg.clave = 'alerta_min_lotes'
  )
  order by count(distinct f.lote_id) desc, max(f.created_at) desc;
$$;

revoke execute on function public.alertas_comunitarias() from public, anon;
grant execute on function public.alertas_comunitarias() to authenticated, service_role;

-- ============ Vista bitacora_lotes ============
-- Cada lote con los datos de su análisis más reciente (null si aún no se analiza).
-- security_invoker hace que se apliquen las políticas RLS de lotes y analisis_lote.
create view public.bitacora_lotes
with (security_invoker = true)
as
select
  l.id,
  l.usuario_id,
  l.nombre,
  l.fruta_principal,
  l.parcela,
  l.zona,
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
left join lateral (
  select al.*
  from public.analisis_lote al
  where al.lote_id = l.id
  order by al.created_at desc
  limit 1
) a on true;

revoke all on public.bitacora_lotes from anon, authenticated;
grant select on public.bitacora_lotes to authenticated;
