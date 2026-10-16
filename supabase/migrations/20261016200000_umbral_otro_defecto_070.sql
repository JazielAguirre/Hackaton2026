-- Baja el umbral de mango otro_defecto de 0.85 a 0.70 (pedido del equipo tras probar con fotos de huerta).
-- Solo aplica a frutos nuevos: el trigger asigna el destino al insertar.
update public.clases
   set umbral_confianza = 0.70
 where fruta_id = 'mango' and codigo = 'otro_defecto';
