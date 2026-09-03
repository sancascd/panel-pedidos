-- =============================================================
-- Marca de impresión del ticket
-- =============================================================
-- Problema detectado en el restaurante: "Imprimir pendientes" imprimía, pero
-- los pedidos seguían contando como pendientes (imprimir no cambiaba nada).
-- Con esta columna, "pendientes" pasa a significar "pendientes DE IMPRIMIR".
--
-- Además es la base de la IMPRESIÓN AUTOMÁTICA: sin esta marca, el panel
-- reimprimiría los mismos tickets en cada recarga.
-- Aplicar en Supabase -> SQL editor.

alter table pedidos add column if not exists impreso_en timestamptz;

create index if not exists pedidos_impreso_en_idx
  on pedidos (restaurante_id, impreso_en);
