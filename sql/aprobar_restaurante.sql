-- ============================================================
-- APROBAR / RECHAZAR UN RESTAURANTE DESDE /admin
-- ============================================================
-- Los botones "Aprobar" y "Rechazar" de /admin llaman a estas funciones, pero
-- nunca se habian creado en la BD (Gran Muralla se aprobo a mano por SQL).
-- Van por funcion SECURITY DEFINER por lo mismo que gestion_planes.sql: el
-- superadmin no tiene restaurantes vinculados y un UPDATE directo lo filtraria
-- RLS sin dar error.
--
-- Al aprobar un restaurante que estaba pendiente, el periodo del plan empieza
-- ese dia: se aprueba el dia de la firma.
--
-- Habia unas versiones viejas con el parametro `restaurante_id_in` (el panel
-- manda `p_restaurante_id`, asi que no las encontraba) que ademas ponian
-- estados que ya no existen ('activo', 'suspendido'). Se borran primero.

drop function if exists public.aprobar_restaurante(uuid);
drop function if exists public.rechazar_restaurante(uuid);

create or replace function public.aprobar_restaurante(p_restaurante_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not soy_superadmin() then
    raise exception 'Solo el superadmin puede aprobar restaurantes';
  end if;

  update restaurantes
     set plan_iniciado_en = case when estado = 'pendiente' then now() else plan_iniciado_en end,
         estado           = 'aprobado'
   where id = p_restaurante_id;

  if not found then
    raise exception 'Ese restaurante no existe';
  end if;
end;
$function$;

create or replace function public.rechazar_restaurante(p_restaurante_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not soy_superadmin() then
    raise exception 'Solo el superadmin puede rechazar restaurantes';
  end if;

  update restaurantes set estado = 'rechazado' where id = p_restaurante_id;

  if not found then
    raise exception 'Ese restaurante no existe';
  end if;
end;
$function$;

revoke all on function public.aprobar_restaurante(uuid) from public, anon;
revoke all on function public.rechazar_restaurante(uuid) from public, anon;
grant execute on function public.aprobar_restaurante(uuid) to authenticated;
grant execute on function public.rechazar_restaurante(uuid) to authenticated;

notify pgrst, 'reload schema';
