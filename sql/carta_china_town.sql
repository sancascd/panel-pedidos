-- =============================================================
-- Carta, horarios y menus de RESTAURANTE CHINA TOWN
-- =============================================================
-- Generado a partir de la carta impresa (foto). Los PRECIOS estan
-- transcritos de la foto y hay que repasarlos contra la carta: la columna
-- de precios sale desplazada en algunos bloques.
--
-- SIN ALCOHOL a proposito: la bebida de los menus era
-- "Refresco / cerveza / agua / vino" y aqui queda en refresco o agua.
-- WhatsApp prohibe el alcohol y basta con que un nombre lo mencione.
--
-- Es repetible: borra la carta y los menus de ESTE restaurante y los
-- vuelve a crear. No toca los pedidos.

do $$
declare
  -- Poner en true SOLO para rehacer la carta desde cero. Ojo: se lleva por
  -- delante cualquier correccion hecha a mano en el panel.
  c_rehacer boolean := false;
  v_rest uuid;
  v_platos int;
  v_cat  uuid;
  v_menu uuid;
  v_grupo uuid;
begin
  select id into v_rest from restaurantes where slug = 'china-town';
  if v_rest is null then
    raise exception 'No existe el restaurante china-town';
  end if;

  -- Este script BORRA la carta y la vuelve a crear. Una vez cargada, los
  -- precios se corrigen en el panel contra la carta de verdad, y volver a
  -- ejecutarlo aqui los machaca sin avisar. Paso dos veces el 2026-09-10.
  select count(*) into v_platos from productos where restaurante_id = v_rest;
  if v_platos > 0 and not c_rehacer then
    raise exception 'Este restaurante ya tiene % platos cargados. Si de verdad quieres rehacer la carta entera, pon c_rehacer := true arriba.', v_platos;
  end if;

  -- ---------- Direccion del local ----------
  -- La de la ficha era el domicilio social. Esta es la del local, que es la
  -- que el bot le da al cliente que va a recoger.
  update restaurantes
     set direccion = 'Paseo de la Victoria, 23, 14004 Córdoba'
   where id = v_rest;

  -- ---------- Horarios ----------
  -- Abierto todos los dias, 12:00-16:00 y 19:30-23:30. Ningun turno cruza
  -- medianoche, asi que no hay noche que se pierda.
  delete from horarios where restaurante_id = v_rest;
  insert into horarios (restaurante_id, dia_semana, cerrado,
                        manana_apertura, manana_cierre, noche_apertura, noche_cierre)
  select v_rest, d, false, '12:00', '16:00', '19:30', '23:30' from generate_series(1, 7) as d;

  -- ---------- Fuera lo anterior ----------
  delete from menus where restaurante_id = v_rest;   -- arrastra grupos y opciones
  delete from productos where restaurante_id = v_rest;
  delete from categorias where restaurante_id = v_rest;

  -- ----- Sopas -----
  insert into categorias (restaurante_id, nombre, orden)
  values (v_rest, 'Sopas', 1) returning id into v_cat;
  insert into productos (restaurante_id, categoria_id, numero, nombre, precio, disponible) values
    (v_rest, v_cat, '1', 'Sopa de huevos revuelto', 3.50, true),
    (v_rest, v_cat, '2', 'Sopa de champiñones con gambas', 4.00, true),
    (v_rest, v_cat, '3', 'Sopa de pollo con champiñón', 4.00, true),
    (v_rest, v_cat, '4', 'Sopa wan tun', 4.50, true),
    (v_rest, v_cat, '5', 'Sopa agripicante', 4.00, true),
    (v_rest, v_cat, '6', 'Sopa de curry', 4.50, true),
    (v_rest, v_cat, '7', 'Sopa de tallarines', 7.00, true),
    (v_rest, v_cat, '8', 'Sopa de maíz con pollo', 4.00, true),
    (v_rest, v_cat, '9', 'Sopa de mariscos', 4.50, true);

  -- ----- Ensaladas y entrantes -----
  insert into categorias (restaurante_id, nombre, orden)
  values (v_rest, 'Ensaladas y entrantes', 2) returning id into v_cat;
  insert into productos (restaurante_id, categoria_id, numero, nombre, precio, disponible) values
    (v_rest, v_cat, '10', 'Ensalada china', 4.75, true),
    (v_rest, v_cat, '11', 'Rollos especiales de Vietnam (6 piezas)', 4.50, true),
    (v_rest, v_cat, '11A', 'Rollos de mariscos fritos (6 piezas)', 5.50, true),
    (v_rest, v_cat, '12', 'Ensalada de gambas', 5.95, true),
    (v_rest, v_cat, '12A', 'Ensalada especial de la casa', 6.90, true),
    (v_rest, v_cat, '13', 'Ensalada de brotes de soja con carne de cangrejo', 5.50, true),
    (v_rest, v_cat, '14', 'Ensalada con fruta', 5.75, true),
    (v_rest, v_cat, '15', 'Rollo de primavera', 2.00, true),
    (v_rest, v_cat, '16', 'Wan tun fritos', 4.90, true),
    (v_rest, v_cat, '17', 'Hoja de gambas chinas (fritas)', 3.75, true),
    (v_rest, v_cat, '19A', 'Patatas fritas', 3.80, true),
    (v_rest, v_cat, '19', 'Pan chino frito o al vapor', 2.00, true),
    (v_rest, v_cat, '19B', 'Pan chino relleno de carne (2 piezas), frito o al vapor', 5.50, true);

  -- ----- Arroz y tallarines -----
  insert into categorias (restaurante_id, nombre, orden)
  values (v_rest, 'Arroz y tallarines', 3) returning id into v_cat;
  insert into productos (restaurante_id, categoria_id, numero, nombre, precio, disponible) values
    (v_rest, v_cat, '20', 'Tallarines fritos con ternera', 5.75, true),
    (v_rest, v_cat, '21', 'Tallarines fritos con gambas', 6.25, true),
    (v_rest, v_cat, '22', 'Tallarines fritos con tres delicias', 6.25, true),
    (v_rest, v_cat, '22A', 'Tallarines al estilo Pekín', 6.25, true),
    (v_rest, v_cat, '22B', 'Tallarines fritos con salsa de curry', 5.95, true),
    (v_rest, v_cat, '22C', 'Tallarines Udon', 6.85, true),
    (v_rest, v_cat, '23', 'Arroz frito con salsa de curry', 5.75, true),
    (v_rest, v_cat, '24', 'Arroz frito tres delicias', 5.00, true),
    (v_rest, v_cat, '25', 'Arroz frito con gambas', 5.90, true),
    (v_rest, v_cat, '87', 'Arroz frito especial de la casa', 6.75, true),
    (v_rest, v_cat, '26', 'Arroz blanco', 2.75, true),
    (v_rest, v_cat, '27', 'Arroz con ternera en salsa curry', 5.70, true),
    (v_rest, v_cat, '28', 'Arroz con pollo en salsa curry', 5.75, true),
    (v_rest, v_cat, '29', 'Arroz con gambas en salsa curry', 5.90, true),
    (v_rest, v_cat, '29A', 'Empanadilla a la plancha', 7.25, true),
    (v_rest, v_cat, '92', 'Kubak con tres delicias', 6.95, true),
    (v_rest, v_cat, '93', 'Kubak con gambas', 7.35, true),
    (v_rest, v_cat, '39', 'Fideos de soja con tres delicias', 6.50, true),
    (v_rest, v_cat, '39A', 'Fideos de arroz chinos con tres delicias', 6.50, true),
    (v_rest, v_cat, '39B', 'Pasta de arroz con tres delicias', 6.85, true);

  -- ----- Verduras y tortillas -----
  insert into categorias (restaurante_id, nombre, orden)
  values (v_rest, 'Verduras y tortillas', 4) returning id into v_cat;
  insert into productos (restaurante_id, categoria_id, numero, nombre, precio, disponible) values
    (v_rest, v_cat, '30', 'Verduras salteadas (variadas)', 5.95, true),
    (v_rest, v_cat, '30A', 'Col china salteada', 5.95, true),
    (v_rest, v_cat, '31', 'Setas chinas y hongos chinos salteados', 7.20, true),
    (v_rest, v_cat, '32', 'Brotes de soja salteados', 5.90, true),
    (v_rest, v_cat, '33', 'Brotes de bambú y setas chinas salteadas', 7.00, true),
    (v_rest, v_cat, '34', 'Huevos revueltos con jamón', 5.50, true),
    (v_rest, v_cat, '35', 'Huevos revueltos con gambas', 5.95, true),
    (v_rest, v_cat, '36', 'Tofu picante', 6.35, true),
    (v_rest, v_cat, '37', 'Tofu con verduras', 6.35, true),
    (v_rest, v_cat, '38', 'Huevos fritos con patatas', 5.95, true);

  -- ----- Ternera y cordero -----
  insert into categorias (restaurante_id, nombre, orden)
  values (v_rest, 'Ternera y cordero', 5) returning id into v_cat;
  insert into productos (restaurante_id, categoria_id, numero, nombre, precio, disponible) values
    (v_rest, v_cat, '40', 'Ternera con verdura', 7.95, true),
    (v_rest, v_cat, '40A', 'Ternera con patatas fritas', 7.95, true),
    (v_rest, v_cat, '40B', 'Ternera estofada', 7.95, true),
    (v_rest, v_cat, '41', 'Ternera con salsa de ostras', 7.95, true),
    (v_rest, v_cat, '42', 'Ternera con cebollas', 7.95, true),
    (v_rest, v_cat, '43', 'Ternera con pimientos verdes', 7.95, true),
    (v_rest, v_cat, '44', 'Ternera con salsa curry', 7.95, true),
    (v_rest, v_cat, '45', 'Ternera salteada picante', 7.95, true),
    (v_rest, v_cat, '46', 'Ternera con bambú y setas chinas', 8.50, true),
    (v_rest, v_cat, '47', 'Ternera con brotes de soja', 7.95, true),
    (v_rest, v_cat, '48', 'Ternera en fuente quemada al estilo chino', 7.95, true),
    (v_rest, v_cat, '49', 'Ternera con champiñón', 7.95, true),
    (v_rest, v_cat, '49A', 'Ternera con salsa picante y zanahorias', 7.95, true),
    (v_rest, v_cat, '49B', 'Ternera con salsa de pimienta negra', 7.95, true),
    (v_rest, v_cat, '95', 'Cordero salteado', 15.50, true);

  -- ----- Cerdo -----
  insert into categorias (restaurante_id, nombre, orden)
  values (v_rest, 'Cerdo', 6) returning id into v_cat;
  insert into productos (restaurante_id, categoria_id, numero, nombre, precio, disponible) values
    (v_rest, v_cat, '50', 'Cerdo con verduras', 6.95, true),
    (v_rest, v_cat, '50A', 'Cerdo estofado', 6.95, true),
    (v_rest, v_cat, '51', 'Cerdo agridulce', 6.95, true),
    (v_rest, v_cat, '52', 'Costillas agridulces o con salsa china', 7.95, true),
    (v_rest, v_cat, '53', 'Costillas asadas', 7.95, true),
    (v_rest, v_cat, '54', 'Cerdo con salsa de ostras', 6.95, true),
    (v_rest, v_cat, '55', 'Cerdo con guindillas', 6.95, true),
    (v_rest, v_cat, '56', 'Cerdo con bambú y setas chinas', 7.95, true),
    (v_rest, v_cat, '57', 'Cerdo salteado con brotes de soja', 6.95, true),
    (v_rest, v_cat, '58', 'Cerdo con cebolletas', 6.95, true),
    (v_rest, v_cat, '59', 'Cerdo en fuente quemada al estilo chino', 7.95, true),
    (v_rest, v_cat, '59A', 'Cerdo con champiñón', 7.00, true),
    (v_rest, v_cat, '96', 'Cerdo asado especial de la casa', 8.50, true);

  -- ----- Pollo -----
  insert into categorias (restaurante_id, nombre, orden)
  values (v_rest, 'Pollo', 7) returning id into v_cat;
  insert into productos (restaurante_id, categoria_id, numero, nombre, precio, disponible) values
    (v_rest, v_cat, '60', 'Pollo con verduras', 6.95, true),
    (v_rest, v_cat, '60A', 'Pollo con piña', 6.95, true),
    (v_rest, v_cat, '61', 'Pollo al limón', 6.95, true),
    (v_rest, v_cat, '62', 'Pollo con almendras', 6.95, true),
    (v_rest, v_cat, '63', 'Pollo con curry', 6.95, true),
    (v_rest, v_cat, '64', 'Pollo agridulce', 6.95, true),
    (v_rest, v_cat, '65', 'Alitas de pollo fritas', 6.95, true),
    (v_rest, v_cat, '66', 'Pollo con bambú y setas chinas', 7.95, true),
    (v_rest, v_cat, '67', 'Pollo con salsa picante', 6.95, true),
    (v_rest, v_cat, '68', 'Pollo con champiñón', 6.95, true),
    (v_rest, v_cat, '69', 'Pollo frito troceado con patatas fritas', 6.95, true),
    (v_rest, v_cat, '70', 'Pollo teriyaki', 8.75, true);

  -- ----- Pato -----
  insert into categorias (restaurante_id, nombre, orden)
  values (v_rest, 'Pato', 8) returning id into v_cat;
  insert into productos (restaurante_id, categoria_id, numero, nombre, precio, disponible) values
    (v_rest, v_cat, '71', 'Pato a la naranja', 12.95, true),
    (v_rest, v_cat, '72', 'Pato con piña', 12.95, true),
    (v_rest, v_cat, '73', 'Pato con bambú y setas chinas', 13.50, true),
    (v_rest, v_cat, '74', 'Pato con cinco aromas estilo chino', 12.95, true),
    (v_rest, v_cat, '75', 'Pato asado estilo Pekín', 13.95, true);

  -- ----- Pescado y marisco -----
  insert into categorias (restaurante_id, nombre, orden)
  values (v_rest, 'Pescado y marisco', 9) returning id into v_cat;
  insert into productos (restaurante_id, categoria_id, numero, nombre, precio, disponible) values
    (v_rest, v_cat, '76', 'Bacalao frito (salsa a elegir: soja, picante o agridulce)', 9.50, true),
    (v_rest, v_cat, '77', 'Verduras con gambas', 9.50, true),
    (v_rest, v_cat, '78', 'Gambas fritas rebozadas', 9.95, true),
    (v_rest, v_cat, '79', 'Salteado variado de marisco', 9.50, true),
    (v_rest, v_cat, '80', 'Gambas agridulces', 9.50, true),
    (v_rest, v_cat, '80A', 'Gambas teriyaki', 9.50, true),
    (v_rest, v_cat, '81', 'Gambas salteadas con bambú y setas chinas', 9.95, true),
    (v_rest, v_cat, '82', 'Gambas con guindillas', 9.50, true),
    (v_rest, v_cat, '83', 'Langostinos con salsa de soja', 11.95, true),
    (v_rest, v_cat, '84', 'Langostinos con salsa picante', 11.95, true),
    (v_rest, v_cat, '85', 'Calamares con salsa picante', 8.50, true),
    (v_rest, v_cat, '86', 'Gambas con salsa curry', 9.50, true),
    (v_rest, v_cat, '86A', 'Gambas con champiñón', 9.50, true),
    (v_rest, v_cat, '86B', 'Gambas a la plancha a la pimienta', 9.50, true),
    (v_rest, v_cat, '86C', 'Gambas al ajillo', 9.50, true),
    (v_rest, v_cat, '88', 'Calamares al estilo chino en fuente quemada', 8.90, true),
    (v_rest, v_cat, '89', 'Lubina al vapor', 15.50, true),
    (v_rest, v_cat, '90', 'La familia feliz (surtido salteado)', 9.50, true),
    (v_rest, v_cat, '91', 'Gambas a la plancha con salsa china', 9.50, true),
    (v_rest, v_cat, '94', 'Gambas con hongos chinos', 10.50, true),
    (v_rest, v_cat, '97', 'Sepias al KonPao (picante)', 11.50, true),
    (v_rest, v_cat, '98', 'Sepias salteadas con ajetes', 11.50, true),
    (v_rest, v_cat, '99', 'Cangrejo chino salteado', 15.00, true);

  -- ---------- Menus ----------
  -- Menú para 1 persona
  insert into menus (restaurante_id, nombre, descripcion, precio, activo, dias_semana, turno, orden)
  values (v_rest, 'Menú para 1 persona', 'Un primero, un arroz o tallarines y un plato principal, con bebida y postre.', 15.00, true, '{1,2,3,4,5,6,7}'::smallint[], null, 1) returning id into v_menu;
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  values (v_menu, v_rest, 'Primero', 1) returning id into v_grupo;
  insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, suplemento, orden) values
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Rollo de primavera') limit 1), 'Rollo de primavera', 0, 1),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Pan chino frito o al vapor') limit 1), 'Pan chino frito o al vapor', 0, 2);
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  values (v_menu, v_rest, 'Arroz o tallarines', 2) returning id into v_grupo;
  insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, suplemento, orden) values
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Arroz frito tres delicias') limit 1), 'Arroz frito tres delicias', 0, 1),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Tallarines fritos con tres delicias') limit 1), 'Tallarines fritos con tres delicias', 0, 2);
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  values (v_menu, v_rest, 'Plato principal', 3) returning id into v_grupo;
  insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, suplemento, orden) values
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Pollo con almendras') limit 1), 'Pollo con almendras', 0, 1),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Ternera con salsa de ostras') limit 1), 'Ternera con salsa de ostras', 0, 2);
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  values (v_menu, v_rest, 'Bebida', 4) returning id into v_grupo;
  insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, suplemento, orden) values
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Refresco') limit 1), 'Refresco', 0, 1),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Agua') limit 1), 'Agua', 0, 2);
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  values (v_menu, v_rest, 'Postre', 5) returning id into v_grupo;
  insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, suplemento, orden) values
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Flan') limit 1), 'Flan', 0, 1),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Helado') limit 1), 'Helado', 0, 2),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Frutas') limit 1), 'Frutas', 0, 3),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Café o té chino') limit 1), 'Café o té chino', 0, 4);

  -- Menú para 2 personas
  insert into menus (restaurante_id, nombre, descripcion, precio, activo, dias_semana, turno, orden)
  values (v_rest, 'Menú para 2 personas', '2 rollos de primavera
1 ensalada china
1 arroz frito tres delicias
1 pollo con almendras
1 ternera con salsa de ostras
Bebida y postre incluidos', 25.00, true, '{1,2,3,4,5,6,7}'::smallint[], null, 2) returning id into v_menu;

  -- Menú para 3 personas
  insert into menus (restaurante_id, nombre, descripcion, precio, activo, dias_semana, turno, orden)
  values (v_rest, 'Menú para 3 personas', '3 rollos de primavera
1 ensalada china
1 arroz frito tres delicias
1 pollo con almendras
1 ternera con salsa de ostras
1 cerdo agridulce
Bebida y postre incluidos', 37.00, true, '{1,2,3,4,5,6,7}'::smallint[], null, 3) returning id into v_menu;

  -- Menú para 4 personas
  insert into menus (restaurante_id, nombre, descripcion, precio, activo, dias_semana, turno, orden)
  values (v_rest, 'Menú para 4 personas', '4 rollos de primavera
1 ensalada china
1 arroz frito tres delicias
1 ternera con salsa de ostras
1 pollo con almendras
1 familia feliz
1 fideos fritos con tres delicias
Bebida y postre incluidos', 49.00, true, '{1,2,3,4,5,6,7}'::smallint[], null, 4) returning id into v_menu;

  -- Menú para 5 personas
  insert into menus (restaurante_id, nombre, descripcion, precio, activo, dias_semana, turno, orden)
  values (v_rest, 'Menú para 5 personas', '5 rollos de primavera
2 ensaladas chinas
2 arroces fritos tres delicias
1 pollo con almendras
1 ternera con salsa de ostras
1 cerdo agridulce
1 tallarines fritos tres delicias
1 familia feliz
Bebida y postre incluidos', 67.00, true, '{1,2,3,4,5,6,7}'::smallint[], null, 5) returning id into v_menu;

  -- Menú para 6 personas
  insert into menus (restaurante_id, nombre, descripcion, precio, activo, dias_semana, turno, orden)
  values (v_rest, 'Menú para 6 personas', '6 rollos de primavera
2 ensaladas chinas
2 arroces fritos tres delicias
1 pollo con almendras
1 ternera con salsa de ostras
1 cerdo agridulce
1 familia feliz
1 verduras con gambas
1 tallarines fritos con tres delicias
Bebida y postre incluidos', 79.00, true, '{1,2,3,4,5,6,7}'::smallint[], null, 6) returning id into v_menu;

  -- Menú 1 del mediodía
  insert into menus (restaurante_id, nombre, descripcion, precio, activo, dias_semana, turno, orden)
  values (v_rest, 'Menú 1 del mediodía', 'De lunes a viernes, excepto festivos.', 11.00, true, '{1,2,3,4,5}'::smallint[], 'manana', 7) returning id into v_menu;
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  values (v_menu, v_rest, 'Primero', 1) returning id into v_grupo;
  insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, suplemento, orden) values
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Sopa de maíz con pollo') limit 1), 'Sopa de maíz con pollo', 0, 1),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Sopa de huevos revuelto') limit 1), 'Sopa de huevos revuelto', 0, 2),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Sopa agripicante') limit 1), 'Sopa agripicante', 0, 3),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Rollo de primavera') limit 1), 'Rollo de primavera', 0, 4),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Ensalada china') limit 1), 'Ensalada china', 0, 5),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Pan chino frito o al vapor') limit 1), 'Pan chino frito o al vapor', 0, 6),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Pan de gambas') limit 1), 'Pan de gambas', 0, 7);
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  values (v_menu, v_rest, 'Segundo', 2) returning id into v_grupo;
  insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, suplemento, orden) values
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Arroz frito tres delicias') limit 1), 'Arroz frito tres delicias', 0, 1),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Tallarines fritos con tres delicias') limit 1), 'Tallarines fritos con tres delicias', 0, 2),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Arroz blanco') limit 1), 'Arroz blanco', 0, 3),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Patatas fritas') limit 1), 'Patatas fritas', 0, 4),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Arroz frito especial de la casa') limit 1), 'Arroz frito especial de la casa', 0, 5);
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  values (v_menu, v_rest, 'Tercero', 3) returning id into v_grupo;
  insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, suplemento, orden) values
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Alitas de pollo fritas') limit 1), 'Alitas de pollo fritas', 0, 1),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Pollo con almendras') limit 1), 'Pollo con almendras', 0, 2),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Pollo agridulce') limit 1), 'Pollo agridulce', 0, 3),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Pollo con verduras') limit 1), 'Pollo con verduras', 0, 4),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Pollo al limón') limit 1), 'Pollo al limón', 0, 5),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Cerdo agridulce') limit 1), 'Cerdo agridulce', 0, 6),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Verduras salteadas (variadas)') limit 1), 'Verduras salteadas (variadas)', 0, 7),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Huevos revueltos con jamón') limit 1), 'Huevos revueltos con jamón', 0, 8),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Ternera con pimientos verdes') limit 1), 'Ternera con pimientos verdes', 0, 9),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Ternera con salsa picante y zanahorias') limit 1), 'Ternera con salsa picante y zanahorias', 0, 10);
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  values (v_menu, v_rest, 'Bebida', 4) returning id into v_grupo;
  insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, suplemento, orden) values
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Refresco') limit 1), 'Refresco', 0, 1),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Agua') limit 1), 'Agua', 0, 2);
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  values (v_menu, v_rest, 'Postre', 5) returning id into v_grupo;
  insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, suplemento, orden) values
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Flan') limit 1), 'Flan', 0, 1),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Helado') limit 1), 'Helado', 0, 2),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Frutas') limit 1), 'Frutas', 0, 3),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Café o té chino') limit 1), 'Café o té chino', 0, 4);

  -- Menú 2 del mediodía
  insert into menus (restaurante_id, nombre, descripcion, precio, activo, dias_semana, turno, orden)
  values (v_rest, 'Menú 2 del mediodía', 'De lunes a viernes, excepto festivos.', 13.00, true, '{1,2,3,4,5}'::smallint[], 'manana', 8) returning id into v_menu;
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  values (v_menu, v_rest, 'Primero', 1) returning id into v_grupo;
  insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, suplemento, orden) values
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Rollos de mariscos fritos (6 piezas)') limit 1), 'Rollos de mariscos fritos (6 piezas)', 0, 1),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Rollos especiales de Vietnam (6 piezas)') limit 1), 'Rollos especiales de Vietnam (6 piezas)', 0, 2),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Rollo de primavera') limit 1), 'Rollo de primavera', 0, 3),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Wan tun fritos') limit 1), 'Wan tun fritos', 0, 4),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Sopa de mariscos') limit 1), 'Sopa de mariscos', 0, 5),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Sopa wan tun') limit 1), 'Sopa wan tun', 0, 6),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Ensalada especial de la casa') limit 1), 'Ensalada especial de la casa', 0, 7);
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  values (v_menu, v_rest, 'Segundo', 2) returning id into v_grupo;
  insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, suplemento, orden) values
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Arroz frito tres delicias') limit 1), 'Arroz frito tres delicias', 0, 1),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Tallarines fritos con tres delicias') limit 1), 'Tallarines fritos con tres delicias', 0, 2),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Arroz blanco') limit 1), 'Arroz blanco', 0, 3),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Fideos de arroz chinos con tres delicias') limit 1), 'Fideos de arroz chinos con tres delicias', 0, 4),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Arroz frito especial de la casa') limit 1), 'Arroz frito especial de la casa', 0, 5);
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  values (v_menu, v_rest, 'Tercero', 3) returning id into v_grupo;
  insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, suplemento, orden) values
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Ternera con bambú y setas chinas') limit 1), 'Ternera con bambú y setas chinas', 0, 1),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Gambas con salsa curry') limit 1), 'Gambas con salsa curry', 0, 2),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Verduras con gambas') limit 1), 'Verduras con gambas', 0, 3),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Pato con bambú y setas chinas') limit 1), 'Pato con bambú y setas chinas', 0, 4),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Pato a la naranja') limit 1), 'Pato a la naranja', 0, 5),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Bacalao frito (salsa a elegir: soja, picante o agridulce)') limit 1), 'Bacalao frito (salsa a elegir: soja, picante o agridulce)', 0, 6),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Pollo teriyaki') limit 1), 'Pollo teriyaki', 0, 7),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Calamares con salsa picante') limit 1), 'Calamares con salsa picante', 0, 8),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Calamares al estilo chino en fuente quemada') limit 1), 'Calamares al estilo chino en fuente quemada', 0, 9),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Col china salteada') limit 1), 'Col china salteada', 0, 10);
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  values (v_menu, v_rest, 'Bebida', 4) returning id into v_grupo;
  insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, suplemento, orden) values
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Refresco') limit 1), 'Refresco', 0, 1),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Agua') limit 1), 'Agua', 0, 2);
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  values (v_menu, v_rest, 'Postre', 5) returning id into v_grupo;
  insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, suplemento, orden) values
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Flan') limit 1), 'Flan', 0, 1),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Helado') limit 1), 'Helado', 0, 2),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Frutas') limit 1), 'Frutas', 0, 3),
    (v_grupo, v_rest, (select p.id from productos p where p.restaurante_id = v_rest and lower(p.nombre) = lower('Café o té chino') limit 1), 'Café o té chino', 0, 4);

  raise notice 'Carta, horarios y menus cargados en China Town';
end $$;

-- ---------- Comprobacion ----------
select c.nombre as categoria, count(p.id) as platos
  from categorias c
  left join productos p on p.categoria_id = c.id
 where c.restaurante_id = (select id from restaurantes where slug = 'china-town')
 group by c.nombre, c.orden order by c.orden;

select m.nombre, m.precio, m.turno, m.dias_semana,
       (select count(*) from menu_grupos g where g.menu_id = m.id) as grupos
  from menus m
 where m.restaurante_id = (select id from restaurantes where slug = 'china-town')
 order by m.orden;
