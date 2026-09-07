-- =============================================================
-- Menús públicos por restaurante  →  comandi.es/r/<slug>/menu
-- =============================================================
-- Misma idea que carta_publica: NO se abre una política pública sobre las
-- tablas de menús (la anon key va en el bundle, seria una fuga), sino una
-- función SECURITY DEFINER que devuelve exactamente lo que hace falta pintar
-- y nada más.
--
-- Requiere sql/menus.sql. Aplicar en Supabase → SQL editor.

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
                        -- El número de plato es lo que hace inequívoco el
                        -- pedido cuando vuelve por WhatsApp.
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

notify pgrst, 'reload schema';
