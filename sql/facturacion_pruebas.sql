-- =============================================================
-- PRUEBAS DE LA FACTURACIÓN (en la base de datos de verdad)
-- =============================================================
-- Se ejecuta DESPUÉS de sql/facturacion.sql.
--
-- NO DEJA NADA: todo va en un único bloque que termina lanzando un error a
-- propósito, y un error deshace la transacción entera (clientes de prueba,
-- facturas, contadores). Por eso, cuando todo va bien, el resultado es un
-- ERROR que dice:  «TODAS LAS PRUEBAS OK (no se ha guardado nada)».
-- Cualquier otro error = una prueba ha fallado, y dice cuál.
--
-- Qué comprueba:
--  1. Emitir dos veces el mismo periodo devuelve la misma factura.
--  2. Numeración correlativa y sin huecos, única entre restaurantes.
--  3. Cambio de año: vuelve a 0001.
--  4. No se factura un periodo futuro ni anterior a la primera factura.
--  5. Una factura no se puede modificar ni borrar; solo apuntar su PDF una vez.
--  6. Rectificativa: serie R, en negativo, una sola vez por factura.
--  7. Hash encadenado.
--  8. Un restaurante no ve las facturas de otro (RLS) y no puede emitir.
--  9. Importes: 99 / 149 / 249 € con IVA incluido cuadran al céntimo.
-- 10. Precio de promoción en los primeros periodos.
--
-- Dos emisiones A LA VEZ no se pueden lanzar desde un solo script. Lo cubre
-- el diseño: el contador se bloquea con insert ... on conflict do update
-- (la segunda espera a que la primera termine) y (serie, año, secuencia) y
-- numero son únicos, así que un duplicado no podría ni guardarse.

do $$
declare
  v_rest_a  uuid;
  v_rest_b  uuid;
  v_user_a  uuid;
  v_cli_a   uuid;
  v_cli_b   uuid;
  f1 public.facturas;
  f2 public.facturas;
  f3 public.facturas;
  r1 public.facturas;
  v_num     int;
  v_count   int;
  v_ok      boolean;
  imp record;
begin
  -- Datos del emisor completos para poder emitir (se deshace al final).
  update facturacion_config set registro_mercantil = coalesce(registro_mercantil, 'Registro de prueba') where id = 1;

  -- Dos restaurantes: A con un usuario vinculado, B cualquier otro.
  select ur.restaurante_id, ur.usuario_id into v_rest_a, v_user_a
    from usuarios_restaurante ur join restaurantes r on r.id = ur.restaurante_id
   where not exists (select 1 from usuarios_restaurante u2 where u2.usuario_id = ur.usuario_id and u2.restaurante_id <> ur.restaurante_id)
   limit 1;
  select id into v_rest_b from restaurantes where id <> v_rest_a limit 1;
  if v_rest_a is null or v_rest_b is null then
    raise exception 'PRUEBA NO EJECUTABLE: hacen falta dos restaurantes y uno con usuario';
  end if;

  -- Año de prueba lejano para no chocar con la numeración real (se deshace igual).
  perform set_config('facturacion.hoy', '2031-12-20', true);

  insert into clientes_facturacion (restaurante_id, razon_social, nif, direccion, importe, fecha_inicio, activo)
  values (v_rest_a, 'PRUEBA A SL', 'B00000001', 'Calle A 1', 99, '2031-11-20', false) returning id into v_cli_a;
  update clientes_facturacion set activo = true where id = v_cli_a;
  insert into clientes_facturacion (restaurante_id, razon_social, nif, direccion, importe, fecha_inicio, activo)
  values (v_rest_b, 'PRUEBA B SL', 'B00000002', 'Calle B 2', 149, '2031-12-01', false) returning id into v_cli_b;
  -- Por si alguno de los dos ya tuviera ficha activa de verdad, las de prueba
  -- se activan quitando la marca a las reales (se deshace al final).
  update clientes_facturacion set activo = false where restaurante_id in (v_rest_a, v_rest_b) and id not in (v_cli_a, v_cli_b);
  update clientes_facturacion set activo = true where id in (v_cli_a, v_cli_b);

  -- 1. Idempotencia
  f1 := emitir_factura(v_cli_a, '2031-11-20', '2031-12-19', 0);
  f2 := emitir_factura(v_cli_a, '2031-11-20', '2031-12-19', 0);
  if f1.id <> f2.id then raise exception 'FALLA 1: emitir dos veces creó dos facturas'; end if;

  -- 2. Correlativa entre restaurantes (y 10. promoción: B paga 49 € los 3 primeros)
  update clientes_facturacion set tramos = '[{"periodos":1,"importe":49},{"periodos":2,"importe":79}]' where id = v_cli_b;
  if facturacion_importe_periodo((select c from clientes_facturacion c where id = v_cli_b), 1) <> 79
     or facturacion_importe_periodo((select c from clientes_facturacion c where id = v_cli_b), 3) <> 149 then
    raise exception 'FALLA 10: los tramos no escalonan bien';
  end if;
  v_ok := false;
  begin update clientes_facturacion set tramos = '[{"periodos":0,"importe":49}]' where id = v_cli_b;
  exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FALLA 10: aceptó un tramo de 0 periodos'; end if;
  f2 := emitir_factura(v_cli_b, '2031-12-01', '2031-12-31', 0);
  if f2.total <> 49 then raise exception 'FALLA 10: la promoción no se aplicó (total %)', f2.total; end if;
  if (select total from emitir_factura(v_cli_a, '2031-11-20', '2031-12-19', 0)) <> 99 then
    raise exception 'FALLA 10: sin promoción no es el importe normal';
  end if;
  f3 := emitir_factura(v_cli_a, '2031-12-20', '2032-01-18', 1);
  if f1.numero <> '2031-0001' or f2.numero <> '2031-0002' or f3.numero <> '2031-0003' then
    raise exception 'FALLA 2: numeración % / % / %', f1.numero, f2.numero, f3.numero;
  end if;

  -- 4. Futuro y anterior al inicio
  v_ok := false;
  begin perform emitir_factura(v_cli_a, '2032-01-19', '2032-02-17', 2); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FALLA 4: dejó facturar un periodo futuro'; end if;
  v_ok := false;
  begin perform emitir_factura(v_cli_a, '2031-10-21', '2031-11-19', 0); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FALLA 4: dejó facturar antes de la primera factura'; end if;

  -- 5. Inmutable
  v_ok := false;
  begin update facturas set total = 1 where id = f1.id; exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FALLA 5: se pudo modificar el total'; end if;
  v_ok := false;
  begin delete from facturas where id = f1.id; exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FALLA 5: se pudo borrar una factura'; end if;
  update facturas set pdf_path = 'x/prueba.pdf' where id = f1.id;
  v_ok := false;
  begin update facturas set pdf_path = 'x/otro.pdf' where id = f1.id; exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FALLA 5: se pudo cambiar un PDF ya apuntado'; end if;

  -- 6. Rectificativa
  select coalesce(max(ultimo), 0) into v_num from facturacion_contadores where serie = 'R' and anio = 2031;
  r1 := emitir_rectificativa(f2.id, 'Prueba');
  if r1.numero <> 'R-2031-' || lpad((v_num + 1)::text, 4, '0') or r1.total <> -f2.total or r1.rectifica_factura_id <> f2.id then
    raise exception 'FALLA 6: rectificativa % total %', r1.numero, r1.total;
  end if;
  v_ok := false;
  begin perform emitir_rectificativa(f2.id, 'Otra vez'); exception when others then v_ok := true; end;
  if not v_ok then raise exception 'FALLA 6: se rectificó dos veces la misma factura'; end if;

  -- 7. Hash encadenado
  if f2.hash_anterior is distinct from f1.hash or f3.hash_anterior is distinct from f2.hash or length(f3.hash) <> 64 then
    raise exception 'FALLA 7: la cadena de hashes no enlaza';
  end if;

  -- 3. Cambio de año
  perform set_config('facturacion.hoy', '2032-01-19', true);
  f1 := emitir_factura(v_cli_a, '2032-01-19', '2032-02-17', 2);
  if f1.numero <> '2032-0001' then raise exception 'FALLA 3: el año nuevo empieza en %', f1.numero; end if;

  -- 9. Importes con IVA incluido
  for imp in select * from (values (99::numeric), (149), (249)) as t(importe) loop
    if (select base + cuota from facturacion_importes(imp.importe, true, 21)) <> imp.importe then
      raise exception 'FALLA 9: % € no cuadra', imp.importe;
    end if;
  end loop;

  -- 8. RLS: como el usuario del restaurante A
  perform set_config('request.jwt.claims', json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_count from facturas where restaurante_id = v_rest_b;
  if v_count <> 0 then reset role; raise exception 'FALLA 8: el restaurante A ve % facturas del B', v_count; end if;
  select count(*) into v_count from facturas where restaurante_id = v_rest_a;
  if v_count < 3 then reset role; raise exception 'FALLA 8: el restaurante A no ve las suyas (%)', v_count; end if;
  v_ok := false;
  begin perform emitir_factura(v_cli_a, '2032-01-19', '2032-02-17', 2); exception when others then v_ok := true; end;
  if not v_ok then reset role; raise exception 'FALLA 8: un restaurante pudo llamar a emitir_factura'; end if;
  v_ok := false;
  begin perform * from clientes_facturacion limit 1; exception when others then v_ok := true; end;
  if not v_ok then reset role; raise exception 'FALLA 8: un restaurante puede leer clientes_facturacion'; end if;
  reset role;

  raise exception 'TODAS LAS PRUEBAS OK (no se ha guardado nada)';
end $$;
