-- =============================================================
-- El número de plato pasa a TEXTO (admite 6b, 6c, 12A...)
-- =============================================================
-- El restaurante numera las variantes con letra (varios rollos = 6b, 6c),
-- así que `numero` no puede ser entero.
-- Ojo al ORDEN: por texto, "10" iría antes que "6". Se ordena por la parte
-- numérica y, a igualdad, por el texto completo (6b antes que 6c).
-- Aplicar en Supabase -> SQL editor.

alter table productos alter column numero type text using numero::text;

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
                     ) order by
                       nullif(regexp_replace(coalesce(p.numero, ''), '\D', '', 'g'), '')::int
                         nulls last,
                       p.numero nulls last,
                       p.nombre)
              from productos p
              where p.categoria_id = c.id and p.restaurante_id = r.id and p.disponible = true
            ), '[]'::json)) as cat
        from categorias c where c.restaurante_id = r.id
      ) sub
    ), '[]'::json))
  from restaurantes r where r.slug = p_slug;
$$;

grant execute on function carta_publica(text) to anon;
