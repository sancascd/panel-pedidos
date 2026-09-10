-- ============================================================
-- DAR ACCESO A UN RESTAURANTE QUE YA EXISTE
-- ============================================================
-- Para cuando el restaurante ya esta creado y con datos (carta, pedidos,
-- plan) porque lo hemos montado nosotros, y ahora hay que darle su propia
-- cuenta.
--
-- NO usar /registro para esto: ese flujo llama a registrar_restaurante(),
-- que CREA UN RESTAURANTE NUEVO Y VACIO. Perderiamos la carta.
--
-- Antes de nada, en Supabase: Authentication > Users > Add user
--   - email del restaurante
--   - contrasena temporal
--   - marcar "Auto Confirm User"  <-- si no, no podran entrar
-- Ellos se la cambian luego desde el panel (Cambiar contrasena).
--
-- Sustituir en los pasos: EMAIL_DEL_RESTAURANTE y SLUG_DEL_RESTAURANTE.
-- ============================================================


-- ============================================================
-- FORMA RECOMENDADA: de una vez y con red
-- ============================================================
-- Rellena las dos lineas de abajo y ejecuta SOLO este bloque. Hace las
-- comprobaciones el solo y se para sin escribir nada si algo no cuadra.
-- Los pasos sueltos que vienen despues siguen aqui para diagnosticar cuando
-- algo falla, pero para el alta normal basta con esto.

do $$
declare
  -- ----- RELLENAR -----
  c_email text := 'RELLENAR';   -- el email con el que va a entrar el cliente
  c_slug  text := 'RELLENAR';   -- 'china-town', por ejemplo
  -- --------------------
  v_usuario    uuid;
  v_rest       uuid;
  v_confirmado timestamptz;
  v_nombre     text;
begin
  if 'RELLENAR' in (c_email, c_slug) then
    raise exception 'Rellena el email y el slug arriba';
  end if;

  select id, email_confirmed_at into v_usuario, v_confirmado
    from auth.users where email = lower(c_email);

  if v_usuario is null then
    raise exception 'No hay ningun usuario con el email %. Crealo primero en Authentication > Users.', c_email;
  end if;

  -- Sin confirmar no pueden entrar, y el error del login no menciona esto:
  -- parece otro problema completamente distinto. Es la casilla "Auto Confirm
  -- User" que se olvida al crear el usuario.
  if v_confirmado is null then
    raise exception 'El usuario % existe pero tiene el email SIN CONFIRMAR: no podra entrar. Confirmalo antes.', c_email;
  end if;

  select id, nombre into v_rest, v_nombre from restaurantes where slug = c_slug;
  if v_rest is null then
    raise exception 'No existe ningun restaurante con el slug %', c_slug;
  end if;

  -- mi_restaurante_id() hace LIMIT 1 SIN ORDER BY: con dos vinculos, el panel
  -- de esa persona apuntaria a uno cualquiera de los dos, y cambiando.
  if exists (select 1 from usuarios_restaurante where usuario_id = v_usuario) then
    raise exception 'Ese usuario ya esta vinculado a un restaurante. Desvinculalo antes en vez de acumular filas.';
  end if;

  insert into usuarios_restaurante (usuario_id, restaurante_id, rol)
  values (v_usuario, v_rest, 'admin');

  raise notice 'Vinculado % a % (%)', c_email, v_nombre, c_slug;
end $$;

-- Quien tiene acceso ahora a ese restaurante:
select u.email, ur.rol, r.nombre
  from usuarios_restaurante ur
  join auth.users u   on u.id = ur.usuario_id
  join restaurantes r on r.id = ur.restaurante_id
 where r.slug = 'RELLENAR';


-- ============================================================
-- PASOS SUELTOS (para diagnosticar si algo falla)
-- ============================================================

-- PASO 1 (comprobar). El restaurante existe y esta aprobado?
select id, nombre, slug, estado, plan, meta_phone_number_id
from restaurantes
where slug = 'SLUG_DEL_RESTAURANTE';
-- El panel de admin SOLO entiende 'pendiente' | 'aprobado' | 'rechazado'.
-- Con cualquier otro valor (p.ej. 'activo') el restaurante desaparece del
-- seguimiento de planes y de la lista de restaurantes: sus pedidos no
-- cuentan para facturar. Le paso a Gran Muralla. Se corrige con:
--   update restaurantes set estado = 'aprobado' where id = 'UUID_DEL_RESTAURANTE';


-- PASO 2 (comprobar). El usuario existe y tiene el email confirmado?
select id, email, email_confirmed_at
from auth.users
where email = lower('EMAIL_DEL_RESTAURANTE');
-- email_confirmed_at NULL = no podra entrar. Se arregla con:
--   update auth.users set email_confirmed_at = now()
--   where email = lower('EMAIL_DEL_RESTAURANTE') and email_confirmed_at is null;


-- PASO 3 (comprobar). Ese usuario ya esta vinculado a algo?
-- Tiene que salir 0 filas. Si sale alguna, PARAR: vincularlo a un segundo
-- restaurante deja su acceso en manos de cual devuelva mi_restaurante_id().
select ur.*, r.nombre
from usuarios_restaurante ur
join restaurantes r on r.id = ur.restaurante_id
where ur.usuario_id = (select id from auth.users where email = lower('EMAIL_DEL_RESTAURANTE'));


-- PASO 4 (escribir). Vincular el usuario al restaurante que YA existe.
--
-- POR ID, a proposito. La version con "insert ... select ... where email=..."
-- FALLA EN SILENCIO si el email no coincide caracter a caracter o si el
-- usuario aun no existe: no da error, simplemente no escribe nada. Ya paso
-- una vez (2026-09-04): se ejecuto el insert antes de crear el usuario y
-- parecio que habia ido bien.
--
-- Copiar los dos UUID de los pasos 1 y 2.
insert into usuarios_restaurante (usuario_id, restaurante_id, rol)
values ('UUID_DEL_USUARIO', 'UUID_DEL_RESTAURANTE', 'admin');
-- Tiene que decir "INSERT 0 1".


-- PASO 5 (comprobar). Como queda el restaurante: quien tiene acceso.
select u.email, ur.rol, r.nombre
from usuarios_restaurante ur
join auth.users u on u.id = ur.usuario_id
join restaurantes r on r.id = ur.restaurante_id
where r.slug = 'SLUG_DEL_RESTAURANTE';
-- Es normal que aparezca tambien la cuenta de Sandra si monto el restaurante:
-- son dos usuarios del mismo restaurante, no un fallo. Solo hay que quitarla
-- si no queremos que su mi_restaurante_id() siga apuntando aqui.


-- ============================================================
-- PASO 6. COMPROBACION DE AISLAMIENTO (no saltarsela)
-- ============================================================
-- Esto es lo que de verdad cierra el trabajo. En una ventana de incognito,
-- entrar con la cuenta NUEVA y comprobar:
--   1. /pedidos          -> solo pedidos de SU restaurante
--   2. /carta            -> solo su carta
--   3. /clientes         -> solo sus clientes
--   4. /admin            -> NO debe dejarle entrar (soy_superadmin() = false)
--   5. /ajustes          -> sus datos, y al guardar no toca a nadie mas
--   6. Cambiar contrasena -> funciona
-- Si en algun sitio ve datos de otro restaurante, PARAR y avisar: seria un
-- fallo de RLS, no del alta.
