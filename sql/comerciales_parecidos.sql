-- =============================================================
-- Comerciales: avisar de restaurantes con nombre PARECIDO
-- =============================================================
-- Hasta ahora solo chocaban los nombres iguales despues de normalizar
-- ("Restaurante Lin" y "Lin" dan los dos "lin"). Pero "Lin" y "Lin Wok", o
-- "Gran Muralla" y "La Muralla China", pasaban como restaurantes distintos y
-- dos comerciales podian acabar reservando el mismo.
--
-- Ahora, si hay uno parecido en la misma poblacion, se le enseña al comercial
-- y se le pregunta si es el mismo. Si dice que NO, se registra igual pero
-- queda anotado con cual se parecia, para que la administradora lo revise.
--
-- Y la poblacion pasa a ser obligatoria para registrar: con dos restaurantes
-- que se llaman igual en ciudades distintas, es lo unico que los separa.
--
-- Aplicar en Supabase -> SQL editor.

-- ---------- 1. Donde queda anotado el parecido ----------
alter table public.contactos_comerciales
  add column if not exists parecido_a text;

comment on column public.contactos_comerciales.parecido_a is
  'Si al registrarlo habia otro con nombre parecido y el comercial dijo que era distinto: cual era. Para revisar desde /admin.';


-- ---------- 2. Que nombres se parecen ----------
-- Palabras que no sirven para distinguir un restaurante de otro en este
-- mercado: casi todos los chinos llevan alguna. Si "Wok Express" y "Wok
-- Garden" se dieran por parecidos, el aviso saltaria siempre y se dejaria de
-- leer. Solo cuentan para comparar, no se tocan los nombres guardados.
create or replace function public.palabras_distintivas(p text)
returns text[]
language sql
immutable
as $function$
  select coalesce(array_agg(t), '{}')
    from unnest(string_to_array(coalesce(normalizar_nombre(p), ''), ' ')) as t
   where length(t) >= 3
     and t not in ('chino', 'china', 'chinos', 'chinas', 'wok', 'asiatico', 'asiatica',
                   'oriental', 'express', 'sushi', 'grill', 'food', 'garden', 'palace',
                   'city', 'house', 'gran', 'nuevo', 'nueva', 'restaurant', 'rest');
$function$;


-- Devuelve los que se parecen. SOLO el nombre, la poblacion y en que estado
-- esta: ni quien lo tiene, ni su telefono, ni sus notas. Es lo minimo para
-- poder preguntar "¿es este?".
create or replace function public.restaurantes_parecidos(
  p_nombre    text,
  p_poblacion text default null
)
returns table (nombre text, poblacion text, estado text)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_palabras  text[] := palabras_distintivas(p_nombre);
  v_nombre    text   := normalizar_nombre(p_nombre);
  v_poblacion text   := normalizar_nombre(p_poblacion);
  v_yo        uuid   := mi_comercial_id();
begin
  if not (soy_comercial() or soy_superadmin()) then
    raise exception 'Solo los comerciales pueden consultar esto';
  end if;
  if array_length(v_palabras, 1) is null then
    return;
  end if;

  return query
  select c.nombre_restaurante,
         c.poblacion,
         case when c.estado = 'cerrado'  then 'cliente'
              when c.comercial_id = v_yo then 'tuyo'
              else 'reservado' end
    from contactos_comerciales c
   where c.estado <> 'descartado'
     and (c.estado = 'cerrado' or c.reservado_hasta > now())
     -- El igual exacto ya lo trata comprobar_restaurante(); aqui solo los
     -- que se parecen sin ser iguales.
     and c.nombre_norm <> v_nombre
     and palabras_distintivas(c.nombre_restaurante) && v_palabras
     and (v_poblacion is null or c.poblacion_norm is null or c.poblacion_norm = v_poblacion)
   order by (c.estado = 'cerrado') desc, c.registrado_en desc
   limit 3;
end;
$function$;


-- ---------- 3. Registrar, con la poblacion y el parecido ----------
-- Cambia la lista de argumentos, y un `create or replace` con otra lista NO
-- sustituye: crea una segunda funcion con el mismo nombre, y entonces las
-- llamadas que no pasan el argumento nuevo son ambiguas entre las dos. Hay
-- que quitar la vieja primero.
drop function if exists public.registrar_contacto(text, text, text, text);

create or replace function public.registrar_contacto(
  p_nombre     text,
  p_poblacion  text default null,
  p_telefono   text default null,
  p_notas      text default null,
  p_es_distinto boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_yo       uuid := mi_comercial_id();
  v_estado   text;
  v_parecido text;
  v_id       uuid;
begin
  if v_yo is null then
    raise exception 'Tu cuenta no esta dada de alta como comercial';
  end if;
  if normalizar_nombre(p_nombre) is null then
    raise exception 'Escribe el nombre del restaurante';
  end if;
  -- Dos restaurantes que se llaman igual en sitios distintos solo se
  -- distinguen por esto.
  if coalesce(trim(p_poblacion), '') = '' then
    raise exception 'Escribe la poblacion del restaurante';
  end if;

  select estado into v_estado from comprobar_restaurante(p_nombre, p_poblacion);

  if v_estado = 'reservado' then
    raise exception 'Ese restaurante ya lo tiene registrado otro comercial';
  elsif v_estado = 'cliente' then
    raise exception 'Ese restaurante ya es cliente de Comandi';
  elsif v_estado = 'tuyo' then
    raise exception 'Ya lo tienes registrado tu';
  end if;

  -- Si hay uno parecido, el comercial tiene que haber dicho expresamente
  -- que es otro. Se comprueba AQUI y no solo en la pagina: si no, bastaria
  -- con llamar a la funcion directamente para saltarse la pregunta.
  select p.nombre || coalesce(' · ' || p.poblacion, '')
    into v_parecido
    from restaurantes_parecidos(p_nombre, p_poblacion) p
   limit 1;

  if v_parecido is not null and not p_es_distinto then
    raise exception 'Hay un restaurante parecido ya registrado (%). Confirma si es el mismo antes de seguir.', v_parecido;
  end if;

  insert into contactos_comerciales
    (comercial_id, nombre_restaurante, nombre_norm, poblacion, poblacion_norm,
     telefono, notas, parecido_a)
  values
    (v_yo, trim(p_nombre), normalizar_nombre(p_nombre),
     trim(p_poblacion), normalizar_nombre(p_poblacion),
     nullif(trim(coalesce(p_telefono, '')), ''), nullif(trim(coalesce(p_notas, '')), ''),
     v_parecido)
  returning id into v_id;

  return v_id;
end;
$function$;


revoke all on function public.restaurantes_parecidos(text, text) from public, anon;
revoke all on function public.registrar_contacto(text, text, text, text, boolean) from public, anon;
grant execute on function public.restaurantes_parecidos(text, text) to authenticated;
grant execute on function public.registrar_contacto(text, text, text, text, boolean) to authenticated;

notify pgrst, 'reload schema';
