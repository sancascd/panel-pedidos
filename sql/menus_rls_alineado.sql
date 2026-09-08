-- =============================================================
-- Menús: alinear sus políticas con las del resto del panel
-- =============================================================
-- Las escribí con `mi_restaurante_id() OR soy_superadmin()`, saliéndome del
-- patrón. Dos problemas:
--
--  1. `soy_superadmin()` daba a la cuenta de plataforma permiso PERMANENTE de
--     escritura sobre los menús de TODOS los clientes. La decisión de su día
--     (sql/superadmin_acceso.sql) fue justo la contraria: para tocar los datos
--     de un restaurante hay que entrar en su panel, lo que crea un vínculo
--     temporal en `usuarios_restaurante`. Así queda rastro de que se entró y
--     el acceso se cierra al salir.
--
--  2. `mi_restaurante_id()` hace `limit 1` SIN order by. Un usuario vinculado
--     a dos restaurantes cae en uno arbitrario. `mis_restaurantes()` devuelve
--     todos, que es lo que usan carta, categorías, horarios, clientes y reseñas.
--
-- Con esto, entrar en el panel de un restaurante da acceso a sus menús igual
-- que a su carta, y salir lo quita.
--
-- Aplicar en Supabase -> SQL editor.

drop policy if exists "Restaurante gestiona sus menus"    on public.menus;
drop policy if exists "Restaurante gestiona sus grupos"   on public.menu_grupos;
drop policy if exists "Restaurante gestiona sus opciones" on public.menu_opciones;

create policy "gestionar mis menus" on public.menus
  for all  using (restaurante_id in (select mis_restaurantes()))
  with check (restaurante_id in (select mis_restaurantes()));

create policy "gestionar mis grupos de menu" on public.menu_grupos
  for all  using (restaurante_id in (select mis_restaurantes()))
  with check (restaurante_id in (select mis_restaurantes()));

create policy "gestionar mis opciones de menu" on public.menu_opciones
  for all  using (restaurante_id in (select mis_restaurantes()))
  with check (restaurante_id in (select mis_restaurantes()));

-- Comprobación: las tres deben decir `mis_restaurantes` y ninguna `soy_superadmin`.
-- select tablename, policyname, cmd, qual
--   from pg_policies
--  where schemaname = 'public'
--    and tablename in ('menus','menu_grupos','menu_opciones');
