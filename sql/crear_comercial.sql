-- =============================================================
-- CREAR UN COMERCIAL DESDE LA ADMINISTRACIÓN
-- =============================================================
-- El camino normal es que el comercial se registre en /registro y Sandra lo
-- apruebe después. Esto es para el otro caso: dárselo ya hecho en la reunión,
-- con su hoja de usuario y contraseña, igual que a un restaurante.
--
-- `solicitar_alta_comercial()` no sirve aquí: usa auth.uid(), así que solo
-- puede darse de alta uno a sí mismo.
--
-- ANTES, en Supabase: Authentication > Users > Add user
--   - su email
--   - la contraseña que le vas a dar
--   - marcar "Auto Confirm User"   <-- si no, no podrá entrar
--
-- Aplicar en Supabase -> SQL editor.

create or replace function public.crear_comercial(
  p_email    text,
  p_nombre   text,
  p_telefono text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_usuario uuid;
  v_confirmado timestamptz;
  v_id uuid;
begin
  -- Desde la APLICACION solo puede llamarla la superadmin. Desde el editor SQL
  -- de Supabase no hay sesion -auth.uid() es nulo- y ahi la conexion ya es de
  -- dueña de la base de datos, asi que la guarda no aporta nada y solo
  -- estorbaria. No abre ningun hueco: mas abajo se revoca el permiso de
  -- ejecucion a `anon`, que es el unico rol que llega sin sesion por la API.
  if auth.uid() is not null and not soy_superadmin() then
    raise exception 'Solo la administradora puede dar de alta comerciales';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Escribe el nombre del comercial';
  end if;

  select id, email_confirmed_at into v_usuario, v_confirmado
    from auth.users where email = lower(trim(p_email));

  if v_usuario is null then
    raise exception 'No hay ningun usuario con el email %. Crealo primero en Authentication > Users.', p_email;
  end if;

  -- Sin confirmar no puede entrar, y el error del login no menciona esto:
  -- es la casilla "Auto Confirm User" que se olvida al crear el usuario.
  if v_confirmado is null then
    raise exception 'El usuario % tiene el email SIN CONFIRMAR: no podra entrar.', p_email;
  end if;

  if exists (select 1 from comerciales where usuario_id = v_usuario) then
    raise exception 'Esa cuenta ya es comercial (o tiene una solicitud pendiente)';
  end if;

  -- Una cuenta es de un restaurante o de un comercial, nunca las dos:
  -- mi_restaurante_id() y mi_comercial_id() se pisarian. Mismo criterio que
  -- solicitar_alta_comercial().
  if exists (select 1 from usuarios_restaurante where usuario_id = v_usuario) then
    raise exception 'Esa cuenta ya esta asociada a un restaurante';
  end if;

  -- activo = true: lo estas dando de alta tu en persona, no hay nada que
  -- aprobar despues. Si algun dia hay que pararle, se desactiva desde /admin.
  insert into comerciales (usuario_id, nombre, telefono, email, activo)
  values (v_usuario, trim(p_nombre), nullif(trim(coalesce(p_telefono, '')), ''),
          lower(trim(p_email)), true)
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.crear_comercial(text, text, text) from public, anon;
grant execute on function public.crear_comercial(text, text, text) to authenticated;

notify pgrst, 'reload schema';


-- ---------- Cómo se usa ----------
-- select crear_comercial('correo@delcomercial.com', 'Nombre Apellidos', '600112233');
--
-- Y para ver cómo ha quedado:
-- select c.nombre, c.email, c.telefono, c.activo, u.email_confirmed_at
--   from comerciales c join auth.users u on u.id = c.usuario_id
--  order by c.creado_en desc;
