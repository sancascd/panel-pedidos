-- Aviso de saturacion ("tiempo de espera") controlado desde el panel.
--
-- Peticion del 1er cliente: cuando el local va desbordado quieren poder
-- avisarlo para que el bot lo diga en la conversacion, en vez del tiempo
-- estimado normal (20-30 min recogida / 35-45 min domicilio).
--
-- espera_minutos: minutos de espera reales ahora mismo. NULL o 0 = normal.
-- espera_hasta  : cuando caduca el aviso. Lo pone el panel al final del dia
--                 de servicio para que un aviso olvidado un viernes noche no
--                 siga vigente el lunes por la manana.

alter table public.restaurantes
  add column if not exists espera_minutos integer,
  add column if not exists espera_hasta   timestamptz;

comment on column public.restaurantes.espera_minutos is
  'Minutos de espera anunciados por saturacion. NULL/0 = tiempo normal.';
comment on column public.restaurantes.espera_hasta is
  'Momento en que caduca el aviso de espera (TIMESTAMPTZ). NULL = no caduca.';
