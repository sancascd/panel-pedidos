-- ============================================================
-- AVISO PARA LOS REPARTOS
-- ============================================================
-- Texto libre del restaurante que el bot enseña justo antes de pedir la
-- dirección: zonas donde no reparte o con otro pedido mínimo. El bot no sabe
-- de zonas (eso vendrá después, validando dirección o código postal); de
-- momento lo lee el cliente y lo que se cuele lo resuelve el restaurante.
--
-- EJECUTAR ANTES DE PUBLICAR EL BOT: el bot pide esta columna al leer el
-- restaurante y, si no existe, no encontraría ninguno.

alter table public.restaurantes
  add column if not exists aviso_domicilio text;

alter table public.restaurantes
  drop constraint if exists restaurantes_aviso_domicilio_largo;
alter table public.restaurantes
  add constraint restaurantes_aviso_domicilio_largo
  check (aviso_domicilio is null or char_length(aviso_domicilio) <= 300);

notify pgrst, 'reload schema';
