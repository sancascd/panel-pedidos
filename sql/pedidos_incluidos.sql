-- Limite de pedidos a medida por restaurante.
--
-- El plan define los pedidos incluidos (basico 1000, pro 1500, premium 3500),
-- pero a veces se pacta otra cosa con un cliente concreto. Esta columna, si
-- tiene valor, MANDA sobre la del plan.
--
-- NULL o 0 = usar el del plan (comportamiento de siempre).
--
-- ⚠️ Se respeta en DOS sitios y hay que tocar los dos:
--    · panel-pedidos/lib/planes.js  -> calcularConsumo()  (panel y /admin)
--    · bot-pedidos/index.js         -> cron de avisos por email 80/100/120%
-- Si solo se cambia uno, el restaurante veria un limite en su panel y
-- recibiria los avisos calculados con otro.

alter table public.restaurantes
  add column if not exists pedidos_incluidos integer;

comment on column public.restaurantes.pedidos_incluidos is
  'Pedidos incluidos pactados con este restaurante. NULL = usar los del plan.';


-- ------------------------------------------------------------
-- La RPC de gestion de planes acepta ahora el limite pactado.
-- ------------------------------------------------------------
-- Se mantiene el nombre y se anade el parametro al final con valor por
-- defecto, asi las llamadas antiguas (sin p_incluidos) siguen funcionando.

create or replace function public.cambiar_plan_restaurante(
  p_restaurante_id uuid,
  p_plan           text,
  p_inicio         timestamptz default null,
  p_incluidos      integer     default null
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

  if p_incluidos is not null and p_incluidos <= 0 then
    raise exception 'Los pedidos incluidos deben ser mayores que 0';
  end if;

  update restaurantes
     set plan              = p_plan,
         plan_iniciado_en  = coalesce(p_inicio, plan_iniciado_en, now()),
         pedidos_incluidos = p_incluidos   -- NULL = usar los del plan
   where id = p_restaurante_id;

  if not found then
    raise exception 'Ese restaurante no existe';
  end if;
end;
$function$;

revoke all on function public.cambiar_plan_restaurante(uuid, text, timestamptz, integer) from public, anon;
grant execute on function public.cambiar_plan_restaurante(uuid, text, timestamptz, integer) to authenticated;

notify pgrst, 'reload schema';
