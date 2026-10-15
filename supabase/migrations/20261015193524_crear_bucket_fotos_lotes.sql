-- Bucket privado para las fotos de los lotes.
-- Ruta de cada archivo: {usuario_id}/{lote_id}/{foto_id}.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-lotes', 'fotos-lotes', false, 10485760, array['image/*']);

-- Cada usuario sube, lee y borra solo dentro de su carpeta {usuario_id}/.
create policy fotos_lotes_subir_propias on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos-lotes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy fotos_lotes_leer_propias on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos-lotes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy fotos_lotes_borrar_propias on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos-lotes'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
