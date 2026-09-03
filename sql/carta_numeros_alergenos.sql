-- =============================================================
-- Número de plato + alérgenos
-- =============================================================
-- - `numero`: el número de la carta física (en cocina trabajan por números).
--   Va en su propio campo, NO dentro del nombre, para no romper el matcheo
--   del bot y poder renumerar sin reescribir platos.
-- - Alérgenos: los 14 oficiales de la UE, separando lo que CONTIENE de las
--   TRAZAS ("puede contener"), que legalmente no es lo mismo.
-- Aplicar en Supabase -> SQL editor.

alter table productos add column if not exists numero integer;
alter table productos add column if not exists alergenos_contiene text[] not null default '{}';
alter table productos add column if not exists alergenos_trazas   text[] not null default '{}';

create index if not exists productos_numero_idx on productos (restaurante_id, numero);

-- La carta pública ahora devuelve también número y alérgenos, y ordena por
-- número (los que no tienen, al final por nombre).
create or replace function carta_publica(p_slug text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'nombre', r.nombre, 'slug', r.slug, 'whatsapp', r.whatsapp_numero,
    'categorias', coalesce((
      select json_agg(cat order by cat_orden)
      from (
        select c.orden as cat_orden,
          json_build_object('nombre', c.nombre,
            'productos', coalesce((
              select json_agg(json_build_object(
                       'nombre', p.nombre,
                       'descripcion', p.descripcion,
                       'precio', p.precio,
                       'numero', p.numero,
                       'contiene', p.alergenos_contiene,
                       'trazas', p.alergenos_trazas
                     ) order by p.numero nulls last, p.nombre)
              from productos p
              where p.categoria_id = c.id and p.restaurante_id = r.id and p.disponible = true
            ), '[]'::json)) as cat
        from categorias c where c.restaurante_id = r.id
      ) sub
    ), '[]'::json))
  from restaurantes r where r.slug = p_slug;
$$;

grant execute on function carta_publica(text) to anon;
