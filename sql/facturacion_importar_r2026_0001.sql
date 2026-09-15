-- =============================================================
-- FACTURACIÓN: IMPORTAR LAS FACTURAS DE SEPTIEMBRE DE GRAN MURALLA
-- =============================================================
-- 1. Cada factura guarda también el nombre del establecimiento (sale en el
--    recuadro de fechas del PDF).
-- 2. Facturas 'importada': hechas fuera de la web y subidas tal cual, con su
--    número y su PDF original. Serie 'X' para las de numeración ajena (Stripe).
-- 3. Marca `sustituida`: una factura rectificada POR SUSTITUCIÓN sigue a la
--    vista pero no suma en totales ni en el Excel (sumaría dos veces).
-- 4. Importa las dos de septiembre de 2026 de Gran Muralla:
--      8S7OYWRK-0001 (Stripe, 14/09, 99 €) · sustituida
--      R-2026-0001   (a mano, 14/09, 99 €) · la rectificativa que la sustituye
--    Sus PDF se suben a mano al almacén `facturas`, en la carpeta con el id
--    de Gran Muralla: 8S7OYWRK-0001.pdf y R-2026-0001.pdf.
--
-- Se puede repetir.

-- ---------- 1. Establecimiento ----------
create or replace function public.facturacion_receptor(c public.clientes_facturacion)
returns jsonb
language sql
stable
set search_path = public
as $function$
  select jsonb_build_object('razon_social', c.razon_social, 'nif', c.nif, 'direccion', c.direccion,
                            'cp', c.cp, 'ciudad', c.ciudad, 'provincia', c.provincia,
                            'establecimiento', (select nombre from restaurantes where id = c.restaurante_id));
$function$;

-- ---------- 0. Por defecto, cada mes el mismo día (Sandra, 2026-09-15) ----------
alter table public.clientes_facturacion alter column frecuencia set default 'mensual';
update public.clientes_facturacion set frecuencia = 'mensual', actualizado_en = now()
 where frecuencia = 'dias' and not activo
   and restaurante_id in (select id from restaurantes where slug in ('gran-muralla', 'chino-feliz'));

-- ---------- 2 y 3. Importadas, serie X y sustituidas ----------
alter table public.facturas add column if not exists sustituida boolean not null default false;

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
     where conrelid = 'public.facturas'::regclass and contype = 'c'
       and (pg_get_constraintdef(oid) like '%origen%periodica%'
         or pg_get_constraintdef(oid) like '%rectifica_factura_id IS NOT NULL%'
         or pg_get_constraintdef(oid) like '%serie%''F''%')
  loop
    execute format('alter table public.facturas drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.facturas
  add constraint facturas_serie_valida check (serie in ('F', 'R', 'X')),
  add constraint facturas_origen_valido check (origen in ('periodica', 'manual', 'rectificativa', 'importada')),
  add constraint facturas_periodica_con_periodo
    check (origen <> 'periodica' or (periodo_inicio is not null and periodo_fin is not null)),
  add constraint facturas_rectificativa_con_original
    check ((tipo = 'rectificativa') = (rectifica_factura_id is not null)
           or (origen = 'importada' and tipo = 'rectificativa' and rectifica_factura_id is null)),
  -- La serie X solo existe para importar: la web nunca numera en ella.
  add constraint facturas_serie_x_importada check (serie <> 'X' or origen = 'importada');


-- ---------- 4. Las dos de septiembre de Gran Muralla ----------
do $$
declare
  v_rest    uuid;
  v_cli     uuid;
  v_cfg     public.facturacion_config;
  v_antigua uuid;
  v_hash    text;
  v_emisor  jsonb;
begin
  select id into v_rest from restaurantes where slug = 'gran-muralla';
  select id into v_cli from clientes_facturacion where restaurante_id = v_rest order by creado_en limit 1;
  if v_rest is null or v_cli is null then
    raise exception 'Falta Gran Muralla o su ficha de facturación (sql/facturacion_fichas_gm_chinofeliz.sql). No se ha importado nada.';
  end if;
  if coalesce((select ultimo from facturacion_contadores where serie = 'R' and anio = 2026), 0) < 1 then
    raise exception 'El contador R de 2026 no reserva la 0001. Parado.';
  end if;
  select * into v_cfg from facturacion_config where id = 1;

  -- La antigua de Stripe, tal cual salió (emisor «Comandi», sin NIF del emisor).
  select id into v_antigua from facturas where numero = '8S7OYWRK-0001';
  if v_antigua is null then
    v_hash := encode(extensions.digest('8S7OYWRK-0001|2026-09-14||B14394498|99.00|', 'sha256'), 'hex');
    insert into facturas (
      serie, anio, secuencia, numero, tipo, origen, cliente_facturacion_id, restaurante_id,
      periodo_inicio, periodo_fin, fecha_emision, emisor, receptor, concepto,
      base, iva_pct, cuota_iva, total, pdf_path, hash, hash_anterior, sustituida
    ) values (
      'X', 2026, 1, '8S7OYWRK-0001', 'ordinaria', 'importada', v_cli, v_rest,
      '2026-09-14', '2026-10-14', '2026-09-14',
      jsonb_build_object('razon_social', 'Comandi', 'cif', '', 'domicilio', 'Calle Manuel Soro Tinte, 3',
                         'cp', '14001', 'ciudad', 'Córdoba', 'provincia', 'Córdoba'),
      jsonb_build_object('razon_social', 'Restaurante Jin Wang SL', 'nif', 'B14394498', 'direccion', 'Plaza de Colón, 29',
                         'cp', '14001', 'ciudad', 'Córdoba', 'provincia', 'Córdoba',
                         'email', 'contacto@granmurallacordoba.es', 'establecimiento', 'Restaurante Gran Muralla'),
      'Comandi Básico (factura de Stripe, sustituida por la R-2026-0001)',
      81.82, 21, 17.18, 99.00, v_rest || '/8S7OYWRK-0001.pdf', v_hash, null, true
    ) returning id into v_antigua;
  end if;

  -- La rectificativa por sustitución, enlazada a la antigua.
  if not exists (select 1 from facturas where numero = 'R-2026-0001') then
    v_emisor := jsonb_build_object('razon_social', 'SCD TECH SL', 'cif', 'B88886437', 'domicilio', 'Calle Manuel Soro Tinte, 3',
                                   'cp', '14001', 'ciudad', 'Córdoba', 'provincia', 'Córdoba', 'email', 'info@comandi.es',
                                   'registro_mercantil', v_cfg.registro_mercantil);
    v_hash := encode(extensions.digest('R-2026-0001|2026-09-14|B88886437|B14394498|99.00|', 'sha256'), 'hex');
    insert into facturas (
      serie, anio, secuencia, numero, tipo, origen, rectifica_factura_id, motivo_rectificacion,
      cliente_facturacion_id, restaurante_id, periodo_inicio, periodo_fin, fecha_emision,
      emisor, receptor, concepto, base, iva_pct, cuota_iva, total, pdf_path, hash, hash_anterior
    ) values (
      'R', 2026, 1, 'R-2026-0001', 'rectificativa', 'importada', v_antigua,
      'Rectifica y sustituye a la factura nº 8S7OYWRK-0001, de 14/09/2026: no recogía la razón social ni el NIF del emisor '
        || 'y la razón social del cliente estaba mal escrita. Rectificación por sustitución (art. 15 RD 1619/2012); mismos concepto e importes.',
      v_cli, v_rest, '2026-09-14', '2026-10-14', '2026-09-14',
      v_emisor,
      jsonb_build_object('razon_social', 'RESTAURANTE JING WANG SL', 'nif', 'B14394498', 'direccion', 'Plaza Colón, 29',
                         'cp', '14001', 'ciudad', 'Córdoba', 'provincia', 'Córdoba',
                         'email', 'contacto@granmurallacordoba.es', 'establecimiento', 'Restaurante Gran Muralla'),
      'Comandi Básico · suscripción mensual', 81.82, 21, 17.18, 99.00,
      v_rest || '/R-2026-0001.pdf', v_hash, null
    );
  end if;
end $$;

-- ---------- 5. Ficha de facturación de China Town ----------
-- Datos de su contrato (contratos/clientes/china-town). DESACTIVADA y con la
-- fecha de la primera factura PROVISIONAL: poner la de la firma del servicio
-- antes de activarla.
do $$
declare v_ct uuid;
begin
  select id into v_ct from restaurantes where slug = 'china-town';
  if v_ct is null then raise exception 'No encuentro china-town'; end if;
  if not exists (select 1 from clientes_facturacion where restaurante_id = v_ct) then
    insert into clientes_facturacion (
      restaurante_id, razon_social, nif, direccion, cp, ciudad, provincia,
      concepto, importe, iva_incluido, iva_pct, frecuencia, cada_dias,
      fecha_inicio, activo, notas
    ) values (
      v_ct, 'XIU LONG ZHUANG COMERCIO SL', 'B26870899', 'Calle Luis Ponce de León, 11, bajo 1', '14004', 'Córdoba', 'Córdoba',
      'Suscripción Comandi – asistente de pedidos por WhatsApp (plan Básico)', 99, true, 21, 'mensual', 30,
      '2026-09-15', false,
      'Fecha de primera factura PROVISIONAL: poner la de la firma del servicio antes de activar.'
    );
  end if;
end $$;

notify pgrst, 'reload schema';

-- Las fichas de facturación:
select r.nombre, c.razon_social, c.nif, c.frecuencia, c.fecha_inicio, c.activo
  from clientes_facturacion c join restaurantes r on r.id = c.restaurante_id
 order by r.nombre;

-- La carpeta donde subir los dos PDF es el id de Gran Muralla:
select r.id as carpeta_de_los_pdf, f.numero, f.tipo, f.total, f.sustituida, f.pdf_path
  from facturas f join restaurantes r on r.id = f.restaurante_id
 where r.slug = 'gran-muralla'
 order by f.numero desc;
