-- =============================================================
-- Carga de los dos menús de Gran Muralla
-- =============================================================
-- Requiere haber ejecutado antes sql/menus.sql.
--
-- Cada opción intenta enlazarse con un plato de la carta (para que el ticket
-- salga con su número). La que no encuentre pareja se queda como opción "solo
-- menú": es lo normal en los postres, que no se venden sueltos.
--
-- Es idempotente: borra los dos menús y los vuelve a crear. Se puede repetir.

do $$
declare
  v_rest uuid;
begin
  select id into v_rest from restaurantes where slug = 'gran-muralla';
  if v_rest is null then raise exception 'No existe el restaurante gran-muralla'; end if;

  delete from menus where restaurante_id = v_rest and nombre in ('Menú del Día', 'Menú Gran Selección');

  insert into menus (restaurante_id, nombre, descripcion, precio, dias_semana, turno, orden)
  values
    (v_rest, 'Menú del Día',        'De lunes a viernes a mediodía, excepto festivos', 12.95, '{1,2,3,4,5}', 'manana', 1),
    (v_rest, 'Menú Gran Selección', 'De lunes a viernes a mediodía, excepto festivos', 14.95, '{1,2,3,4,5}', 'manana', 2);
end $$;

-- ---------- Grupos y opciones ----------
with rest as (
  select id from restaurantes where slug = 'gran-muralla'
),
-- menu | grupo | orden_grupo | subgrupo | orden | nombre a mostrar | patrón de búsqueda | precio exacto
datos(menu, grupo, og, subgrupo, ord, nombre, busca, precio) as (values
  -- ===================== MENÚ DEL DÍA =====================
  ('Menú del Día','Primer plato',1, null,     1,'Rollo de primavera',                'Rollo de primavera',                null::numeric),
  ('Menú del Día','Primer plato',1,'Sopa',    2,'Sopa agripicante',                  'Sopa agripicante',                  null),
  ('Menú del Día','Primer plato',1,'Sopa',    3,'Sopa de huevos revueltos',          null,                                null),
  ('Menú del Día','Primer plato',1,'Sopa',    4,'Sopa de pollo con champiñones',     null,                                null),
  ('Menú del Día','Primer plato',1,'Sopa',    5,'Sopa de maíz con pollo',            'Sopa de maíz con pollo',            null),
  ('Menú del Día','Primer plato',1, null,     6,'Ensalada china',                    'Ensalada china',                    null),
  ('Menú del Día','Primer plato',1, null,     7,'Woon toon frito',                   'Woon toon frito',                   null),

  ('Menú del Día','Segundo plato',2,null,     1,'Arroz frito con tres delicias',     'Arroz frito con tres delicias',     null),
  ('Menú del Día','Segundo plato',2,null,     2,'Arroz blanco',                      'Arroz blanco',                      null),
  ('Menú del Día','Segundo plato',2,null,     3,'Corteza de gambas',                 'Corteza de gambas',                 null),
  ('Menú del Día','Segundo plato',2,null,     4,'Pan chino',                         'Pan chino',                         null),
  ('Menú del Día','Segundo plato',2,null,     5,'Tallarines fritos con tres delicias','Tallarines fritos con tres delicias',null),
  ('Menú del Día','Segundo plato',2,null,     6,'Huevo revuelto con gambas',         null,                                null),
  ('Menú del Día','Segundo plato',2,null,     7,'Fideos de arroz con tres delicias', 'Fideos de arroz con tres delicias', null),

  ('Menú del Día','Tercer plato',3,'Pollo',   1,'Pollo con almendras',               'Pollo con almendras',               null),
  ('Menú del Día','Tercer plato',3,'Pollo',   2,'Pollo Kong bao picante',            'Kong bao',                          null),
  ('Menú del Día','Tercer plato',3,'Pollo',   3,'Alas fritas',                       'Alas fritas',                       null),
  ('Menú del Día','Tercer plato',3,'Pollo',   4,'Pollo con salsa de curry',          'Pollo con salsa de curry',          null),
  ('Menú del Día','Tercer plato',3,'Pollo',   5,'Chop-suey de pollo',                'Chop-suey de pollo',                null),
  ('Menú del Día','Tercer plato',3,'Ternera', 6,'Ternera con zanahoria picante',     'Ternera con zanahoria',             null),
  ('Menú del Día','Tercer plato',3,'Ternera', 7,'Ternera con cebolla',               'Ternera con cebolla',               null),
  ('Menú del Día','Tercer plato',3,'Ternera', 8,'Ternera con pimientos verdes',      'Ternera con pimientos',             null),
  ('Menú del Día','Tercer plato',3,'Ternera', 9,'Ternera con salsa de ostras',       'Ternera con salsa de ostras',       null),
  ('Menú del Día','Tercer plato',3,'Ternera',10,'Chop-suey de ternera',              'Chop-suey de ternera',              null),
  ('Menú del Día','Tercer plato',3,'Cerdo',  11,'Cerdo agridulce',                   'Cerdo agridulce',                   null),
  ('Menú del Día','Tercer plato',3,'Cerdo',  12,'Cerdo con salsa picante de Szechuan','Szechuan',                         null),
  ('Menú del Día','Tercer plato',3, null,    13,'Selección de verduras al wok',      'verduras al wok',                   null),

  ('Menú del Día','Bebida',4,null, 1,'Agua mineral (33 cl)',          'Agua mineral',   2.20),
  ('Menú del Día','Bebida',4,null, 2,'Agua mineral (1,5 L)',          'Agua mineral',   2.95),
  ('Menú del Día','Bebida',4,null, 3,'Agua con gas (33 cl)',          'con gas',        2.90),
  ('Menú del Día','Bebida',4,null, 4,'Agua con gas (1,5 L)',          'con gas',        2.95),
  ('Menú del Día','Bebida',4,null, 5,'Coca-Cola',                     'Coca-Cola',      2.50),
  ('Menú del Día','Bebida',4,null, 6,'Coca-Cola Zero',                'Coca-Cola Zero', 2.50),
  ('Menú del Día','Bebida',4,null, 7,'Fanta Limón',                   'Fanta Limón',    null),
  ('Menú del Día','Bebida',4,null, 8,'Fanta Naranja',                 'Fanta Naranja',  null),
  ('Menú del Día','Bebida',4,null, 9,'Bitter Kas',                    'Bitter Kas',     null),
  ('Menú del Día','Bebida',4,null,10,'Zumo natural de naranja',       'Zumo natural',   null),

  ('Menú del Día','Postre',5,null, 1,'Tarta de tiramisú',   null,            null),
  ('Menú del Día','Postre',5,null, 2,'Macedonia de frutas', null,            null),
  ('Menú del Día','Postre',5,null, 3,'Helado con nueces',   null,            null),
  ('Menú del Día','Postre',5,null, 4,'Flan con nata',       'Flan con nata', null),
  ('Menú del Día','Postre',5,null, 5,'Café',                null,            null),
  ('Menú del Día','Postre',5,null, 6,'Té',                  null,            null),
  ('Menú del Día','Postre',5,null, 7,'Infusión',            null,            null),

  -- ===================== MENÚ GRAN SELECCIÓN =====================
  ('Menú Gran Selección','Primer plato',1,'Rollito',1,'Rollito de primavera','Rollo de primavera', null),
  ('Menú Gran Selección','Primer plato',1,'Rollito',2,'Rollito imperial',    'imperial',           null),
  ('Menú Gran Selección','Primer plato',1,'Rollito',3,'Rollito vegetal',     'vegetal',            null),
  ('Menú Gran Selección','Primer plato',1,'Dim-Sum',4,'Ja-kao',              'Ja-kao',             null),
  ('Menú Gran Selección','Primer plato',1,'Dim-Sum',5,'Siu mai',             'Siu mai',            null),
  ('Menú Gran Selección','Primer plato',1,'Dim-Sum',6,'Zen jiao',            'Zen jiao',           null),
  ('Menú Gran Selección','Primer plato',1, null,   7,'Sopa de aleta',        'aleta',              null),
  ('Menú Gran Selección','Primer plato',1, null,   8,'Ensalada Gran Muralla','Ensalada Gran',      null),
  ('Menú Gran Selección','Primer plato',1, null,   9,'Woon toon frito',      'Woon toon frito',    null),

  ('Menú Gran Selección','Segundo plato',2,null,1,'Tallarines fritos con tres delicias','Tallarines fritos con tres delicias',null),
  ('Menú Gran Selección','Segundo plato',2,null,2,'Arroz frito con tres delicias',      'Arroz frito con tres delicias',      null),
  ('Menú Gran Selección','Segundo plato',2,null,3,'Arroz frito de la Casa',             'Arroz frito de la Casa',             null),
  ('Menú Gran Selección','Segundo plato',2,null,4,'Fideos de arroz con tres delicias',  'Fideos de arroz con tres delicias',  null),
  ('Menú Gran Selección','Segundo plato',2,null,5,'Fideos transparentes con tres delicias','Fideos transparentes',            null),

  ('Menú Gran Selección','Tercer plato',3,'Gambas', 1,'Gambas al estilo cantonés',   'Gambas al estilo',        null),
  ('Menú Gran Selección','Tercer plato',3,'Gambas', 2,'Gambas rebozadas',            'Gambas rebozadas',        null),
  ('Menú Gran Selección','Tercer plato',3,'Gambas', 3,'Gambas con salsa agridulce',  'Gambas%agridulce',        null),
  ('Menú Gran Selección','Tercer plato',3,'Pollo',  4,'Pollo caramelizado con sésamo','Pollo caramelizado',     null),
  ('Menú Gran Selección','Tercer plato',3,'Pollo',  5,'Pollo al limón',              'Pollo al limón',          null),
  ('Menú Gran Selección','Tercer plato',3,'Pollo',  6,'Pollo con champiñones',       'Pollo con champiñones',   null),
  ('Menú Gran Selección','Tercer plato',3,'Pollo',  7,'Teriyaki de pollo',           'Teriyaki de pollo',       null),
  ('Menú Gran Selección','Tercer plato',3,'Ternera',8,'Ternera con bambú y setas',   'Ternera con bambú',       null),
  ('Menú Gran Selección','Tercer plato',3,'Ternera',9,'Ternera con champiñones',     'Ternera con champiñones', null),
  ('Menú Gran Selección','Tercer plato',3,'Ternera',10,'Ternera con salsa de pimienta negra','Ternera%pimienta',null),
  ('Menú Gran Selección','Tercer plato',3,'Pato',  11,'Pato a la piña',              'Pato a la piña',          null),
  ('Menú Gran Selección','Tercer plato',3,'Pato',  12,'Pato crujiente cantonés',     'Pato crujiente',          null),
  ('Menú Gran Selección','Tercer plato',3,'Pato',  13,'Pato a la salsa de naranja',  'Pato a la salsa de naranja',null),
  ('Menú Gran Selección','Tercer plato',3, null,   14,'Calamares con salsa picante', 'Calamares',               null),
  ('Menú Gran Selección','Tercer plato',3, null,   15,'Filete de pollo almendrado',  'Filete de pollo almendrado',null),
  ('Menú Gran Selección','Tercer plato',3, null,   16,'Cerdo con bambú y setas',     'Cerdo con bambú',         null),
  ('Menú Gran Selección','Tercer plato',3, null,   17,'Selección de verduras al wok','verduras al wok',         null),

  ('Menú Gran Selección','Bebida',4,null, 1,'Agua mineral (33 cl)',   'Agua mineral',   2.20),
  ('Menú Gran Selección','Bebida',4,null, 2,'Agua mineral (1,5 L)',   'Agua mineral',   2.95),
  ('Menú Gran Selección','Bebida',4,null, 3,'Agua con gas (33 cl)',   'con gas',        2.90),
  ('Menú Gran Selección','Bebida',4,null, 4,'Agua con gas (1,5 L)',   'con gas',        2.95),
  ('Menú Gran Selección','Bebida',4,null, 5,'Coca-Cola',              'Coca-Cola',      2.50),
  ('Menú Gran Selección','Bebida',4,null, 6,'Coca-Cola Zero',         'Coca-Cola Zero', 2.50),
  ('Menú Gran Selección','Bebida',4,null, 7,'Fanta Limón',            'Fanta Limón',    null),
  ('Menú Gran Selección','Bebida',4,null, 8,'Fanta Naranja',          'Fanta Naranja',  null),
  ('Menú Gran Selección','Bebida',4,null, 9,'Bitter Kas',             'Bitter Kas',     null),
  ('Menú Gran Selección','Bebida',4,null,10,'Zumo natural de naranja','Zumo natural',   null),

  ('Menú Gran Selección','Postre',5,null, 1,'Tarta de tiramisú',   null,            null),
  ('Menú Gran Selección','Postre',5,null, 2,'Macedonia de frutas', null,            null),
  ('Menú Gran Selección','Postre',5,null, 3,'Helado con nueces',   null,            null),
  ('Menú Gran Selección','Postre',5,null, 4,'Flan con nata',       'Flan con nata', null),
  ('Menú Gran Selección','Postre',5,null, 5,'Café',                null,            null),
  ('Menú Gran Selección','Postre',5,null, 6,'Té',                  null,            null),
  ('Menú Gran Selección','Postre',5,null, 7,'Infusión',            null,            null)
),
grupos_ins as (
  insert into menu_grupos (menu_id, restaurante_id, nombre, orden)
  select distinct m.id, m.restaurante_id, d.grupo, d.og
  from datos d
  join menus m on m.nombre = d.menu and m.restaurante_id = (select id from rest)
  returning id, menu_id, nombre
)
insert into menu_opciones (grupo_id, restaurante_id, producto_id, nombre, subgrupo, orden)
select
  g.id,
  (select id from rest),
  p.id,
  -- Si enlaza con la carta, mandamos el nombre de la carta: es el que verá la
  -- cocina en el ticket, y que cliente y cocina lean lo mismo evita llamadas.
  coalesce(p.nombre, d.nombre),
  d.subgrupo,
  d.ord
from datos d
join menus m       on m.nombre = d.menu and m.restaurante_id = (select id from rest)
join grupos_ins g  on g.menu_id = m.id and g.nombre = d.grupo
left join lateral (
  select pr.id, pr.nombre
  from productos pr
  where d.busca is not null
    and pr.restaurante_id = (select id from rest)
    and pr.disponible = true
    and pr.nombre ilike '%' || d.busca || '%'
    and (d.precio is null or pr.precio = d.precio)
  -- El más corto es el más literal: entre "Coca-Cola" y "Coca-Cola Zero",
  -- buscando "Coca-Cola" queremos la primera.
  order by length(pr.nombre)
  limit 1
) p on true
order by d.menu, d.og, d.ord;

notify pgrst, 'reload schema';
