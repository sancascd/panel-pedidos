-- =============================================================
-- FICHAS DE FACTURACIÓN: GRAN MURALLA Y CHINO FELIZ (2026-09-15)
-- =============================================================
-- Datos fiscales sacados de sus contratos (contratos/clientes/...).
-- Se crean DESACTIVADAS: no emiten nada hasta activarlas en
-- Admin → Facturación → Clientes. Se puede repetir: si ya tienen ficha, no
-- crea otra.

do $$
declare
  v_gm uuid;
  v_cf uuid;
begin
  select id into v_gm from restaurantes where slug = 'gran-muralla';
  select id into v_cf from restaurantes where slug = 'chino-feliz';
  if v_gm is null or v_cf is null then
    raise exception 'No encuentro gran-muralla o chino-feliz. No se ha creado nada.';
  end if;

  -- Gran Muralla: la mensualidad de septiembre (14/09) ya se facturó por
  -- Stripe, así que la primera de la web es la del 14/10.
  if not exists (select 1 from clientes_facturacion where restaurante_id = v_gm) then
    insert into clientes_facturacion (
      restaurante_id, razon_social, nif, direccion, cp, ciudad, provincia,
      concepto, importe, iva_incluido, iva_pct, frecuencia, cada_dias,
      fecha_inicio, activo, notas
    ) values (
      v_gm, 'RESTAURANTE JING WANG SL', 'B14394498', 'Plaza Colón, 29', '14001', 'Córdoba', 'Córdoba',
      'Suscripción Comandi – asistente de pedidos por WhatsApp (plan Básico)', 99, true, 21, 'mensual', 30,
      '2026-10-14', false,
      'Septiembre facturado por Stripe (8S7OYWRK-0001 + rectificativa R-2026-0001 a mano).'
    );
  end if;

  -- Chino Feliz: autónomo (Mingxi Ke). La fecha de la primera factura es
  -- PROVISIONAL: hay que poner la del día de la firma del servicio al activarla.
  if not exists (select 1 from clientes_facturacion where restaurante_id = v_cf) then
    insert into clientes_facturacion (
      restaurante_id, razon_social, nif, direccion, cp, ciudad, provincia,
      concepto, importe, iva_incluido, iva_pct, frecuencia, cada_dias,
      fecha_inicio, activo, notas
    ) values (
      v_cf, 'Mingxi Ke', 'X6740325Z', 'Calle Alcalá Zamora, 11', '14006', 'Córdoba', 'Córdoba',
      'Suscripción Comandi – asistente de pedidos por WhatsApp (plan Básico)', 99, true, 21, 'mensual', 30,
      '2026-09-15', false,
      'Fecha de primera factura PROVISIONAL: poner la de la firma del servicio antes de activar.'
    );
  end if;
end $$;

select c.razon_social, c.nif, r.nombre as restaurante, c.importe, c.cada_dias, c.fecha_inicio, c.activo
  from clientes_facturacion c join restaurantes r on r.id = c.restaurante_id
 order by c.razon_social;
