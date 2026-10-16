-- Enfermedad probable: si el clasificador predice una clase NO sana con confianza entre
-- umbral_enfermedad_min (0.44) y umbral_enfermedad_max (0.63), y por debajo del umbral de su clase,
-- el fruto va a 'separar' en vez de 'revision_manual' (más vale separar de más que dejar pasar un brote).
-- Una clase sana con poca confianza sigue en revision_manual: si fuera a separar contaría como sana y separada a la vez.
insert into public.configuracion (clave, valor, descripcion) values
  ('umbral_enfermedad_min', 0.44, 'Desde esta confianza, un fruto no sano bajo su umbral va a separar'),
  ('umbral_enfermedad_max', 0.63, 'Hasta esta confianza, un fruto no sano bajo su umbral va a separar');

create or replace function public.asignar_destino_fruto()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_umbral numeric;
  v_umbral_clase numeric;
  v_enfermedad_min numeric;
  v_enfermedad_max numeric;
  v_fruta_de_clase text;
  v_destino_default public.destino;
  v_es_sana boolean;
begin
  if not exists (
    select 1 from public.fotos f where f.id = new.foto_id and f.lote_id = new.lote_id
  ) then
    raise exception 'La foto % no pertenece al lote %', new.foto_id, new.lote_id;
  end if;

  if new.clase_id is not null then
    select c.fruta_id, c.destino_default, c.umbral_confianza, c.es_sana
      into v_fruta_de_clase, v_destino_default, v_umbral_clase, v_es_sana
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
  select valor into v_enfermedad_min from public.configuracion where clave = 'umbral_enfermedad_min';
  select valor into v_enfermedad_max from public.configuracion where clave = 'umbral_enfermedad_max';

  -- Si la clase tiene umbral propio, reemplaza al general.
  v_umbral := coalesce(v_umbral_clase, v_umbral);

  if new.clase_id is null or new.conf_clasificacion is null then
    new.destino := 'revision_manual';
    new.requiere_revision := true;
  elsif new.conf_clasificacion >= v_umbral then
    new.destino := v_destino_default;
    new.requiere_revision := false;
  elsif not v_es_sana and new.conf_clasificacion between v_enfermedad_min and v_enfermedad_max then
    new.destino := 'separar';
    new.requiere_revision := true;
  else
    new.destino := 'revision_manual';
    new.requiere_revision := true;
  end if;

  return new;
end;
$$;
revoke execute on function public.asignar_destino_fruto() from public, anon, authenticated;
