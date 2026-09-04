-- Ocultar el historial de pedidos en el panel del restaurante.
--
-- Peticion del 1er cliente (Gran Muralla): al acabar el dia no quieren ver el
-- listado de pedidos anteriores. NO se borra nada: los pedidos siguen en la
-- base de datos porque son la base del conteo del plan (facturacion) y de las
-- analiticas. Esto solo oculta la pestana "Historial" en su panel.
--
-- El superadmin sigue viendo el historial siempre.

alter table public.restaurantes
  add column if not exists ocultar_historial boolean not null default false;

comment on column public.restaurantes.ocultar_historial is
  'Si es true, la pestana Historial de /pedidos no se muestra a los usuarios del restaurante. Los datos NO se borran.';
