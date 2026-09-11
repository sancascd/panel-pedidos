-- =============================================================
-- Historial de pedidos: OCULTO por defecto
-- =============================================================
-- Antes cada restaurante lo encendia o apagaba desde Ajustes, y venia
-- visible. Ahora viene oculto para todos y se quita de Ajustes: si un
-- restaurante lo pide expresamente, se le activa desde aqui.
--
-- No se borra nada: los pedidos siguen en la base de datos, que son la base
-- del conteo del plan y de las analiticas. Solo se esconde la pestaña
-- "Historial" en su panel. La superadmin la sigue viendo siempre.
--
-- Aplicar en Supabase -> SQL editor.

alter table public.restaurantes
  alter column ocultar_historial set default true;

update public.restaurantes set ocultar_historial = true where not ocultar_historial;

comment on column public.restaurantes.ocultar_historial is
  'Oculto por defecto. Solo se pone a false si el restaurante lo pide, desde la administracion. Los datos NO se borran.';

-- Como queda:
select nombre, slug, ocultar_historial from public.restaurantes order by creado_en;


-- ---------- Para ACTIVARLO a un restaurante que lo pida ----------
-- update public.restaurantes set ocultar_historial = false where slug = 'SLUG_DEL_RESTAURANTE';
