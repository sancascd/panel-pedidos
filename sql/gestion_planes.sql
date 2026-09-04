-- ============================================================
-- GESTIONAR EL PLAN DE UN RESTAURANTE DESDE /admin
-- ============================================================
-- Hasta Stripe (Fase 2) el cobro es manual, pero el plan tiene que estar bien
-- puesto en la BD: de el salen el contador de pedidos incluidos, el overage y
-- los avisos de consumo al 80/100/120%.
--
-- Va por funcion y no por UPDATE directo porque la politica de UPDATE de
-- restaurantes es "id IN mis_restaurantes()", y el superadmin no tiene
-- restaurantes vinculados. Un update directo NO daria error: PostgREST
-- responde OK aunque RLS haya filtrado todas las filas, asi que el cambio se
-- perderia en silencio. Le pasaba ya a aprobarUpgrade() en el panel.

create or replace function public.cambiar_plan_restaurante(
  p_restaurante_id uuid,
  p_plan           text,
  p_inicio         timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not soy_superadmin() then
    raise exception 'Solo el superadmin puede cambiar el plan de un restaurante';
  end if;

  if p_plan not in ('basico', 'pro', 'premium') then
    raise exception 'Plan no valido: %', p_plan;
  end if;

  -- plan_iniciado_en es el ancla del periodo de facturacion: si no se indica,
  -- se respeta el que hubiera y solo se estrena si estaba vacio.
  update restaurantes
     set plan             = p_plan,
         plan_iniciado_en = coalesce(p_inicio, plan_iniciado_en, now())
   where id = p_restaurante_id;

  if not found then
    raise exception 'Ese restaurante no existe';
  end if;
end;
$function$;

revoke all on function public.cambiar_plan_restaurante(uuid, text, timestamptz) from public, anon;
grant execute on function public.cambiar_plan_restaurante(uuid, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';
