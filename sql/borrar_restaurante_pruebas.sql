-- =============================================================
-- BORRAR UN RESTAURANTE DE PRUEBAS
-- =============================================================
-- Para limpiar restos de pruebas ("Pollo Frito Yeah" y similares). Borra el
-- restaurante y, en cascada, TODO lo que cuelga de él: carta, pedidos,
-- clientes, conversaciones, horarios, menús y el vínculo de su usuario.
--
-- No tiene vuelta atrás. Por eso va en dos pasos: primero se mira qué se
-- lleva por delante y sólo después se borra.
--
-- Aplicar en Supabase -> SQL editor, un paso cada vez.


-- ============ PASO 1: ¿qué hay ahí dentro? ============
-- Ejecutar SOLO esto primero y leer el resultado.

select id, nombre, slug, estado, es_demo,
       whatsapp_numero, meta_phone_number_id, creado_en
  from restaurantes
 where nombre ilike '%pollo frito%';

-- Cuenta las filas de TODAS las tablas que cuelgan de ese restaurante. Se
-- saca del catálogo en vez de escribir la lista a mano: así, si mañana hay
-- una tabla nueva con restaurante_id, aparece aquí sola y no se nos escapa.
select c.table_name as tabla,
       (xpath('/row/n/text()', query_to_xml(
          format('select count(*) as n from public.%I where restaurante_id = %L',
                 c.table_name,
                 (select id from restaurantes where nombre ilike '%pollo frito%' limit 1)),
          false, true, '')))[1]::text::bigint as filas
  from information_schema.columns c
 where c.table_schema = 'public'
   and c.column_name = 'restaurante_id'
 order by filas desc, tabla;

-- Las líneas de pedido cuelgan del pedido, no del restaurante.
select count(*) as lineas_de_pedido
  from lineas_pedido l
  join pedidos p on p.id = l.pedido_id
 where p.restaurante_id = (select id from restaurantes where nombre ilike '%pollo frito%' limit 1);

-- ¿Hay alguna cuenta de acceso vinculada? El borrado quita el vínculo, pero
-- el usuario se queda huérfano en Authentication y hay que borrarlo a mano.
select u.email, u.last_sign_in_at
  from usuarios_restaurante ur
  join auth.users u on u.id = ur.usuario_id
 where ur.restaurante_id = (select id from restaurantes where nombre ilike '%pollo frito%' limit 1);


-- ============ PASO 2: borrar ============
-- Ejecutar sólo cuando el paso 1 confirme que no hay nada que salvar.

do $$
declare
  c_nombre_como text := '%pollo frito%';   -- el mismo patrón del paso 1
  v_id   uuid;
  v_nom  text;
  v_peds int;
begin
  select id, nombre into v_id, v_nom
    from restaurantes where nombre ilike c_nombre_como;
  -- Sin `limit 1` a propósito: si el patrón casa con dos, esto revienta y no
  -- borra nada, que es justo lo que queremos.

  if v_id is null then
    raise exception 'No encuentro ningún restaurante que case con %', c_nombre_como;
  end if;

  -- Red de seguridad: un cliente de verdad SIEMPRE tiene su número de Meta,
  -- porque es por donde le entran los pedidos. Si esto lo tiene, no es un
  -- resto de pruebas y no se toca.
  if exists (select 1 from restaurantes
              where id = v_id and coalesce(meta_phone_number_id, '') <> '') then
    raise exception 'Ese restaurante tiene número de WhatsApp activo. No parece de pruebas: parado.';
  end if;

  if exists (select 1 from restaurantes where id = v_id and es_demo) then
    raise exception 'Ese es el restaurante de demostraciones. Parado.';
  end if;

  select count(*) into v_peds from pedidos where restaurante_id = v_id;

  delete from restaurantes where id = v_id;

  raise notice 'Borrado % (%), con % pedidos', v_nom, v_id, v_peds;
end $$;


-- ============ COMPROBACIÓN ============
select nombre, slug, estado, es_demo, meta_phone_number_id
  from restaurantes
 order by creado_en;
