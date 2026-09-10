-- =============================================================
-- Acceso al restaurante de demostraciones
-- =============================================================
-- Para enseñar el producto hace falta entrar en un panel con pedidos de
-- verdad. Lo hacen la superadmin y los comerciales, que no tienen restaurante
-- propio.
--
-- Se reaprovecha el mecanismo del superadmin (`entrar_en_restaurante`): un
-- vínculo temporal en `usuarios_restaurante`. Así funcionan TODAS las páginas
-- del panel sin tocar ni una: tablero, carta, menús, horarios, analíticas.
--
-- La diferencia es a dónde se puede entrar: estas funciones solo miran
-- restaurantes con `es_demo`, así que un comercial nunca puede acabar dentro
-- del panel de un cliente.
--
-- Requiere `restaurante_demo.sql` (crea la columna es_demo). Aplicar en
-- Supabase -> SQL editor.

-- ---------- Entrar ----------
create or replace function public.entrar_en_demo()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_demo uuid;
begin
  if not (soy_superadmin() or soy_comercial()) then
    raise exception 'Solo la administradora y los comerciales pueden entrar en la demostración';
  end if;

  select id into v_demo from restaurantes where es_demo order by creado_en limit 1;
  if v_demo is null then
    raise exception 'No hay ningún restaurante de demostración configurado';
  end if;

  if soy_superadmin() then
    -- La superadmin usa este mismo vínculo para entrar en el panel de un
    -- cliente, y mi_restaurante_id() hace LIMIT 1 SIN ORDER BY: con dos filas
    -- el panel apuntaría a uno cualquiera de los dos. Uno cada vez.
    delete from usuarios_restaurante where usuario_id = auth.uid();
  else
    -- Un comercial podría ser además dueño de un restaurante (se refiere a sí
    -- mismo, o monta el negocio de un familiar). Ahí NO se toca su vínculo de
    -- verdad: se le pide que salga él, en vez de dejarle sin panel.
    if exists (
      select 1 from usuarios_restaurante ur
        join restaurantes r on r.id = ur.restaurante_id
       where ur.usuario_id = auth.uid() and not r.es_demo
    ) then
      raise exception 'Esta cuenta ya está vinculada a un restaurante. Usa otra para las demostraciones.';
    end if;

    delete from usuarios_restaurante ur
     using restaurantes r
     where ur.restaurante_id = r.id
       and ur.usuario_id = auth.uid()
       and r.es_demo;
  end if;

  insert into usuarios_restaurante (usuario_id, restaurante_id, rol)
  values (auth.uid(), v_demo, 'admin');
end;
$function$;

-- ---------- Salir ----------
-- Sin guarda de rol a propósito: solo puede borrar vínculos con restaurantes
-- de demostración, así que en el peor caso alguien se saca a sí mismo de la
-- demo. `salir_del_restaurante()` no vale aquí porque exige superadmin, y un
-- comercial se quedaría dentro sin salida.
create or replace function public.salir_de_la_demo()
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  delete from usuarios_restaurante ur
   using restaurantes r
   where ur.restaurante_id = r.id
     and ur.usuario_id = auth.uid()
     and r.es_demo;
end;
$function$;

revoke all on function public.entrar_en_demo()   from public, anon;
revoke all on function public.salir_de_la_demo() from public, anon;
grant execute on function public.entrar_en_demo()   to authenticated;
grant execute on function public.salir_de_la_demo() to authenticated;

-- PostgREST cachea el esquema: sin esto, las funciones recién creadas dan
-- "Could not find the function ... in the schema cache" al llamarlas.
notify pgrst, 'reload schema';
