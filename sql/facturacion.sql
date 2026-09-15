-- =============================================================
-- FACTURACIÓN PROPIA DE COMANDI
-- =============================================================
-- Las facturas oficiales de las mensualidades las emite la web (no Stripe:
-- Stripe solo cobra). Decisión de Sandra, 2026-09-15.
--
--  - Una sola numeración para todos los restaurantes, correlativa y sin
--    huecos: 2026-0001, 2026-0002... y las rectificativas R-2026-0002...
--    (la R-2026-0001 se hizo a mano para Gran Muralla).
--  - Las facturas NO se pueden borrar ni modificar (trigger). Un error se
--    corrige con una rectificativa.
--  - Hash encadenado por serie, preparado para Verifactu.
--  - Emitir solo lo puede el bot (service_role). La administradora lo pide
--    desde el panel y el bot lo hace.
--  - Cada restaurante solo LEE sus facturas. La administradora las ve todas
--    por funciones que comprueban soy_superadmin().
--
-- Aplicar en Supabase -> SQL editor. Se puede repetir.

create extension if not exists pgcrypto with schema extensions;


-- ---------- 1. Datos del emisor (una sola fila) ----------
create table if not exists public.facturacion_config (
  id                    smallint primary key default 1 check (id = 1),
  razon_social          text,
  cif                   text,
  domicilio             text,
  cp                    text,
  ciudad                text,
  provincia             text,
  -- Obligatorio en las facturas de una SL: "Inscrita en el Registro Mercantil
  -- de Córdoba, tomo X, folio Y, hoja CO-Z, inscripción 1.ª".
  registro_mercantil    text,
  email                 text,
  prefijo_ordinaria     text not null default '',
  prefijo_rectificativa text not null default 'R-',
  pie                   text,
  actualizado_en        timestamptz not null default now()
);

-- Inscrita el 14/07/2026 con folio electrónico (sin tomo ni folio en papel),
-- IRUS 1000476828062.
insert into public.facturacion_config (id, razon_social, cif, domicilio, cp, ciudad, provincia, email, registro_mercantil)
values (1, 'SCD TECH SL', 'B88886437', 'Calle Manuel Soro Tinte, 3', '14001', 'Córdoba', 'Córdoba', 'info@comandi.es',
        'Inscrita en el Registro Mercantil de Córdoba, hoja CO-49309, inscripción 1.ª')
on conflict (id) do nothing;


-- ---------- 2. A quién se factura y cada cuánto ----------
create table if not exists public.clientes_facturacion (
  id              uuid primary key default gen_random_uuid(),
  restaurante_id  uuid not null references public.restaurantes(id) on delete restrict,
  razon_social    text not null,
  nif             text not null,
  direccion       text not null,
  cp              text,
  ciudad          text,
  provincia       text,
  concepto        text not null default 'Suscripción Comandi – asistente de pedidos por WhatsApp',
  importe         numeric(10,2) not null check (importe > 0),
  -- Las mensualidades de Comandi van con IVA incluido (99 € = 81,82 + 17,18).
  iva_incluido    boolean not null default true,
  iva_pct         numeric(5,2) not null default 21 check (iva_pct >= 0 and iva_pct <= 100),
  -- Regla de precio propia de cada cliente: tramos en orden, y al acabarse
  -- todos, `importe`. Ejemplo: [{"periodos":3,"importe":49},{"periodos":3,"importe":79}]
  -- = 3 facturas a 49 €, 3 a 79 € y después las de `importe`. [] = siempre `importe`.
  tramos          jsonb not null default '[]'::jsonb,
  -- 'dias': cada `cada_dias` desde fecha_inicio (30 -> 15/09, 15/10, 14/11...).
  -- 'mensual': el mismo día de cada mes (el 31 cae el 30 en abril, el 28/29 en febrero).
  frecuencia      text not null default 'dias' check (frecuencia in ('dias', 'mensual')),
  cada_dias       int not null default 30 check (cada_dias between 1 and 366),
  -- Día de la PRIMERA factura. Las siguientes se calculan desde aquí.
  fecha_inicio    date not null,
  -- Última fecha en la que se puede emitir (baja). Null = sin fin.
  fecha_fin       date check (fecha_fin is null or fecha_fin >= fecha_inicio),
  activo          boolean not null default true,
  notas           text,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);

-- Un restaurante no puede tener dos fichas activas: se le facturaría dos veces.
create unique index if not exists clientes_facturacion_un_activo
  on public.clientes_facturacion (restaurante_id) where activo;

-- Por si la tabla ya existía de una ejecución anterior del script.
alter table public.clientes_facturacion
  add column if not exists tramos jsonb not null default '[]'::jsonb;

-- Importe de la factura número p_indice (0 = la primera) según la regla.
create or replace function public.facturacion_importe_periodo(c public.clientes_facturacion, p_indice int)
returns numeric
language plpgsql
immutable
as $function$
declare
  t jsonb;
  v_acumulado int := 0;
begin
  for t in select value from jsonb_array_elements(coalesce(c.tramos, '[]'::jsonb)) loop
    v_acumulado := v_acumulado + (t->>'periodos')::int;
    if p_indice < v_acumulado then return (t->>'importe')::numeric; end if;
  end loop;
  return c.importe;
end;
$function$;

-- Los tramos tienen que venir bien: periodos enteros > 0 e importes > 0.
create or replace function public.facturacion_tramos_validos(p jsonb)
returns boolean
language sql
immutable
as $function$
  select jsonb_typeof(p) = 'array'
     and not exists (
       select 1 from jsonb_array_elements(p) t
        where jsonb_typeof(t->'periodos') <> 'number' or jsonb_typeof(t->'importe') <> 'number'
           or (t->>'periodos')::numeric <= 0 or (t->>'periodos')::numeric <> trunc((t->>'periodos')::numeric)
           or (t->>'importe')::numeric <= 0);
$function$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_facturacion_tramos_validos') then
    alter table public.clientes_facturacion
      add constraint clientes_facturacion_tramos_validos check (facturacion_tramos_validos(tramos));
  end if;
end $$;


-- ---------- 3. Las facturas ----------
create table if not exists public.facturas (
  id                      uuid primary key default gen_random_uuid(),
  serie                   text not null check (serie in ('F', 'R')),
  anio                    int  not null,
  secuencia               int  not null,
  numero                  text not null unique,
  tipo                    text not null check (tipo in ('ordinaria', 'rectificativa')),
  -- periodica: la del proceso diario · manual: factura suelta (pedidos de
  -- más; las implementaciones NO se facturan aquí) · rectificativa.
  origen                  text not null check (origen in ('periodica', 'manual', 'rectificativa')),
  rectifica_factura_id    uuid references public.facturas(id),
  motivo_rectificacion    text,
  cliente_facturacion_id  uuid not null references public.clientes_facturacion(id),
  restaurante_id          uuid not null references public.restaurantes(id),
  periodo_inicio          date,
  periodo_fin             date,
  fecha_emision           date not null,
  -- Copia de los datos del momento: si el cliente cambia de dirección, la
  -- factura antigua no cambia.
  emisor                  jsonb not null,
  receptor                jsonb not null,
  concepto                text not null,
  base                    numeric(10,2) not null,
  iva_pct                 numeric(5,2)  not null,
  cuota_iva               numeric(10,2) not null,
  total                   numeric(10,2) not null,
  pdf_path                text,
  hash                    text not null,
  hash_anterior           text,
  creado_en               timestamptz not null default now(),
  unique (serie, anio, secuencia),
  check ((tipo = 'rectificativa') = (rectifica_factura_id is not null)),
  check (tipo <> 'rectificativa' or coalesce(motivo_rectificacion, '') <> ''),
  check (origen <> 'periodica' or (periodo_inicio is not null and periodo_fin is not null))
);

-- Nunca dos facturas del mismo periodo para el mismo cliente.
create unique index if not exists facturas_periodo_unico
  on public.facturas (cliente_facturacion_id, periodo_inicio) where origen = 'periodica';
-- Una factura solo se rectifica una vez.
create unique index if not exists facturas_rectificada_una_vez
  on public.facturas (rectifica_factura_id) where rectifica_factura_id is not null;
create index if not exists facturas_restaurante_idx on public.facturas (restaurante_id, fecha_emision desc);
create index if not exists facturas_fecha_idx on public.facturas (fecha_emision desc);


-- ---------- 4. Contadores (serie + año) ----------
create table if not exists public.facturacion_contadores (
  serie   text not null,
  anio    int  not null,
  ultimo  int  not null default 0,
  primary key (serie, anio)
);

-- La R-2026-0001 ya existe (hecha a mano): la primera de la web es la 0002.
insert into public.facturacion_contadores (serie, anio, ultimo) values ('R', 2026, 1)
on conflict (serie, anio) do nothing;


-- ---------- 5. Las facturas no se tocan ----------
create or replace function public.facturas_inmutables()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'UPDATE' then
    -- Lo único permitido: apuntar el PDF cuando todavía no lo tenía.
    if old.pdf_path is null and new.pdf_path is not null
       and (to_jsonb(new) - 'pdf_path') = (to_jsonb(old) - 'pdf_path') then
      return new;
    end if;
    raise exception 'Las facturas no se pueden modificar. Un error se corrige con una factura rectificativa.';
  end if;
  raise exception 'Las facturas no se pueden borrar. Un error se corrige con una factura rectificativa.';
end;
$function$;

drop trigger if exists facturas_inmutables on public.facturas;
create trigger facturas_inmutables
  before update or delete on public.facturas
  for each row execute function public.facturas_inmutables();

drop trigger if exists facturas_sin_vaciar on public.facturas;
create trigger facturas_sin_vaciar
  before truncate on public.facturas
  for each statement execute function public.facturas_inmutables();


-- ---------- 6. Crear una factura (interna) ----------
-- "Hoy" en Madrid. Solo las pruebas (sql/facturacion_pruebas.sql, dentro de
-- una transacción que se deshace) lo cambian con set_config('facturacion.hoy').
-- Desde la web no se puede tocar: PostgREST no deja fijar ajustes así.
create or replace function public.facturacion_hoy()
returns date
language sql
stable
as $function$
  select coalesce(nullif(current_setting('facturacion.hoy', true), '')::date,
                  (now() at time zone 'Europe/Madrid')::date);
$function$;

-- Todo lo que numera pasa por aquí, en la misma transacción que la llama.
create or replace function public.facturacion_crear(
  p_cliente         public.clientes_facturacion,
  p_serie           text,
  p_tipo            text,
  p_origen          text,
  p_concepto        text,
  p_base            numeric,
  p_cuota           numeric,
  p_iva_pct         numeric,
  p_periodo_inicio  date,
  p_periodo_fin     date,
  p_receptor        jsonb,
  p_rectifica       uuid,
  p_motivo          text
)
returns public.facturas
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_cfg      public.facturacion_config;
  v_hoy      date := facturacion_hoy();
  v_anio     int  := extract(year from facturacion_hoy())::int;
  v_seq      int;
  v_numero   text;
  v_anterior text;
  v_total    numeric(10,2);
  v_emisor   jsonb;
  v_hash     text;
  v_factura  public.facturas;
begin
  select * into v_cfg from facturacion_config where id = 1;
  if v_cfg.id is null
     or coalesce(v_cfg.razon_social, '') = '' or coalesce(v_cfg.cif, '') = ''
     or coalesce(v_cfg.domicilio, '') = '' or coalesce(v_cfg.registro_mercantil, '') = '' then
    raise exception 'Faltan datos del emisor (razón social, CIF, domicilio o Registro Mercantil). Complétalos en Admin → Facturación → Datos del emisor.';
  end if;

  -- El contador se bloquea aquí hasta el final de la transacción: una segunda
  -- emisión a la vez espera y coge el número siguiente. Sin huecos: si algo
  -- falla después, se deshace también el incremento.
  insert into facturacion_contadores (serie, anio, ultimo) values (p_serie, v_anio, 1)
  on conflict (serie, anio) do update set ultimo = facturacion_contadores.ultimo + 1
  returning ultimo into v_seq;

  v_numero := (case when p_serie = 'R' then v_cfg.prefijo_rectificativa else v_cfg.prefijo_ordinaria end)
              || v_anio || '-' || (case when v_seq < 10000 then lpad(v_seq::text, 4, '0') else v_seq::text end);

  -- Con el contador ya bloqueado, la última factura de la serie es firme.
  select hash into v_anterior from facturas
   where serie = p_serie order by anio desc, secuencia desc limit 1;

  v_total  := p_base + p_cuota;
  v_emisor := jsonb_build_object(
    'razon_social', v_cfg.razon_social, 'cif', v_cfg.cif, 'domicilio', v_cfg.domicilio,
    'cp', v_cfg.cp, 'ciudad', v_cfg.ciudad, 'provincia', v_cfg.provincia,
    'registro_mercantil', v_cfg.registro_mercantil, 'email', v_cfg.email, 'pie', v_cfg.pie);

  v_hash := encode(extensions.digest(
    v_numero || '|' || to_char(v_hoy, 'YYYY-MM-DD') || '|' || v_cfg.cif || '|' ||
    (p_receptor ->> 'nif') || '|' || v_total::text || '|' || coalesce(v_anterior, ''),
    'sha256'), 'hex');

  insert into facturas (
    serie, anio, secuencia, numero, tipo, origen, rectifica_factura_id, motivo_rectificacion,
    cliente_facturacion_id, restaurante_id, periodo_inicio, periodo_fin, fecha_emision,
    emisor, receptor, concepto, base, iva_pct, cuota_iva, total, hash, hash_anterior
  ) values (
    p_serie, v_anio, v_seq, v_numero, p_tipo, p_origen, p_rectifica, p_motivo,
    p_cliente.id, p_cliente.restaurante_id, p_periodo_inicio, p_periodo_fin, v_hoy,
    v_emisor, p_receptor, p_concepto, p_base, p_iva_pct, p_cuota, v_total, v_hash, v_anterior
  ) returning * into v_factura;

  return v_factura;
end;
$function$;

-- Importes: con IVA incluido la base se redondea y la cuota es lo que falta
-- hasta el total (así 249 € da 249,00 y no 249,01). Sin IVA incluido, la
-- cuota es round(base × IVA).
create or replace function public.facturacion_importes(p_importe numeric, p_iva_incluido boolean, p_iva_pct numeric)
returns table (base numeric, cuota numeric)
language sql
immutable
as $function$
  select case when p_iva_incluido then round(p_importe / (1 + p_iva_pct / 100), 2) else round(p_importe, 2) end,
         case when p_iva_incluido then round(p_importe, 2) - round(p_importe / (1 + p_iva_pct / 100), 2)
              else round(round(p_importe, 2) * p_iva_pct / 100, 2) end;
$function$;

create or replace function public.facturacion_receptor(c public.clientes_facturacion)
returns jsonb
language sql
immutable
as $function$
  select jsonb_build_object('razon_social', c.razon_social, 'nif', c.nif, 'direccion', c.direccion,
                            'cp', c.cp, 'ciudad', c.ciudad, 'provincia', c.provincia);
$function$;


-- ---------- 7. Lo que llama el bot ----------
-- Factura periódica. Idempotente: si ya existe la de ese periodo, la devuelve.
-- p_indice: qué periodo es desde la primera factura (0 = la primera). Decide
-- si va a precio de promoción. Lo calcula el bot (lib/facturacion/fechas.js).
drop function if exists public.emitir_factura(uuid, date, date);
create or replace function public.emitir_factura(p_cliente uuid, p_periodo_inicio date, p_periodo_fin date, p_indice int)
returns public.facturas
language plpgsql
security definer
set search_path = public
as $function$
declare
  c   public.clientes_facturacion;
  f   public.facturas;
  imp record;
  v_importe numeric;
  v_hoy date := facturacion_hoy();
begin
  -- Bloquea la ficha: dos emisiones del mismo cliente a la vez van en fila.
  select * into c from clientes_facturacion where id = p_cliente for update;
  if c.id is null then raise exception 'No existe ese cliente de facturación'; end if;

  select * into f from facturas
   where cliente_facturacion_id = p_cliente and periodo_inicio = p_periodo_inicio and origen = 'periodica';
  if f.id is not null then return f; end if;

  if not c.activo then raise exception 'El cliente de facturación está desactivado'; end if;
  if p_periodo_fin < p_periodo_inicio then raise exception 'El periodo acaba antes de empezar'; end if;
  if p_periodo_inicio < c.fecha_inicio then raise exception 'Ese periodo es anterior a la primera factura del cliente'; end if;
  if c.fecha_fin is not null and p_periodo_inicio > c.fecha_fin then raise exception 'El cliente está dado de baja para ese periodo'; end if;
  if p_periodo_inicio > v_hoy then raise exception 'No se factura un periodo que todavía no ha empezado'; end if;
  if p_indice is null or p_indice < 0 then raise exception 'Falta el número de periodo'; end if;

  v_importe := facturacion_importe_periodo(c, p_indice);
  select * into imp from facturacion_importes(v_importe, c.iva_incluido, c.iva_pct);
  return facturacion_crear(c, 'F', 'ordinaria', 'periodica', c.concepto, imp.base, imp.cuota, c.iva_pct,
                           p_periodo_inicio, p_periodo_fin, facturacion_receptor(c), null, null);
end;
$function$;

-- Factura suelta: pedidos de más, implementación...
create or replace function public.emitir_factura_manual(
  p_cliente uuid, p_concepto text, p_importe numeric, p_iva_incluido boolean, p_iva_pct numeric
)
returns public.facturas
language plpgsql
security definer
set search_path = public
as $function$
declare
  c   public.clientes_facturacion;
  imp record;
begin
  select * into c from clientes_facturacion where id = p_cliente;
  if c.id is null then raise exception 'No existe ese cliente de facturación'; end if;
  if coalesce(trim(p_concepto), '') = '' then raise exception 'Falta el concepto'; end if;
  if coalesce(p_importe, 0) <= 0 then raise exception 'El importe tiene que ser mayor que cero'; end if;
  if p_iva_pct is null or p_iva_pct < 0 or p_iva_pct > 100 then raise exception 'IVA no válido'; end if;

  select * into imp from facturacion_importes(p_importe, coalesce(p_iva_incluido, false), p_iva_pct);
  return facturacion_crear(c, 'F', 'ordinaria', 'manual', trim(p_concepto), imp.base, imp.cuota, p_iva_pct,
                           null, null, facturacion_receptor(c), null, null);
end;
$function$;

-- Rectificativa: anula entera la original, con importes en negativo.
create or replace function public.emitir_rectificativa(p_factura uuid, p_motivo text)
returns public.facturas
language plpgsql
security definer
set search_path = public
as $function$
declare
  o public.facturas;
  c public.clientes_facturacion;
begin
  select * into o from facturas where id = p_factura;
  if o.id is null then raise exception 'No existe esa factura'; end if;
  if o.tipo <> 'ordinaria' then raise exception 'Una rectificativa no se rectifica'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Falta el motivo de la rectificación'; end if;
  if exists (select 1 from facturas where rectifica_factura_id = o.id) then
    raise exception 'La factura % ya está rectificada', o.numero;
  end if;
  select * into c from clientes_facturacion where id = o.cliente_facturacion_id;

  return facturacion_crear(c, 'R', 'rectificativa', 'rectificativa',
                           'Rectificación de la factura ' || o.numero || ': ' || o.concepto,
                           -o.base, -o.cuota_iva, o.iva_pct, o.periodo_inicio, o.periodo_fin,
                           o.receptor, o.id, trim(p_motivo));
end;
$function$;

revoke all on function public.facturacion_crear(public.clientes_facturacion, text, text, text, text, numeric, numeric, numeric, date, date, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.emitir_factura(uuid, date, date, int) from public, anon, authenticated;
revoke all on function public.emitir_factura_manual(uuid, text, numeric, boolean, numeric) from public, anon, authenticated;
revoke all on function public.emitir_rectificativa(uuid, text) from public, anon, authenticated;
grant execute on function public.emitir_factura(uuid, date, date, int) to service_role;
grant execute on function public.emitir_factura_manual(uuid, text, numeric, boolean, numeric) to service_role;
grant execute on function public.emitir_rectificativa(uuid, text) to service_role;


-- ---------- 8. Permisos ----------
alter table public.facturacion_config      enable row level security;
alter table public.clientes_facturacion    enable row level security;
alter table public.facturas                enable row level security;
alter table public.facturacion_contadores  enable row level security;

-- Sin políticas: nadie con la clave pública lee ni escribe estas tres. La
-- administradora pasa por las funciones de abajo; el bot, por service_role.
revoke all on public.facturacion_config, public.clientes_facturacion, public.facturacion_contadores from anon, authenticated;

-- Las facturas: cada restaurante LEE las suyas. Nada más.
revoke all on public.facturas from anon, authenticated;
grant select on public.facturas to authenticated;

drop policy if exists "restaurante lee sus facturas" on public.facturas;
create policy "restaurante lee sus facturas" on public.facturas
  for select using (restaurante_id in (select mis_restaurantes()));


-- ---------- 9. Funciones de la administradora ----------
create or replace function public.admin_facturacion_config()
returns public.facturacion_config
language plpgsql stable security definer set search_path = public
as $function$
declare v public.facturacion_config;
begin
  if not soy_superadmin() then raise exception 'Solo la administradora'; end if;
  select * into v from facturacion_config where id = 1;
  return v;
end;
$function$;

create or replace function public.admin_guardar_facturacion_config(p jsonb)
returns void
language plpgsql security definer set search_path = public
as $function$
begin
  if not soy_superadmin() then raise exception 'Solo la administradora'; end if;
  update facturacion_config set
    razon_social          = nullif(trim(p->>'razon_social'), ''),
    cif                   = upper(nullif(trim(p->>'cif'), '')),
    domicilio             = nullif(trim(p->>'domicilio'), ''),
    cp                    = nullif(trim(p->>'cp'), ''),
    ciudad                = nullif(trim(p->>'ciudad'), ''),
    provincia             = nullif(trim(p->>'provincia'), ''),
    registro_mercantil    = nullif(trim(p->>'registro_mercantil'), ''),
    email                 = nullif(trim(p->>'email'), ''),
    pie                   = nullif(trim(p->>'pie'), ''),
    actualizado_en        = now()
  where id = 1;
end;
$function$;

create or replace function public.admin_clientes_facturacion()
returns setof public.clientes_facturacion
language plpgsql stable security definer set search_path = public
as $function$
begin
  if not soy_superadmin() then raise exception 'Solo la administradora'; end if;
  return query select * from clientes_facturacion order by activo desc, razon_social;
end;
$function$;

create or replace function public.admin_guardar_cliente_facturacion(p_id uuid, p jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $function$
declare v_id uuid;
begin
  if not soy_superadmin() then raise exception 'Solo la administradora'; end if;
  if coalesce(trim(p->>'nif'), '') !~* '^[A-Z0-9]{9}$' then
    raise exception 'El NIF/CIF tiene que tener 9 letras o números, sin guiones ni espacios';
  end if;

  if p_id is null then
    insert into clientes_facturacion (
      restaurante_id, razon_social, nif, direccion, cp, ciudad, provincia, concepto, importe,
      tramos,
      iva_incluido, iva_pct, frecuencia, cada_dias, fecha_inicio, fecha_fin, activo, notas
    ) values (
      (p->>'restaurante_id')::uuid, trim(p->>'razon_social'), upper(trim(p->>'nif')), trim(p->>'direccion'),
      nullif(trim(p->>'cp'), ''), nullif(trim(p->>'ciudad'), ''), nullif(trim(p->>'provincia'), ''),
      trim(p->>'concepto'), (p->>'importe')::numeric,
      coalesce(p->'tramos', '[]'::jsonb),
      coalesce((p->>'iva_incluido')::boolean, true), coalesce((p->>'iva_pct')::numeric, 21),
      coalesce(p->>'frecuencia', 'dias'), coalesce((p->>'cada_dias')::int, 30),
      (p->>'fecha_inicio')::date, nullif(p->>'fecha_fin', '')::date,
      coalesce((p->>'activo')::boolean, true), nullif(trim(p->>'notas'), '')
    ) returning id into v_id;
  else
    update clientes_facturacion set
      restaurante_id = (p->>'restaurante_id')::uuid,
      razon_social   = trim(p->>'razon_social'),
      nif            = upper(trim(p->>'nif')),
      direccion      = trim(p->>'direccion'),
      cp             = nullif(trim(p->>'cp'), ''),
      ciudad         = nullif(trim(p->>'ciudad'), ''),
      provincia      = nullif(trim(p->>'provincia'), ''),
      concepto       = trim(p->>'concepto'),
      importe        = (p->>'importe')::numeric,
      tramos         = coalesce(p->'tramos', '[]'::jsonb),
      iva_incluido   = coalesce((p->>'iva_incluido')::boolean, true),
      iva_pct        = coalesce((p->>'iva_pct')::numeric, 21),
      frecuencia     = coalesce(p->>'frecuencia', 'dias'),
      cada_dias      = coalesce((p->>'cada_dias')::int, 30),
      fecha_inicio   = (p->>'fecha_inicio')::date,
      fecha_fin      = nullif(p->>'fecha_fin', '')::date,
      activo         = coalesce((p->>'activo')::boolean, true),
      notas          = nullif(trim(p->>'notas'), ''),
      actualizado_en = now()
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'No existe ese cliente de facturación'; end if;
  end if;
  return v_id;
end;
$function$;

create or replace function public.admin_facturas(p_desde date default null, p_hasta date default null, p_restaurante uuid default null)
returns setof public.facturas
language plpgsql stable security definer set search_path = public
as $function$
begin
  if not soy_superadmin() then raise exception 'Solo la administradora'; end if;
  return query
    select * from facturas
     where (p_desde is null or fecha_emision >= p_desde)
       and (p_hasta is null or fecha_emision <= p_hasta)
       and (p_restaurante is null or restaurante_id = p_restaurante)
     order by anio desc, serie, secuencia desc;
end;
$function$;

revoke all on function public.admin_facturacion_config() from public, anon;
revoke all on function public.admin_guardar_facturacion_config(jsonb) from public, anon;
revoke all on function public.admin_clientes_facturacion() from public, anon;
revoke all on function public.admin_guardar_cliente_facturacion(uuid, jsonb) from public, anon;
revoke all on function public.admin_facturas(date, date, uuid) from public, anon;
grant execute on function public.admin_facturacion_config() to authenticated;
grant execute on function public.admin_guardar_facturacion_config(jsonb) to authenticated;
grant execute on function public.admin_clientes_facturacion() to authenticated;
grant execute on function public.admin_guardar_cliente_facturacion(uuid, jsonb) to authenticated;
grant execute on function public.admin_facturas(date, date, uuid) to authenticated;


-- ---------- 10. Exportaciones al Excel del asesor ----------
-- Las facturas no se pueden tocar, así que la marca de «ya exportada» va
-- aparte. Guarda la PRIMERA vez que salió en un Excel; volver a exportarla no
-- cambia esa fecha.
create table if not exists public.facturas_exportadas (
  factura_id    uuid primary key references public.facturas(id),
  exportado_en  timestamptz not null default now()
);
alter table public.facturas_exportadas enable row level security;
revoke all on public.facturas_exportadas from anon, authenticated;

create or replace function public.admin_facturas_exportadas()
returns setof public.facturas_exportadas
language plpgsql stable security definer set search_path = public
as $function$
begin
  if not soy_superadmin() then raise exception 'Solo la administradora'; end if;
  return query select * from facturas_exportadas;
end;
$function$;
revoke all on function public.admin_facturas_exportadas() from public, anon;
grant execute on function public.admin_facturas_exportadas() to authenticated;


-- ---------- 11. Los PDF: almacén privado ----------
-- Sin políticas: solo el bot (service_role) sube y firma enlaces de descarga,
-- después de comprobar de quién es la factura.
insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', false)
on conflict (id) do update set public = false;

notify pgrst, 'reload schema';

-- Comprobación
select 'config' as que, count(*) from facturacion_config
union all select 'contador R 2026', ultimo from facturacion_contadores where serie = 'R' and anio = 2026;
