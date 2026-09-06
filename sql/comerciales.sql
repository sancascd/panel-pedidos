-- ============================================================
-- RED COMERCIAL
-- ============================================================
-- Cada comercial registra los restaurantes que va a visitar. El sistema le
-- dice si estan libres o los tiene otro, y le reserva el contacto 30 dias
-- (clausula 3 de legal/COLABORACION_COMERCIAL.md).
--
-- ⚠️ PRIVACIDAD: un comercial SOLO puede ver sus propios contactos. Para saber
-- si un restaurante esta pillado usa comprobar_restaurante(), que responde
-- libre/reservado/cliente SIN decir quien lo tiene ni ningun dato. Nunca dar
-- SELECT abierto sobre contactos_comerciales: son datos de contacto de
-- terceros.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Tablas
-- ------------------------------------------------------------

create table if not exists public.comerciales (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid unique references auth.users(id) on delete cascade,
  nombre     text not null,
  telefono   text,
  email      text,
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

comment on table public.comerciales is
  'Red comercial. usuario_id enlaza con la cuenta de Supabase Auth con la que entra.';

create table if not exists public.contactos_comerciales (
  id                 uuid primary key default gen_random_uuid(),
  comercial_id       uuid not null references public.comerciales(id) on delete cascade,
  nombre_restaurante text not null,
  nombre_norm        text not null,
  poblacion          text,
  poblacion_norm     text,
  telefono           text,
  -- registrado -> visitado -> interesado -> cerrado | descartado
  estado             text not null default 'registrado',
  notas              text,
  registrado_en      timestamptz not null default now(),
  reservado_hasta    timestamptz not null default (now() + interval '30 days'),
  restaurante_id     uuid references public.restaurantes(id) on delete set null,
  actualizado_en     timestamptz not null default now(),
  constraint contactos_estado_valido
    check (estado in ('registrado','visitado','interesado','cerrado','descartado'))
);

create index if not exists idx_contactos_comercial on public.contactos_comerciales(comercial_id);
create index if not exists idx_contactos_norm      on public.contactos_comerciales(nombre_norm, poblacion_norm);


-- ------------------------------------------------------------
-- 2) Normalizacion de nombres
-- ------------------------------------------------------------
-- "Restaurante El Gran Muralla" y "gran muralla" tienen que chocar. Quitamos
-- tildes, signos y las palabras genericas del sector.

create or replace function public.normalizar_nombre(t text)
returns text
language sql
immutable
as $function$
  select nullif(trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        lower(translate(coalesce(t, ''),
          'áéíóúàèìòùäëïöüâêîôûñçÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛÑÇ',
          'aeiouaeiouaeiouaeiouncAEIOUAEIOUAEIOUAEIOUNC')),
        '[^a-z0-9]+', ' ', 'g'),
      '\m(restaurante|restaurantes|bar|cafeteria|cafe|pizzeria|asador|taberna|meson|kebab|comida|casa|el|la|los|las|de|del|y)\M',
      ' ', 'g'),
    '\s+', ' ', 'g')), '')
$function$;


-- ------------------------------------------------------------
-- 3) Helpers de identidad
-- ------------------------------------------------------------

create or replace function public.mi_comercial_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $function$
  select id from comerciales where usuario_id = auth.uid() and activo limit 1;
$function$;

create or replace function public.soy_comercial()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (select 1 from comerciales where usuario_id = auth.uid() and activo);
$function$;


-- ------------------------------------------------------------
-- 4) RLS
-- ------------------------------------------------------------

alter table public.comerciales             enable row level security;
alter table public.contactos_comerciales   enable row level security;

drop policy if exists "Comercial ve su ficha" on public.comerciales;
create policy "Comercial ve su ficha" on public.comerciales
  for select using (usuario_id = auth.uid() or soy_superadmin());

drop policy if exists "Superadmin gestiona comerciales" on public.comerciales;
create policy "Superadmin gestiona comerciales" on public.comerciales
  for all using (soy_superadmin()) with check (soy_superadmin());

-- Cada comercial, SOLO lo suyo. Para saber si un restaurante esta pillado
-- existe comprobar_restaurante(), que no revela datos de nadie.
drop policy if exists "Comercial ve sus contactos" on public.contactos_comerciales;
create policy "Comercial ve sus contactos" on public.contactos_comerciales
  for select using (comercial_id = mi_comercial_id() or soy_superadmin());

drop policy if exists "Comercial actualiza sus contactos" on public.contactos_comerciales;
create policy "Comercial actualiza sus contactos" on public.contactos_comerciales
  for update using (comercial_id = mi_comercial_id() or soy_superadmin())
           with check (comercial_id = mi_comercial_id() or soy_superadmin());

-- El alta va SIEMPRE por registrar_contacto(), que comprueba duplicados.
drop policy if exists "Superadmin gestiona contactos" on public.contactos_comerciales;
create policy "Superadmin gestiona contactos" on public.contactos_comerciales
  for all using (soy_superadmin()) with check (soy_superadmin());


-- ------------------------------------------------------------
-- 5) Comprobar si un restaurante esta libre
-- ------------------------------------------------------------
-- Devuelve SOLO el estado. Nunca quien lo tiene ni sus datos.
--   libre     -> se puede registrar
--   tuyo      -> ya lo tienes tu
--   reservado -> lo tiene otro, con los dias que le quedan
--   cliente   -> ya esta dado de alta en Comandi

create or replace function public.comprobar_restaurante(
  p_nombre    text,
  p_poblacion text default null
)
returns table (estado text, dias_restantes integer)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_nombre    text := normalizar_nombre(p_nombre);
  v_poblacion text := normalizar_nombre(p_poblacion);
  v_yo        uuid := mi_comercial_id();
  v_fila      record;
begin
  if not (soy_comercial() or soy_superadmin()) then
    raise exception 'Solo los comerciales pueden consultar esto';
  end if;
  if v_nombre is null then
    raise exception 'Escribe el nombre del restaurante';
  end if;

  -- Un contacto "ocupa" si esta cerrado (ya es cliente) o si su reserva sigue
  -- viva. Los descartados y las reservas caducadas dejan el nombre libre.
  select c.comercial_id, c.estado, c.reservado_hasta
    into v_fila
    from contactos_comerciales c
   where c.nombre_norm = v_nombre
     and (v_poblacion is null or c.poblacion_norm is null or c.poblacion_norm = v_poblacion)
     and c.estado <> 'descartado'
     and (c.estado = 'cerrado' or c.reservado_hasta > now())
   order by (c.estado = 'cerrado') desc, c.reservado_hasta desc
   limit 1;

  if not found then
    return query select 'libre'::text, null::integer;
  elsif v_fila.estado = 'cerrado' then
    return query select 'cliente'::text, null::integer;
  elsif v_fila.comercial_id = v_yo then
    return query select 'tuyo'::text,
                        greatest(0, ceil(extract(epoch from (v_fila.reservado_hasta - now())) / 86400))::integer;
  else
    return query select 'reservado'::text,
                        greatest(0, ceil(extract(epoch from (v_fila.reservado_hasta - now())) / 86400))::integer;
  end if;
end;
$function$;


-- ------------------------------------------------------------
-- 6) Registrar un contacto
-- ------------------------------------------------------------

create or replace function public.registrar_contacto(
  p_nombre    text,
  p_poblacion text default null,
  p_telefono  text default null,
  p_notas     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_yo     uuid := mi_comercial_id();
  v_estado text;
  v_id     uuid;
begin
  if v_yo is null then
    raise exception 'Tu cuenta no esta dada de alta como comercial';
  end if;
  if normalizar_nombre(p_nombre) is null then
    raise exception 'Escribe el nombre del restaurante';
  end if;

  select estado into v_estado from comprobar_restaurante(p_nombre, p_poblacion);

  if v_estado = 'reservado' then
    raise exception 'Ese restaurante ya lo tiene registrado otro comercial';
  elsif v_estado = 'cliente' then
    raise exception 'Ese restaurante ya es cliente de Comandi';
  elsif v_estado = 'tuyo' then
    raise exception 'Ya lo tienes registrado tu';
  end if;

  insert into contactos_comerciales
    (comercial_id, nombre_restaurante, nombre_norm, poblacion, poblacion_norm, telefono, notas)
  values
    (v_yo, trim(p_nombre), normalizar_nombre(p_nombre),
     nullif(trim(coalesce(p_poblacion, '')), ''), normalizar_nombre(p_poblacion),
     nullif(trim(coalesce(p_telefono, '')), ''), nullif(trim(coalesce(p_notas, '')), ''))
  returning id into v_id;

  return v_id;
end;
$function$;


-- ------------------------------------------------------------
-- 7) Cambiar el estado de un contacto propio
-- ------------------------------------------------------------
-- 'cerrado' lo pone el superadmin al dar de alta al restaurante: el comercial
-- no puede marcarse una venta a si mismo.

create or replace function public.actualizar_contacto(
  p_id     uuid,
  p_estado text,
  p_notas  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_yo uuid := mi_comercial_id();
begin
  if p_estado not in ('registrado','visitado','interesado','descartado','cerrado') then
    raise exception 'Estado no valido: %', p_estado;
  end if;
  if p_estado = 'cerrado' and not soy_superadmin() then
    raise exception 'El alta de un restaurante la confirma Comandi';
  end if;

  update contactos_comerciales
     set estado         = p_estado,
         notas          = coalesce(nullif(trim(coalesce(p_notas, '')), ''), notas),
         actualizado_en = now()
   where id = p_id
     and (comercial_id = v_yo or soy_superadmin());

  if not found then
    raise exception 'Ese contacto no existe o no es tuyo';
  end if;
end;
$function$;


-- ------------------------------------------------------------
-- 8) Ranking
-- ------------------------------------------------------------
-- Solo agregados: nombre y numeros. Ningun dato de restaurantes.

create or replace function public.ranking_comerciales()
returns table (
  comercial_id uuid,
  nombre       text,
  contactos    integer,
  visitados    integer,
  cerrados     integer,
  soy_yo       boolean
)
language sql
stable
security definer
set search_path = public
as $function$
  select c.id,
         c.nombre,
         count(k.id)::integer,
         count(k.id) filter (where k.estado in ('visitado','interesado','cerrado'))::integer,
         count(k.id) filter (where k.estado = 'cerrado')::integer,
         c.id = mi_comercial_id()
    from comerciales c
    left join contactos_comerciales k on k.comercial_id = c.id
   where c.activo
     and (soy_comercial() or soy_superadmin())
   group by c.id, c.nombre
   order by 5 desc, 4 desc, 3 desc, c.nombre;
$function$;


-- ------------------------------------------------------------
-- 9) Permisos
-- ------------------------------------------------------------

revoke all on function public.comprobar_restaurante(text, text)              from public, anon;
revoke all on function public.registrar_contacto(text, text, text, text)     from public, anon;
revoke all on function public.actualizar_contacto(uuid, text, text)          from public, anon;
revoke all on function public.ranking_comerciales()                          from public, anon;
revoke all on function public.mi_comercial_id()                              from public, anon;
revoke all on function public.soy_comercial()                                from public, anon;

grant execute on function public.comprobar_restaurante(text, text)           to authenticated;
grant execute on function public.registrar_contacto(text, text, text, text)  to authenticated;
grant execute on function public.actualizar_contacto(uuid, text, text)       to authenticated;
grant execute on function public.ranking_comerciales()                       to authenticated;
grant execute on function public.mi_comercial_id()                           to authenticated;
grant execute on function public.soy_comercial()                             to authenticated;

notify pgrst, 'reload schema';


-- ------------------------------------------------------------
-- 10) Dar de alta a un comercial (manual, como los restaurantes)
-- ------------------------------------------------------------
-- 1. Supabase > Authentication > Users > Add user, con "Auto Confirm User".
-- 2. Copiar su UUID y ejecutar:
--
-- insert into public.comerciales (usuario_id, nombre, telefono, email)
-- values ('UUID_DEL_USUARIO', 'Nombre Apellidos', '600000000', 'email@ejemplo.com');
--
-- Para darle de baja sin borrar su historico:
-- update public.comerciales set activo = false where id = 'UUID_DEL_COMERCIAL';
