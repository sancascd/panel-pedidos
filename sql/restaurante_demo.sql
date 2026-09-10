-- =============================================================
-- Restaurante de demostraciones ("Comandi Demo")
-- =============================================================
-- Monta un restaurante completo para enseñar el producto, colgado del número
-- ANTIGUO (+34 614 03 84 68), que sigue CONNECTED en Meta y ya no apunta a
-- ningún cliente. El enrutado del bot es por `meta_phone_number_id`, así que
-- con esto basta: no hay que tocar el bot ni reiniciar Railway.
--
-- La carta, los horarios y los menús se COPIAN de Gran Muralla. Su carta es
-- pública y aquí va bajo otro nombre, así que no descubre nada suyo.
--
-- ⚠️ Se puede repetir, PERO BORRANDO: si el demo ya existe, lo borra entero
--    (con sus pedidos de prueba) y lo vuelve a crear. Nunca toca a Gran Muralla.
--
-- Aplicar en Supabase -> SQL editor.

-- ---------- 1. La marca de demo ----------
-- Sin esto, los pedidos de prueba entran en las estadísticas del admin y el
-- demo aparece como un cliente más en el seguimiento de planes.
alter table restaurantes
  add column if not exists es_demo boolean not null default false;

comment on column restaurantes.es_demo is
  'Restaurante de demostración: no es un cliente. Se excluye de estadísticas y del seguimiento de planes.';

-- ---------- 2. El duplicado ----------
do $$
declare
  -- Lo que define el demo. Si algún día hace falta otro, se cambia aquí.
  c_nombre text := 'Comandi Demo';
  c_slug   text := 'comandi-demo';
  c_phone  text := '1277222835479879';   -- meta_phone_number_id del número viejo
  c_numero text := '+34614038468';
  c_origen text := 'gran-muralla';       -- de quién se copia la carta

  v_origen uuid;
  v_nuevo  uuid := gen_random_uuid();
  n_cat int; n_prod int; n_hor int; n_menu int; n_gru int; n_op int;
begin
  select id into v_origen from restaurantes where slug = c_origen;
  if v_origen is null then
    raise exception 'No encuentro el restaurante de origen (slug %)', c_origen;
  end if;

  -- El número no puede estar ocupado por un cliente de verdad.
  if exists (select 1 from restaurantes
              where meta_phone_number_id = c_phone and slug <> c_slug) then
    raise exception 'El phone_number_id % ya lo usa otro restaurante. Parado.', c_phone;
  end if;

  -- Borrado del demo anterior, si lo hubiera. Solo si es_demo: así una errata
  -- en el slug nunca puede llevarse por delante a un cliente.
  delete from restaurantes where slug = c_slug and es_demo;
  if exists (select 1 from restaurantes where slug = c_slug) then
    raise exception 'Ya hay un restaurante con slug % que NO es demo. Parado.', c_slug;
  end if;

  -- ----- el restaurante -----
  -- jsonb_populate_record copia TODAS las columnas sin tener que listarlas: el
  -- día que se añada una al esquema, este script la arrastra solo.
  insert into restaurantes
  select x.* from restaurantes r
  cross join lateral jsonb_populate_record(null::restaurantes,
    to_jsonb(r) || jsonb_build_object(
      'id',                   v_nuevo,
      'nombre',               c_nombre,
      'slug',                 c_slug,
      'meta_phone_number_id', c_phone,
      'whatsapp_numero',      c_numero,
      'es_demo',              true,
      'estado',               'aprobado',
      'resenas_activas',      false,   -- que no pida resenas por un pedido falso
      -- Todo lo que identifica al local de Gran Muralla se va fuera: si no,
      -- el demo daria SU telefono, SU direccion de recogida y SU enlace.
      'telefono',             null,
      'email_contacto',       null,    -- los avisos de plan les llegarian a ellos
      'carta_url',            null,
      'carta_pdf_url',        null,
      'carta_tipo',           'comandi',
      'direccion',            'Calle Demostracion, 1, 14001 Cordoba',
      'creado_en',            now(),
      'plan_iniciado_en',     now()
    )) x
  where r.id = v_origen;

  -- Los textos del bot llevan el nombre escrito DENTRO, no lo componen: hay que
  -- sustituirlo a mano o el demo se presentaria como Gran Muralla.
  update restaurantes set
    descripcion        = replace(coalesce(descripcion, ''),        'Gran Muralla', c_nombre),
    mensaje_bienvenida = replace(coalesce(mensaje_bienvenida, ''), 'Gran Muralla', c_nombre),
    mensaje_cerrado    = replace(coalesce(mensaje_cerrado, ''),    'Gran Muralla', c_nombre),
    mensaje_despedida  = replace(coalesce(mensaje_despedida, ''),  'Gran Muralla', c_nombre)
  where id = v_nuevo;

  -- Red de seguridad: si queda el nombre del cliente en algun texto, avisa.
  if exists (select 1 from restaurantes
              where id = v_nuevo
                and to_jsonb(restaurantes)::text ilike '%gran muralla%') then
    raise warning 'OJO: queda "Gran Muralla" en algun campo del demo. Revisalo en Ajustes.';
  end if;

  -- ----- categorías -----
  create temp table map_cat (viejo uuid primary key, nuevo uuid not null default gen_random_uuid())
    on commit drop;
  insert into map_cat (viejo) select id from categorias where restaurante_id = v_origen;

  insert into categorias
  select x.* from categorias c
  join map_cat m on m.viejo = c.id
  cross join lateral jsonb_populate_record(null::categorias,
    to_jsonb(c) || jsonb_build_object('id', m.nuevo, 'restaurante_id', v_nuevo)) x;
  get diagnostics n_cat = row_count;

  -- ----- platos -----
  create temp table map_prod (viejo uuid primary key, nuevo uuid not null default gen_random_uuid())
    on commit drop;
  insert into map_prod (viejo) select id from productos where restaurante_id = v_origen;

  insert into productos
  select x.* from productos p
  join map_prod mp on mp.viejo = p.id
  left join map_cat mc on mc.viejo = p.categoria_id
  cross join lateral jsonb_populate_record(null::productos,
    to_jsonb(p) || jsonb_build_object(
      'id', mp.nuevo, 'restaurante_id', v_nuevo, 'categoria_id', mc.nuevo)) x;
  get diagnostics n_prod = row_count;

  -- ----- horarios -----
  insert into horarios
  select x.* from horarios h
  cross join lateral jsonb_populate_record(null::horarios,
    to_jsonb(h) || jsonb_build_object('id', gen_random_uuid(), 'restaurante_id', v_nuevo)) x
  where h.restaurante_id = v_origen;
  get diagnostics n_hor = row_count;

  -- ----- menús del día -----
  create temp table map_menu (viejo uuid primary key, nuevo uuid not null default gen_random_uuid())
    on commit drop;
  insert into map_menu (viejo) select id from menus where restaurante_id = v_origen;

  insert into menus
  select x.* from menus mu
  join map_menu m on m.viejo = mu.id
  cross join lateral jsonb_populate_record(null::menus,
    to_jsonb(mu) || jsonb_build_object('id', m.nuevo, 'restaurante_id', v_nuevo)) x;
  get diagnostics n_menu = row_count;

  create temp table map_gru (viejo uuid primary key, nuevo uuid not null default gen_random_uuid())
    on commit drop;
  insert into map_gru (viejo) select id from menu_grupos where restaurante_id = v_origen;

  insert into menu_grupos
  select x.* from menu_grupos g
  join map_gru mg on mg.viejo = g.id
  join map_menu mm on mm.viejo = g.menu_id
  cross join lateral jsonb_populate_record(null::menu_grupos,
    to_jsonb(g) || jsonb_build_object(
      'id', mg.nuevo, 'restaurante_id', v_nuevo, 'menu_id', mm.nuevo)) x;
  get diagnostics n_gru = row_count;

  -- Las opciones apuntan al plato de la carta (para que el ticket salga con su
  -- número): hay que remapear producto_id, no copiarlo tal cual.
  insert into menu_opciones
  select x.* from menu_opciones o
  join map_gru mg on mg.viejo = o.grupo_id
  left join map_prod mp on mp.viejo = o.producto_id
  cross join lateral jsonb_populate_record(null::menu_opciones,
    to_jsonb(o) || jsonb_build_object(
      'id', gen_random_uuid(), 'restaurante_id', v_nuevo,
      'grupo_id', mg.nuevo, 'producto_id', mp.nuevo)) x
  where o.restaurante_id = v_origen;
  get diagnostics n_op = row_count;

  raise notice 'Demo creado: % (%)', c_nombre, v_nuevo;
  raise notice 'Copiado de %: % categorias, % platos, % dias de horario, % menus, % grupos, % opciones',
    c_origen, n_cat, n_prod, n_hor, n_menu, n_gru, n_op;
  raise notice 'Numero: % (phone_number_id %)', c_numero, c_phone;
end $$;

-- ---------- 3. Comprobación ----------
select nombre, slug, es_demo, estado, whatsapp_numero, meta_phone_number_id,
       (select count(*) from productos p where p.restaurante_id = r.id) as platos,
       (select count(*) from menus     m where m.restaurante_id = r.id) as menus
  from restaurantes r
 where r.es_demo;
