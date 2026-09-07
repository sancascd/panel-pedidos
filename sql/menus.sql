-- =============================================================
-- Menús (menú del día y similares)
-- =============================================================
-- Un menú es un precio cerrado con varios GRUPOS ("Primer plato", "Bebida"...)
-- y el cliente escoge una OPCIÓN de cada grupo.
--
-- Aplicar en Supabase -> SQL editor.

create table if not exists menus (
  id              uuid primary key default gen_random_uuid(),
  restaurante_id  uuid not null references restaurantes(id) on delete cascade,
  nombre          text not null,
  descripcion     text,
  precio          numeric(10,2) not null,
  activo          boolean not null default true,
  -- Cuándo se sirve. 1=lunes ... 7=domingo. Por defecto, de lunes a viernes.
  dias_semana     smallint[] not null default '{1,2,3,4,5}',
  -- 'manana' | 'noche' | null (a cualquier hora que estén abiertos).
  turno           text,
  orden           smallint not null default 0,
  creado_en       timestamptz not null default now()
);

create table if not exists menu_grupos (
  id              uuid primary key default gen_random_uuid(),
  menu_id         uuid not null references menus(id) on delete cascade,
  -- Repetido a propósito: permite escribir la política de RLS sin un join.
  restaurante_id  uuid not null references restaurantes(id) on delete cascade,
  nombre          text not null,
  orden           smallint not null default 0
);

create table if not exists menu_opciones (
  id              uuid primary key default gen_random_uuid(),
  grupo_id        uuid not null references menu_grupos(id) on delete cascade,
  restaurante_id  uuid not null references restaurantes(id) on delete cascade,
  -- Enlazado a la carta: así el ticket sale con el número del plato, que es
  -- por lo que se guían en cocina. Si el plato solo existe dentro del menú,
  -- se queda a null y vale el `nombre`.
  producto_id     uuid references productos(id) on delete set null,
  nombre          text not null,
  -- Subapartado de la carta ("Pollo", "Ternera", "Sopa"). Sirve para partir en
  -- dos niveles los grupos que no caben: una lista de WhatsApp admite 10 filas,
  -- y el tercer plato de Gran Muralla tiene 13 platos.
  subgrupo        text,
  suplemento      numeric(10,2) not null default 0,
  orden           smallint not null default 0
);

create index if not exists menus_restaurante_idx      on menus (restaurante_id, activo);
create index if not exists menu_grupos_menu_idx       on menu_grupos (menu_id, orden);
create index if not exists menu_opciones_grupo_idx    on menu_opciones (grupo_id, orden);

-- ---------- RLS ----------
-- Mismo modelo que el resto: multi-tenant por restaurante_id, con el
-- superadmin como excepción de lectura/gestión. El bot usa service_role y se
-- salta esto. NUNCA una política USING(true) para `public`: la anon key va en
-- el bundle del panel.
alter table menus         enable row level security;
alter table menu_grupos   enable row level security;
alter table menu_opciones enable row level security;

drop policy if exists "Restaurante gestiona sus menus" on public.menus;
create policy "Restaurante gestiona sus menus" on public.menus
  for all using (restaurante_id = mi_restaurante_id() or soy_superadmin())
  with check    (restaurante_id = mi_restaurante_id() or soy_superadmin());

drop policy if exists "Restaurante gestiona sus grupos" on public.menu_grupos;
create policy "Restaurante gestiona sus grupos" on public.menu_grupos
  for all using (restaurante_id = mi_restaurante_id() or soy_superadmin())
  with check    (restaurante_id = mi_restaurante_id() or soy_superadmin());

drop policy if exists "Restaurante gestiona sus opciones" on public.menu_opciones;
create policy "Restaurante gestiona sus opciones" on public.menu_opciones
  for all using (restaurante_id = mi_restaurante_id() or soy_superadmin())
  with check    (restaurante_id = mi_restaurante_id() or soy_superadmin());

-- ---------- Lo que elige el cliente ----------
-- Una línea de pedido puede ser un menú. Las elecciones se guardan aquí como
-- JSON ([{grupo, nombre, numero}]) en vez de como líneas sueltas: así el total
-- sigue cuadrando (un menú es UN precio) y el ticket lo puede pintar agrupado.
alter table lineas_pedido
  add column if not exists menu_id        uuid references menus(id) on delete set null,
  add column if not exists menu_elecciones jsonb;

notify pgrst, 'reload schema';
