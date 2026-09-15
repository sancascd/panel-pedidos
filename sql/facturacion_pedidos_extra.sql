-- =============================================================
-- FACTURACIÓN: LOS PEDIDOS DE MÁS EN LA MISMA FACTURA DEL MES
-- =============================================================
-- Decisión de Sandra (2026-09-15): una sola factura al mes, automática, con
--   1) la cuota del periodo que empieza (por adelantado), y
--   2) los pedidos por encima de los incluidos del periodo ANTERIOR, que ya
--      ha terminado (así el recuento es firme). Es lo que dice la cláusula 3.4.
-- Se cuentan TODOS los pedidos recibidos en ese periodo (como la página del
-- plan y el medidor de Stripe).
--
-- La factura pasa a tener líneas (`lineas`); base, IVA y total siguen siendo
-- la suma, y el hash no cambia de forma.
--
-- Cada cliente lleva sus propios pedidos incluidos y precio por pedido de
-- más (IVA incluido si la ficha lo tiene): vacío = no se cobran los de más.
--
-- Aplicar DESPUÉS de facturacion.sql y facturacion_importar_r2026_0001.sql.
-- Se puede repetir.

-- ---------- 1. Columnas ----------
alter table public.clientes_facturacion
  add column if not exists pedidos_incluidos    int check (pedidos_incluidos is null or pedidos_incluidos >= 0),
  add column if not exists precio_pedido_extra  numeric(10,4) check (precio_pedido_extra is null or precio_pedido_extra >= 0),
  -- Para clientes que ya usaban Comandi antes de su primera factura de la web
  -- (Gran Muralla: servicio desde el 14/09, primera factura el 14/10): la
  -- primera factura cobra los pedidos de más desde esta fecha. Null = nada.
  add column if not exists pedidos_desde        date;

update public.clientes_facturacion set pedidos_desde = '2026-09-14', actualizado_en = now()
 where pedidos_desde is null
   and restaurante_id = (select id from restaurantes where slug = 'gran-muralla');

alter table public.facturas
  add column if not exists lineas               jsonb not null default '[]'::jsonb,
  add column if not exists pedidos_periodo_anterior int,
  add column if not exists pedidos_extra        int;

-- Fichas ya creadas: lo de su plan (Básico: 1.000 incluidos, 0,20 € el pedido de más).
update public.clientes_facturacion c
   set pedidos_incluidos   = coalesce(c.pedidos_incluidos, r.pedidos_incluidos,
                               case r.plan when 'pro' then 1500 when 'premium' then 3500 else 1000 end),
       precio_pedido_extra = coalesce(c.precio_pedido_extra,
                               case r.plan when 'pro' then 0.12 when 'premium' then 0.08 else 0.20 end),
       actualizado_en      = now()
  from public.restaurantes r
 where r.id = c.restaurante_id
   and (c.pedidos_incluidos is null or c.precio_pedido_extra is null);


-- ---------- 2. Crear factura, ahora con líneas ----------
drop function if exists public.facturacion_crear(public.clientes_facturacion, text, text, text, text, numeric, numeric, numeric, date, date, jsonb, uuid, text);

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
  p_motivo          text,
  p_lineas          jsonb,
  p_pedidos_anterior int,
  p_pedidos_extra   int
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

  insert into facturacion_contadores (serie, anio, ultimo) values (p_serie, v_anio, 1)
  on conflict (serie, anio) do update set ultimo = facturacion_contadores.ultimo + 1
  returning ultimo into v_seq;

  v_numero := (case when p_serie = 'R' then v_cfg.prefijo_rectificativa else v_cfg.prefijo_ordinaria end)
              || v_anio || '-' || (case when v_seq < 10000 then lpad(v_seq::text, 4, '0') else v_seq::text end);

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
    emisor, receptor, concepto, base, iva_pct, cuota_iva, total, hash, hash_anterior,
    lineas, pedidos_periodo_anterior, pedidos_extra
  ) values (
    p_serie, v_anio, v_seq, v_numero, p_tipo, p_origen, p_rectifica, p_motivo,
    p_cliente.id, p_cliente.restaurante_id, p_periodo_inicio, p_periodo_fin, v_hoy,
    v_emisor, p_receptor, p_concepto, p_base, p_iva_pct, p_cuota, v_total, v_hash, v_anterior,
    coalesce(p_lineas, '[]'::jsonb), p_pedidos_anterior, p_pedidos_extra
  ) returning * into v_factura;

  return v_factura;
end;
$function$;

revoke all on function public.facturacion_crear(public.clientes_facturacion, text, text, text, text, numeric, numeric, numeric, date, date, jsonb, uuid, text, jsonb, int, int) from public, anon, authenticated;

create or replace function public.facturacion_miles(n int)
returns text language sql immutable as $function$ select replace(to_char(n, 'FM999,999,999'), ',', '.'); $function$;

create or replace function public.facturacion_fecha_texto(d date)
returns text language sql immutable as $function$ select to_char(d, 'DD/MM/YYYY'); $function$;


-- ---------- 3. Factura del mes: cuota + pedidos de más ----------
-- p_anterior_inicio: inicio del periodo anterior (null en la primera
-- factura). Sus pedidos son los que caen entre ese día y p_periodo_inicio,
-- en hora de Madrid.
drop function if exists public.emitir_factura(uuid, date, date, int);

create or replace function public.emitir_factura(
  p_cliente uuid, p_periodo_inicio date, p_periodo_fin date, p_indice int, p_anterior_inicio date
)
returns public.facturas
language plpgsql
security definer
set search_path = public
as $function$
declare
  c   public.clientes_facturacion;
  f   public.facturas;
  v_hoy date := facturacion_hoy();
  v_iva numeric;
  v_cuota_total numeric;        -- lo que se cobra de cuota (con o sin IVA, según la ficha)
  v_base_cuota numeric(10,2);
  v_pedidos int;
  v_extra int := 0;
  v_extra_total numeric := 0;
  v_base_extra numeric(10,2) := 0;
  v_base numeric(10,2);
  v_cuota numeric(10,2);
  v_lineas jsonb;
  v_concepto text;
  v_precio_unit numeric;
begin
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
  if p_anterior_inicio is not null and p_anterior_inicio >= p_periodo_inicio then
    raise exception 'El periodo anterior tiene que empezar antes que este';
  end if;

  v_iva := c.iva_pct / 100;
  v_cuota_total := facturacion_importe_periodo(c, p_indice);
  v_base_cuota := case when c.iva_incluido then round(v_cuota_total / (1 + v_iva), 2) else round(v_cuota_total, 2) end;

  v_lineas := jsonb_build_array(jsonb_build_object(
    'concepto', c.concepto,
    'detalle', 'Periodo del ' || facturacion_fecha_texto(p_periodo_inicio) || ' al ' || facturacion_fecha_texto(p_periodo_fin),
    'cantidad', 1, 'precio_unitario', v_base_cuota, 'importe', v_base_cuota));
  v_concepto := c.concepto;

  -- Pedidos de más del periodo anterior
  if p_anterior_inicio is not null and c.pedidos_incluidos is not null and coalesce(c.precio_pedido_extra, 0) > 0 then
    select count(*) into v_pedidos from pedidos
     where restaurante_id = c.restaurante_id
       and creado_en >= (p_anterior_inicio::timestamp at time zone 'Europe/Madrid')
       and creado_en <  (p_periodo_inicio::timestamp  at time zone 'Europe/Madrid');
    v_extra := greatest(v_pedidos - c.pedidos_incluidos, 0);
    if v_extra > 0 then
      v_extra_total := round(v_extra * c.precio_pedido_extra, 2);
      v_base_extra := case when c.iva_incluido then round(v_extra_total / (1 + v_iva), 2) else v_extra_total end;
      v_precio_unit := case when c.iva_incluido then round(c.precio_pedido_extra / (1 + v_iva), 4) else c.precio_pedido_extra end;
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'concepto', 'Pedidos por encima de los ' || facturacion_miles(c.pedidos_incluidos) || ' incluidos',
        'detalle', 'Periodo del ' || facturacion_fecha_texto(p_anterior_inicio) || ' al ' ||
                   facturacion_fecha_texto(p_periodo_inicio - 1) || ': ' || facturacion_miles(v_pedidos) || ' pedidos',
        'cantidad', v_extra, 'precio_unitario', v_precio_unit, 'importe', v_base_extra));
      v_concepto := c.concepto || ' + ' || facturacion_miles(v_extra) || ' pedidos de más';
    end if;
  end if;

  v_base := v_base_cuota + v_base_extra;
  -- Con IVA incluido, la cuota es lo que falta hasta lo cobrado (sin céntimos sueltos).
  v_cuota := case when c.iva_incluido then round(v_cuota_total, 2) + v_extra_total - v_base
                  else round(v_base * v_iva, 2) end;

  return facturacion_crear(c, 'F', 'ordinaria', 'periodica', v_concepto, v_base, v_cuota, c.iva_pct,
                           p_periodo_inicio, p_periodo_fin, facturacion_receptor(c), null, null,
                           v_lineas, case when p_anterior_inicio is null then null else v_pedidos end, v_extra);
end;
$function$;

revoke all on function public.emitir_factura(uuid, date, date, int, date) from public, anon, authenticated;
grant execute on function public.emitir_factura(uuid, date, date, int, date) to service_role;


-- ---------- 4. Factura suelta y rectificativa, con sus líneas ----------
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
                           null, null, facturacion_receptor(c), null, null,
                           jsonb_build_array(jsonb_build_object('concepto', trim(p_concepto), 'cantidad', 1,
                             'precio_unitario', imp.base, 'importe', imp.base)), null, null);
end;
$function$;

create or replace function public.emitir_rectificativa(p_factura uuid, p_motivo text)
returns public.facturas
language plpgsql
security definer
set search_path = public
as $function$
declare
  o public.facturas;
  c public.clientes_facturacion;
  v_lineas jsonb;
begin
  select * into o from facturas where id = p_factura;
  if o.id is null then raise exception 'No existe esa factura'; end if;
  if o.tipo <> 'ordinaria' then raise exception 'Una rectificativa no se rectifica'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Falta el motivo de la rectificación'; end if;
  if exists (select 1 from facturas where rectifica_factura_id = o.id) then
    raise exception 'La factura % ya está rectificada', o.numero;
  end if;
  select * into c from clientes_facturacion where id = o.cliente_facturacion_id;

  -- Las mismas líneas, con los importes en negativo.
  select coalesce(jsonb_agg(l || jsonb_build_object('cantidad', -(l->>'cantidad')::numeric,
                                                    'importe', -(l->>'importe')::numeric)), '[]'::jsonb)
    into v_lineas from jsonb_array_elements(o.lineas) l;

  return facturacion_crear(c, 'R', 'rectificativa', 'rectificativa',
                           'Rectificación de la factura ' || o.numero || ': ' || o.concepto,
                           -o.base, -o.cuota_iva, o.iva_pct, o.periodo_inicio, o.periodo_fin,
                           o.receptor, o.id, trim(p_motivo), v_lineas,
                           o.pedidos_periodo_anterior, case when o.pedidos_extra is null then null else -o.pedidos_extra end);
end;
$function$;

revoke all on function public.emitir_factura_manual(uuid, text, numeric, boolean, numeric) from public, anon, authenticated;
revoke all on function public.emitir_rectificativa(uuid, text) from public, anon, authenticated;
grant execute on function public.emitir_factura_manual(uuid, text, numeric, boolean, numeric) to service_role;
grant execute on function public.emitir_rectificativa(uuid, text) to service_role;


-- ---------- 5. Guardar la ficha, con los pedidos incluidos y su precio ----------
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
      restaurante_id, razon_social, nif, direccion, cp, ciudad, provincia, concepto, importe, tramos,
      iva_incluido, iva_pct, frecuencia, cada_dias, fecha_inicio, fecha_fin, activo, notas,
      pedidos_incluidos, precio_pedido_extra, pedidos_desde
    ) values (
      (p->>'restaurante_id')::uuid, trim(p->>'razon_social'), upper(trim(p->>'nif')), trim(p->>'direccion'),
      nullif(trim(p->>'cp'), ''), nullif(trim(p->>'ciudad'), ''), nullif(trim(p->>'provincia'), ''),
      trim(p->>'concepto'), (p->>'importe')::numeric, coalesce(p->'tramos', '[]'::jsonb),
      coalesce((p->>'iva_incluido')::boolean, true), coalesce((p->>'iva_pct')::numeric, 21),
      coalesce(p->>'frecuencia', 'mensual'), coalesce((p->>'cada_dias')::int, 30),
      (p->>'fecha_inicio')::date, nullif(p->>'fecha_fin', '')::date,
      coalesce((p->>'activo')::boolean, true), nullif(trim(p->>'notas'), ''),
      nullif(p->>'pedidos_incluidos', '')::int, nullif(p->>'precio_pedido_extra', '')::numeric, nullif(p->>'pedidos_desde', '')::date
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
      frecuencia     = coalesce(p->>'frecuencia', 'mensual'),
      cada_dias      = coalesce((p->>'cada_dias')::int, 30),
      fecha_inicio   = (p->>'fecha_inicio')::date,
      fecha_fin      = nullif(p->>'fecha_fin', '')::date,
      activo         = coalesce((p->>'activo')::boolean, true),
      notas          = nullif(trim(p->>'notas'), ''),
      pedidos_incluidos   = nullif(p->>'pedidos_incluidos', '')::int,
      precio_pedido_extra = nullif(p->>'precio_pedido_extra', '')::numeric,
      pedidos_desde       = nullif(p->>'pedidos_desde', '')::date,
      actualizado_en = now()
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'No existe ese cliente de facturación'; end if;
  end if;
  return v_id;
end;
$function$;

notify pgrst, 'reload schema';

-- Cómo quedan las fichas:
select r.nombre, c.importe, c.pedidos_incluidos, c.precio_pedido_extra, c.pedidos_desde, c.frecuencia, c.fecha_inicio, c.activo
  from clientes_facturacion c join restaurantes r on r.id = c.restaurante_id
 order by r.nombre;
