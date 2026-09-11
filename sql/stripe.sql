-- =============================================================
-- Cobro con Stripe: lo que guarda cada restaurante
-- =============================================================
-- Stripe es quien sabe si un restaurante está al día; aquí se guarda una
-- copia para enseñarlo en el panel y en el admin. La escribe SOLO el bot (con
-- la clave de servicio), al recibir los avisos firmados de Stripe.
--
-- Aplicar en Supabase -> SQL editor. Se puede repetir.

alter table public.restaurantes
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists estado_cobro           text not null default 'sin_alta',
  add column if not exists cobro_actualizado_en   timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'estado_cobro_valido') then
    alter table public.restaurantes
      add constraint estado_cobro_valido
      check (estado_cobro in ('sin_alta', 'enlace_enviado', 'activo', 'impago', 'cancelado'));
  end if;
end $$;

create index if not exists idx_restaurantes_stripe_cliente on public.restaurantes (stripe_customer_id);

comment on column public.restaurantes.estado_cobro is
  'sin_alta | enlace_enviado | activo | impago | cancelado. Lo pone el bot con los avisos de Stripe.';


-- ---------- Nadie más puede tocar estos campos ----------
-- El restaurante puede editar su propia fila (Ajustes), y sin esto podría
-- ponerse «activo» a sí mismo. El admin tampoco: su verdad es Stripe.
-- Se deja pasar a la clave de servicio (el bot) y al editor SQL de Supabase
-- (usuario postgres), para poder arreglar algo a mano si hiciera falta.
create or replace function public.proteger_campos_cobro()
returns trigger
language plpgsql
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin')
     and (new.stripe_customer_id     is distinct from old.stripe_customer_id
       or new.stripe_subscription_id is distinct from old.stripe_subscription_id
       or new.estado_cobro           is distinct from old.estado_cobro
       or new.cobro_actualizado_en   is distinct from old.cobro_actualizado_en) then
    raise exception 'Los datos de cobro solo los actualiza Stripe';
  end if;
  return new;
end;
$function$;

drop trigger if exists proteger_campos_cobro on public.restaurantes;
create trigger proteger_campos_cobro
  before update on public.restaurantes
  for each row execute function public.proteger_campos_cobro();

notify pgrst, 'reload schema';

-- Cómo queda:
select nombre, plan, estado_cobro, stripe_customer_id is not null as tiene_cliente_stripe
  from public.restaurantes
 where not es_demo
 order by nombre;
