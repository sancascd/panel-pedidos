-- =============================================================
-- Carta pública por restaurante  →  comandi.es/r/<slug>
-- =============================================================
-- Lectura pública SOLO-LECTURA de la carta, SIN tocar las RLS ni
-- exponer datos sensibles. En vez de abrir una política pública sobre
-- productos/categorias (la anon key es pública → fuga), se usa UNA
-- función SECURITY DEFINER que devuelve EXACTAMENTE los campos de la
-- carta y nada más. Aplicar en Supabase → SQL editor.

-- 1) Slug único por restaurante (para la URL bonita)
alter table restaurantes add column if not exists slug text;
create unique index if not exists restaurantes_slug_key
  on restaurantes (slug) where slug is not null;

-- Slug del primer cliente (Gran Muralla). Repetir/ajustar para otros.
update restaurantes
   set slug = 'gran-muralla'
 where lower(nombre) like '%gran muralla%'
   and slug is null;

-- Nº de WhatsApp para el botón "Pedir por WhatsApp" (solo si está vacío).
-- Ajusta el número si no es este.
update restaurantes
   set whatsapp_numero = coalesce(nullif(trim(whatsapp_numero), ''), '+34614038468')
 where slug = 'gran-muralla';

-- 2) Función pública: devuelve la carta como JSON.
--    - SECURITY DEFINER: corre como owner (se salta RLS) pero SOLO
--      devuelve los campos de abajo → exposición controlada.
--    - Solo productos disponibles, solo el restaurante del slug.
create or replace function carta_publica(p_slug text)
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
    'categorias', coalesce((
      select json_agg(cat order by cat_orden)
      from (
        select
          c.orden as cat_orden,
          json_build_object(
            'nombre', c.nombre,
            'productos', coalesce((
              select json_agg(
                       json_build_object(
                         'nombre',      p.nombre,
                         'descripcion', p.descripcion,
                         'precio',      p.precio
                       ) order by p.nombre)
              from productos p
              where p.categoria_id = c.id
                and p.restaurante_id = r.id
                and p.disponible = true
            ), '[]'::json)
          ) as cat
        from categorias c
        where c.restaurante_id = r.id
      ) sub
    ), '[]'::json)
  )
  from restaurantes r
  where r.slug = p_slug;
$$;

-- Solo lectura pública de la carta (no de nada más).
grant execute on function carta_publica(text) to anon;
