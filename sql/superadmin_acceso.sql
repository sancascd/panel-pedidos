-- ============================================================
-- ACCESO DEL SUPERADMIN
-- ============================================================
-- Dos cosas distintas que conviene no mezclar:
--
--   1) LEER para el panel /admin (restaurantes y pedidos de todos).
--   2) ENTRAR en el panel de un restaurante concreto para ayudarle.
--
-- Para (2) NO se abre RLS. Se reutiliza el vinculo normal
-- (usuarios_restaurante): el superadmin se vincula temporalmente al
-- restaurante y todo el panel funciona tal cual, sin tocar ni una politica
-- ni una pagina. Al salir, se borra el vinculo.
--
-- Se descarto ampliar mis_restaurantes() para el superadmin: la usan 9
-- tablas, daria acceso de escritura a todo de forma permanente y silenciosa,
-- y ni siquiera resolveria el caso de uso (las paginas cargan el restaurante
-- con mi_restaurante_id(), que seguiria devolviendo NULL).
-- ============================================================


-- ------------------------------------------------------------
-- 1) LECTURA para el panel de admin
-- ------------------------------------------------------------
-- Sin esto, un superadmin sin restaurante vinculado ve VACIO el seguimiento
-- de planes y las estadisticas globales: las politicas existentes solo miran
-- mis_restaurantes(), que para el esta vacio. La lista de restaurantes si se
-- veia porque va por listar_restaurantes_admin() (SECURITY DEFINER).
-- Solo SELECT: para escribir sigue haciendo falta entrar en el panel.
-- Mismo patron que ya usan rate_limits, campanas_envios y solicitudes_upgrade.

drop policy if exists "Superadmin ve todos los restaurantes" on public.restaurantes;
create policy "Superadmin ve todos los restaurantes"
  on public.restaurantes for select
  using (soy_superadmin());

drop policy if exists "Superadmin ve todos los pedidos" on public.pedidos;
create policy "Superadmin ve todos los pedidos"
  on public.pedidos for select
  using (soy_superadmin());

-- OJO: esto amplia lo que ve el superadmin en consultas SIN filtro explicito.
-- Se reviso el panel: todas las consultas de pedidos filtran por
-- restaurante_id menos la del historial, que se ha corregido en el mismo
-- cambio. Al anadir consultas nuevas, filtrar SIEMPRE por restaurante_id y
-- no dejar RLS como unica defensa.


-- ------------------------------------------------------------
-- 2) ENTRAR / SALIR del panel de un restaurante
-- ------------------------------------------------------------
-- usuarios_restaurante no tiene politicas de INSERT ni DELETE (a proposito:
-- nadie deberia poder vincularse solo). Por eso va por estas dos funciones,
-- que comprueban soy_superadmin() antes de nada.

create or replace function public.entrar_en_restaurante(p_restaurante_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not soy_superadmin() then
    raise exception 'Solo el superadmin puede entrar en el panel de un restaurante';
  end if;

  if not exists (select 1 from restaurantes where id = p_restaurante_id) then
    raise exception 'Ese restaurante no existe';
  end if;

  -- Un vinculo cada vez. mi_restaurante_id() hace LIMIT 1 SIN ORDER BY: con
  -- dos filas el panel apuntaria a un restaurante cualquiera de los dos.
  delete from usuarios_restaurante where usuario_id = auth.uid();

  insert into usuarios_restaurante (usuario_id, restaurante_id, rol)
  values (auth.uid(), p_restaurante_id, 'admin');
end;
$function$;

create or replace function public.salir_del_restaurante()
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- Guardado con soy_superadmin() tambien aqui: si no, un usuario normal
  -- podria borrar su propio vinculo y quedarse sin panel.
  if not soy_superadmin() then
    raise exception 'Solo el superadmin puede hacer esto';
  end if;

  delete from usuarios_restaurante where usuario_id = auth.uid();
end;
$function$;

revoke all on function public.entrar_en_restaurante(uuid) from public, anon;
revoke all on function public.salir_del_restaurante()      from public, anon;
grant execute on function public.entrar_en_restaurante(uuid) to authenticated;
grant execute on function public.salir_del_restaurante()      to authenticated;


-- PostgREST cachea el esquema: sin esto, las funciones recien creadas dan
-- "Could not find the function ... in the schema cache" al llamarlas desde
-- el panel. Paso el 2026-09-04.
notify pgrst, 'reload schema';
