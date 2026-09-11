-- =============================================================
-- Menús: lo que INCLUYE un menú, enlazado a la carta
-- =============================================================
-- Cocina se guia por el numero del plato. En un menu con eleccion, cada opcion
-- ya puede enlazarse a su plato de la carta. Pero en un menu CERRADO ("Menu
-- para 3 personas") lo que lleva estaba escrito como texto libre en la
-- descripcion, asi que el ticket salia con los platos pero sin numeros.
--
-- Ahora cada menu puede tener sus PLATOS FIJOS: plato de la carta (con su
-- numero) y cantidad. Los que no estan en la carta (bebida, postre) van como
-- texto, sin numero, igual que las opciones "solo menu".
--
-- Se puede repetir: la carga de China Town borra y vuelve a crear sus platos.
-- Aplicar en Supabase -> SQL editor.

-- ---------- 1. La tabla ----------
create table if not exists public.menu_platos (
  id              uuid primary key default gen_random_uuid(),
  menu_id         uuid not null references public.menus(id) on delete cascade,
  -- Repetido a proposito, como en grupos y opciones: la politica de RLS se
  -- escribe sin join.
  restaurante_id  uuid not null references public.restaurantes(id) on delete cascade,
  -- Null = no esta en la carta (bebida, postre...): sale en el ticket sin numero.
  producto_id     uuid references public.productos(id) on delete set null,
  nombre          text not null,
  cantidad        smallint not null default 1 check (cantidad between 1 and 99),
  orden           smallint not null default 0
);

create index if not exists menu_platos_menu_idx on public.menu_platos (menu_id, orden);

comment on table public.menu_platos is
  'Lo que incluye un menu cerrado: cada plato con su cantidad, enlazado a la carta para que el ticket de cocina lleve su numero.';

-- ---------- 2. Permisos: el mismo patron que el resto de tablas de menus ----------
-- restaurante_id in mis_restaurantes(), y NADA de soy_superadmin(): para tocar
-- los menus de un cliente se entra en su panel (ver sql/menus_rls_alineado.sql).
alter table public.menu_platos enable row level security;

drop policy if exists "gestionar mis platos de menu" on public.menu_platos;
create policy "gestionar mis platos de menu" on public.menu_platos
  for all  using (restaurante_id in (select mis_restaurantes()))
  with check (restaurante_id in (select mis_restaurantes()));


-- ---------- 3. La web publica de menus, con los platos ----------
create or replace function menus_publicos(p_slug text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'nombre',   r.nombre,
    'slug',     r.slug,
    'whatsapp', r.whatsapp_numero,
    'horarios', coalesce((
      select json_agg(json_build_object(
        'dia_semana',      h.dia_semana,
        'cerrado',         h.cerrado,
        'manana_apertura', h.manana_apertura,
        'manana_cierre',   h.manana_cierre,
        'noche_apertura',  h.noche_apertura,
        'noche_cierre',    h.noche_cierre
      ) order by h.dia_semana)
      from horarios h where h.restaurante_id = r.id
    ), '[]'::json),
    'menus', coalesce((
      select json_agg(m order by m_orden)
      from (
        select
          mn.orden as m_orden,
          json_build_object(
            'id',          mn.id,
            'nombre',      mn.nombre,
            'descripcion', mn.descripcion,
            'precio',      mn.precio,
            'dias_semana', mn.dias_semana,
            'turno',       mn.turno,
            'grupos', coalesce((
              select json_agg(g order by g_orden)
              from (
                select
                  gr.orden as g_orden,
                  json_build_object(
                    'nombre', gr.nombre,
                    'opciones', coalesce((
                      select json_agg(json_build_object(
                        'nombre',     op.nombre,
                        'subgrupo',   op.subgrupo,
                        'suplemento', op.suplemento,
                        'numero',     p.numero
                      ) order by op.orden)
                      from menu_opciones op
                      left join productos p on p.id = op.producto_id
                      where op.grupo_id = gr.id
                    ), '[]'::json)
                  ) as g
                from menu_grupos gr
                where gr.menu_id = mn.id
              ) gs
            ), '[]'::json),
            -- Lo que incluye un menu cerrado. La web lo pinta como la lista
            -- "Incluye"; el numero no se le enseña al cliente, pero va.
            'platos', coalesce((
              select json_agg(json_build_object(
                'nombre',   pl.nombre,
                'cantidad', pl.cantidad,
                'numero',   p.numero
              ) order by pl.orden)
              from menu_platos pl
              left join productos p on p.id = pl.producto_id
              where pl.menu_id = mn.id
            ), '[]'::json)
          ) as m
        from menus mn
        where mn.restaurante_id = r.id and mn.activo = true
      ) ms
    ), '[]'::json)
  )
  from restaurantes r
  where r.slug = p_slug
$$;

revoke all on function menus_publicos(text) from public;
grant execute on function menus_publicos(text) to anon, authenticated;


-- ---------- 4. China Town: sus menus cerrados, enlazados por NUMERO ----------
-- Se enlaza por el numero de carta, no por el nombre: es lo que usa cocina y
-- no depende de como este escrito el plato. Si un numero no existiera en su
-- carta, el insert falla (nombre nulo) en vez de dejar un plato mudo.
delete from public.menu_platos
 where menu_id in (
   select m.id from menus m join restaurantes r on r.id = m.restaurante_id
    where r.slug = 'china-town' and m.nombre like 'Menú para % personas');

with rest as (select id from restaurantes where slug = 'china-town'),
datos(menu, ord, cant, num, libre) as (values
  ('Menú para 2 personas', 1, 2, '15', null),
  ('Menú para 2 personas', 2, 1, '10', null),
  ('Menú para 2 personas', 3, 1, '24', null),
  ('Menú para 2 personas', 4, 1, '62', null),
  ('Menú para 2 personas', 5, 1, '41', null),
  ('Menú para 2 personas', 6, 1, null, 'Bebida y postre'),

  ('Menú para 3 personas', 1, 3, '15', null),
  ('Menú para 3 personas', 2, 1, '10', null),
  ('Menú para 3 personas', 3, 1, '24', null),
  ('Menú para 3 personas', 4, 1, '62', null),
  ('Menú para 3 personas', 5, 1, '41', null),
  ('Menú para 3 personas', 6, 1, '51', null),
  ('Menú para 3 personas', 7, 1, null, 'Bebida y postre'),

  ('Menú para 4 personas', 1, 4, '15', null),
  ('Menú para 4 personas', 2, 1, '10', null),
  -- En la carta impresa pone "fideos fritos con 3 delicias", pero el
  -- restaurante confirma (2026-09-11) que es un segundo arroz frito.
  ('Menú para 4 personas', 3, 2, '24', null),
  ('Menú para 4 personas', 4, 1, '41', null),
  ('Menú para 4 personas', 5, 1, '62', null),
  ('Menú para 4 personas', 6, 1, '90', null),
  ('Menú para 4 personas', 7, 1, null, 'Bebida y postre'),

  ('Menú para 5 personas', 1, 5, '15', null),
  ('Menú para 5 personas', 2, 2, '10', null),
  ('Menú para 5 personas', 3, 2, '24', null),
  ('Menú para 5 personas', 4, 1, '62', null),
  ('Menú para 5 personas', 5, 1, '41', null),
  ('Menú para 5 personas', 6, 1, '51', null),
  ('Menú para 5 personas', 7, 1, '22', null),
  ('Menú para 5 personas', 8, 1, '90', null),
  ('Menú para 5 personas', 9, 1, null, 'Bebida y postre'),

  ('Menú para 6 personas', 1, 6, '15', null),
  ('Menú para 6 personas', 2, 2, '10', null),
  ('Menú para 6 personas', 3, 2, '24', null),
  ('Menú para 6 personas', 4, 1, '62', null),
  ('Menú para 6 personas', 5, 1, '41', null),
  ('Menú para 6 personas', 6, 1, '51', null),
  ('Menú para 6 personas', 7, 1, '90', null),
  ('Menú para 6 personas', 8, 1, '77', null),
  ('Menú para 6 personas', 9, 1, '22', null),
  ('Menú para 6 personas', 10, 1, null, 'Bebida y postre')
)
insert into public.menu_platos (menu_id, restaurante_id, producto_id, nombre, cantidad, orden)
select m.id, r.id, p.id, coalesce(p.nombre, d.libre), d.cant, d.ord
  from datos d
  cross join rest r
  join menus m on m.restaurante_id = r.id and m.nombre = d.menu
  left join productos p on p.restaurante_id = r.id and p.numero = d.num;

notify pgrst, 'reload schema';


-- ---------- 5. Comprobaciones ----------
-- Los platos de China Town, con su numero:
select m.nombre as menu, pl.cantidad, p.numero, pl.nombre
  from menu_platos pl
  join menus m on m.id = pl.menu_id
  left join productos p on p.id = pl.producto_id
 where m.restaurante_id = (select id from restaurantes where slug = 'china-town')
 order by m.orden, pl.orden;

-- Opciones de menus con eleccion que siguen SIN enlazar a la carta (salen en
-- el ticket sin numero). Pasar el resultado para enlazarlas:
select r.slug, mn.nombre as menu, g.nombre as grupo, o.nombre as opcion
  from menu_opciones o
  join menu_grupos g on g.id = o.grupo_id
  join menus mn on mn.id = g.menu_id
  join restaurantes r on r.id = o.restaurante_id
 where o.producto_id is null
 order by r.slug, mn.orden, g.orden, o.orden;
