-- =============================================================
-- CARGO POR BOLSA
-- =============================================================
-- Cargo fijo por pedido que cobran algunos restaurantes (Chino Feliz: 0,10 €).
-- Se suma al total que paga el cliente, sale como línea «Bolsa» y NO cuenta
-- para el pedido mínimo. Cada pedido guarda la bolsa que se le cobró, así un
-- cambio de precio no toca los pedidos antiguos.
--
-- Aplicar ANTES de publicar el bot. Se puede repetir.

alter table public.restaurantes
  add column if not exists cargo_bolsa numeric(6,2) not null default 0;
alter table public.pedidos
  add column if not exists cargo_bolsa numeric(6,2) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'restaurantes_cargo_bolsa_valido') then
    alter table public.restaurantes
      add constraint restaurantes_cargo_bolsa_valido check (cargo_bolsa >= 0 and cargo_bolsa <= 5);
  end if;
end $$;

update public.restaurantes set cargo_bolsa = 0.10 where slug = 'chino-feliz';

notify pgrst, 'reload schema';

select nombre, cargo_bolsa from public.restaurantes where cargo_bolsa > 0 order by nombre;
