-- =============================================================
-- RESEÑAS APAGADAS POR DEFECTO
-- =============================================================
-- Los restaurantes nuevos vienen con las reseñas automáticas desactivadas
-- (Sandra, 2026-09-15); se encienden en Ajustes cuando el restaurante quiera.
-- En el menú del panel, «Reseñas» solo sale si están activadas.
-- No cambia a los restaurantes que ya existen. Se puede repetir.

alter table public.restaurantes alter column resenas_activas set default false;

-- Cómo está cada uno (null cuenta como apagadas: el bot solo las pide si es true)
select nombre, resenas_activas from public.restaurantes order by nombre;
