-- Vigilancia del estado de la cuenta de WhatsApp de cada restaurante.
--
-- El 2026-09-06 Meta inhabilito la cuenta de Gran Muralla y nos enteramos de
-- casualidad, mirando otra cosa. El bot dejo de recibir mensajes sin que
-- saltara ninguna alarma.
--
-- El cron del bot consulta el estado del numero en la API de Meta y avisa por
-- email cuando CAMBIA. Estas columnas guardan el ultimo estado conocido, para
-- no mandar un correo en cada pasada.
--
--   ok            -> responde y la calidad es buena
--   calidad_media -> Meta marca la calidad en amarillo
--   calidad_baja  -> en rojo: aviso serio, suele preceder a una restriccion
--   error         -> la API falla (cuenta inhabilitada, token caducado...)
--   sin_configurar-> al restaurante le falta el numero o el token

alter table public.restaurantes
  add column if not exists meta_estado         text,
  add column if not exists meta_estado_detalle text,
  add column if not exists meta_estado_desde   timestamptz;

comment on column public.restaurantes.meta_estado is
  'Ultimo estado conocido del numero de WhatsApp en Meta. Lo escribe el cron del bot.';
