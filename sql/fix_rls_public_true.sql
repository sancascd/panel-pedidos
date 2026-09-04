-- ============================================================
-- FUGA: politicas con USING/WITH CHECK = true para el rol {public}
-- ============================================================
-- Detectado el 2026-09-04 revisando las politicas al abrir la lectura del
-- superadmin.
--
-- El rol "public" en estas politicas incluye a "anon", y la clave anonima va
-- DENTRO del JavaScript del panel: es publica por diseno. Es decir, cualquiera
-- que abra comandi.es y mire el bundle podia:
--
--   * conversaciones      SELECT true  -> LEER TODAS las conversaciones de
--                                        TODOS los restaurantes, con los
--                                        telefonos de los clientes. (RGPD)
--   * resenas             INSERT true  -> meter resenas falsas a cualquiera.
--   * campanas_marketing  INSERT true  -> insertar campanas en cualquier
--                                        restaurante.
--
-- Son restos de cuando el bot usaba la clave anonima. Hoy el bot usa la
-- service_role, que SE SALTA RLS: no necesita ninguna de las tres. Prueba de
-- ello: la tabla pedidos no tiene ninguna politica de INSERT y el bot crea
-- pedidos sin problema.
--
-- Comprobado antes de borrar: el panel NO lee conversaciones en ningun sitio,
-- y de resenas/campanas_marketing solo hace SELECT (que siguen cubiertos por
-- sus politicas propias, acotadas por mis_restaurantes()).
--
-- Mismo patron que ya se arreglo en rate_limits y campanas_envios
-- (sql/fix_rls_overpermisivo.sql, 2026-06-03). Al crear politicas nuevas:
-- NUNCA "true" para public.

drop policy if exists "ver mis conversaciones" on public.conversaciones;
drop policy if exists "Bot inserta resenas"    on public.resenas;
drop policy if exists "Bot inserta campanas"   on public.campanas_marketing;


-- Comprobacion. Debe devolver 0 filas.
select tablename, policyname, roles::text, cmd
from pg_policies
where schemaname = 'public'
  and roles::text like '%public%'
  and (qual::text = 'true' or with_check::text = 'true');
