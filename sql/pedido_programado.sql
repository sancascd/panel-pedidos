-- =============================================================
-- Pedido programado ("dejarlo encargado")
-- =============================================================
-- El cliente elige una hora concreta (hoy o manana) y el pedido se imprime
-- igual que cualquier otro, pero marcado bien visible con el dia y la hora.
--
-- Aplicar en Supabase -> SQL editor.

-- 1) El pedido. NULL = pedido normal ("lo antes posible").
alter table pedidos
  add column if not exists programado_para timestamptz;

-- Para el bloque "Programados" del panel y para las estadisticas.
create index if not exists pedidos_programado_para_idx
  on pedidos (restaurante_id, programado_para)
  where programado_para is not null;

-- 2) La conversacion, que tiene que recordar la eleccion mientras el cliente
--    termina de dar direccion, nombre y forma de pago.
alter table conversaciones
  add column if not exists programado_para timestamptz,
  add column if not exists prog_dia smallint,      -- 0 = hoy, 1 = manana
  add column if not exists prog_turno text;        -- 'manana' | 'noche'

-- OJO: TIMESTAMPTZ, nunca "timestamp without time zone" (ver fix_timestamptz.sql).
-- Aqui es especialmente critico: una hora de entrega mal interpretada son dos
-- horas de diferencia en verano.

notify pgrst, 'reload schema';
