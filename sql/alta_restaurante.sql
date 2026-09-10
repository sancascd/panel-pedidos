-- =============================================================
-- ALTA DE UN RESTAURANTE NUEVO
-- =============================================================
-- Crea la ficha vacía de un cliente, con los valores correctos. Después
-- vienen la carta, los horarios y su cuenta (`dar_acceso_restaurante.sql`).
--
-- Existe porque Gran Muralla se creó a mano y acabó con `estado = 'activo'`,
-- que el panel no entiende: desapareció del seguimiento de planes y sus
-- pedidos no contaban para facturar. Aquí eso no puede pasar.
--
-- Rellenar el bloque de arriba y ejecutar entero en Supabase -> SQL editor.
-- Es seguro repetirlo: si algo ya está ocupado, se para sin tocar nada.

do $$
declare
  -- ----- RELLENAR -----
  c_nombre   text := 'RELLENAR';   -- 'Restaurante China Town'
  c_slug     text := 'RELLENAR';   -- 'china-town', va en la URL de su carta
  c_numero   text := 'RELLENAR';   -- '+34...', el WhatsApp que verán sus clientes
  c_phone_id text := 'RELLENAR';   -- meta_phone_number_id, el número largo de Meta
  c_telefono text := 'RELLENAR';   -- su fijo de siempre
  c_direccion text := 'RELLENAR';
  c_email    text := null;         -- para los avisos de plan
  -- --------------------

  v_id uuid := gen_random_uuid();
begin
  -- Con datos de ejemplo dentro, este script se ejecuta tal cual y crea una
  -- ficha con un phone_number_id falso: el restaurante no recibe nada y nadie
  -- se entera hasta que lo prueba. Paso el 2026-09-10, de ahi este guarda.
  if 'RELLENAR' in (c_nombre, c_slug, c_numero, c_phone_id) then
    raise exception 'Hay campos sin rellenar arriba. Parado.';
  end if;
  if coalesce(c_nombre, '') = '' or coalesce(c_slug, '') = '' then
    raise exception 'Faltan el nombre o el slug';
  end if;

  -- El slug va en la URL pública de la carta.
  if c_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'El slug solo admite minúsculas, números y guiones: %', c_slug;
  end if;
  if exists (select 1 from restaurantes where slug = c_slug) then
    raise exception 'Ya hay un restaurante con el slug %', c_slug;
  end if;

  -- Lo más importante de todo: el bot enruta los mensajes que entran POR
  -- meta_phone_number_id. Repetido, los pedidos de un cliente aparecerían en
  -- el panel de otro.
  if exists (select 1 from restaurantes where meta_phone_number_id = c_phone_id) then
    raise exception 'Ese meta_phone_number_id ya lo usa otro restaurante. Parado.';
  end if;
  if exists (select 1 from restaurantes where whatsapp_numero = c_numero) then
    raise exception 'Ese número de WhatsApp ya lo usa otro restaurante. Parado.';
  end if;

  insert into restaurantes (
    id, nombre, slug, whatsapp_numero, meta_phone_number_id,
    telefono, direccion, email_contacto,
    estado, plan, pedidos_incluidos, plan_iniciado_en,
    carta_tipo, acepta_efectivo, acepta_tarjeta, resenas_activas, es_demo
  ) values (
    v_id, c_nombre, c_slug, c_numero, c_phone_id,
    nullif(c_telefono, ''), nullif(c_direccion, ''), nullif(lower(c_email), ''),
    -- 'pendiente' a propósito: durante la implementación todavía NO son
    -- clientes (no han firmado el contrato de servicio). Así no salen en el
    -- seguimiento de planes como si hubiera que cobrarles. El día que firman
    -- se aprueban desde /admin.
    'pendiente',
    'basico', 1000,
    -- Ancla del periodo de facturación. Se pone ahora para que el panel no
    -- tenga que lidiar con un nulo, PERO hay que volver a ponerla el día de
    -- la puesta en marcha (paso "fecha-inicio" de su lista de alta).
    now(),
    'comandi', true, true,
    -- Las reseñas se encienden cuando ya reciban pedidos de verdad.
    false, false
  );

  raise notice 'Creado % (%). Slug: %', c_nombre, v_id, c_slug;
  raise notice 'Su carta publica quedara en https://comandi.es/r/%/carta', c_slug;
  raise notice 'AHORA: cargar carta (revisando que no haya alcohol), horarios y su cuenta.';
end $$;

-- Comprobación: debe salir 'pendiente' y con el phone_number_id puesto.
select nombre, slug, estado, plan, pedidos_incluidos,
       whatsapp_numero, meta_phone_number_id, es_demo
  from restaurantes
 order by creado_en desc
 limit 3;
