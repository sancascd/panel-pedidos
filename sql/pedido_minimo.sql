-- =============================================================
-- Pedido mínimo a domicilio
-- =============================================================
-- Importe por debajo del cual el restaurante no reparte. NULL o 0 = sin
-- mínimo, que es como se queda todo el mundo hasta que lo configure.
--
-- Solo aplica a DOMICILIO: la recogida en el local no tiene mínimo, y de
-- hecho es la salida que se le ofrece a quien no llega.
--
-- Aplicar en Supabase -> SQL editor.

alter table restaurantes
  add column if not exists pedido_minimo numeric(10,2);

comment on column restaurantes.pedido_minimo is
  'Importe mínimo para pedidos a domicilio. NULL o 0 = sin mínimo. La recogida nunca tiene mínimo.';

-- China Town: 15 €.
update restaurantes set pedido_minimo = 15.00 where slug = 'china-town';

select nombre, slug, pedido_minimo from restaurantes order by creado_en;
