-- Umbral de confianza opcional por clase. Si clases.umbral_confianza tiene valor,
-- el trigger de frutos lo usa en vez de configuracion.umbral_confianza.
-- Motivo: el clasificador de mango a veces confunde antracnosis (separar) con
-- sarna o cancro bacteriano (otro_defecto -> mercado_nacional). Con 0.85 esas
-- predicciones dudosas pasan a revision_manual. frutos.conf_clasificacion es la
-- probabilidad top-1 de la clase que predice el modelo. Análisis y elección del
-- umbral: ml/scripts/analizar_umbral.py y README.md (sección Umbral de confianza).

alter table public.clases
  add column umbral_confianza numeric(3, 2)
  check (umbral_confianza is null or umbral_confianza between 0 and 1);

comment on column public.clases.umbral_confianza is
  'Opcional. Si tiene valor, reemplaza a configuracion.umbral_confianza para los frutos de esta clase.';

create or replace function public.asignar_destino_fruto()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_umbral numeric;
  v_umbral_clase numeric;
  v_fruta_de_clase text;
  v_destino_default public.destino;
begin
  if not exists (
    select 1 from public.fotos f where f.id = new.foto_id and f.lote_id = new.lote_id
  ) then
    raise exception 'La foto % no pertenece al lote %', new.foto_id, new.lote_id;
  end if;

  if new.clase_id is not null then
    select c.fruta_id, c.destino_default, c.umbral_confianza
      into v_fruta_de_clase, v_destino_default, v_umbral_clase
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

  -- Si la clase tiene umbral propio, reemplaza al general.
  v_umbral := coalesce(v_umbral_clase, v_umbral);

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

update public.clases
   set umbral_confianza = 0.85
 where fruta_id = 'mango' and codigo = 'otro_defecto';
