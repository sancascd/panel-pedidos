-- =============================================================
-- Selector de carta que usa el bot: Comandi / enlace / PDF
-- =============================================================
-- Preferencia por restaurante. Si es NULL o no se puede satisfacer
-- (p. ej. 'comandi' sin slug), el bot cae al orden automático
-- (comandi → enlace → pdf → texto). Aplicar en Supabase → SQL editor.

alter table restaurantes
  add column if not exists carta_tipo text
  check (carta_tipo in ('comandi', 'enlace', 'pdf'));

-- Gran Muralla: usar la carta Comandi de forma explícita.
update restaurantes set carta_tipo = 'comandi'
 where slug = 'gran-muralla' and carta_tipo is null;
