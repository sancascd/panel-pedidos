-- =============================================================
-- Cómo va el equipo: estadísticas de la red comercial
-- =============================================================
-- Para la página /equipo, que ven los comerciales y la administradora.
--
-- PRIVACIDAD: igual que ranking_comerciales(), aquí solo salen CIFRAS. Ningún
-- nombre de restaurante, teléfono ni nota: un comercial nunca puede ver los
-- contactos de otro (ver sql/comerciales.sql). Por ciudad se dan cuántos
-- restaurantes hay registrados y cuántos comerciales trabajan allí, no cuáles.
--
-- Aplicar en Supabase -> SQL editor. Se puede repetir.

-- ---------- 1. Cuándo se cerró cada restaurante ----------
-- Hasta ahora no se guardaba: actualizado_en cambia con cualquier cosa (hasta
-- con marcar la comisión pagada), así que no sirve para contar cierres por
-- semana. Un trigger lo rellena al pasar a «cerrado» y lo vacía si se deshace.
alter table public.contactos_comerciales
  add column if not exists cerrado_en timestamptz;

comment on column public.contactos_comerciales.cerrado_en is
  'Cuando el contacto paso a cerrado. Lo pone un trigger; NULL si no esta cerrado.';

create or replace function public.contacto_fecha_cierre()
returns trigger
language plpgsql
as $function$
begin
  if new.estado = 'cerrado' and (tg_op = 'INSERT' or old.estado is distinct from 'cerrado') then
    new.cerrado_en := now();
  elsif new.estado <> 'cerrado' then
    new.cerrado_en := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists contacto_fecha_cierre on public.contactos_comerciales;
create trigger contacto_fecha_cierre
  before insert or update of estado on public.contactos_comerciales
  for each row execute function public.contacto_fecha_cierre();

-- Los que ya estaban cerrados: la mejor fecha que hay es la del último cambio.
update public.contactos_comerciales
   set cerrado_en = actualizado_en
 where estado = 'cerrado' and cerrado_en is null;


-- ---------- 2. Las estadísticas ----------
-- Solo cuentan los comerciales activos, igual que el ranking, para que los
-- totales cuadren con la suma de la tabla.
create or replace function public.estadisticas_equipo()
returns json
language sql
stable
security definer
set search_path = public
as $function$
  with k as (
    select k.*
      from contactos_comerciales k
      join comerciales c on c.id = k.comercial_id
     where c.activo
  ),
  hoy as (
    select (now() at time zone 'Europe/Madrid') as ahora
  )
  select case when not (soy_comercial() or soy_superadmin()) then null else
    json_build_object(
      'comerciales', (select count(*) from comerciales where activo),

      'embudo', (select json_build_object(
          'registrados', count(*),
          'visitados',   count(*) filter (where estado in ('visitado', 'interesado', 'cerrado')),
          'interesados', count(*) filter (where estado in ('interesado', 'cerrado')),
          'cerrados',    count(*) filter (where estado = 'cerrado'),
          'descartados', count(*) filter (where estado = 'descartado'),
          'nuevos_mes',  count(*) filter (where (registrado_en at time zone 'Europe/Madrid')
                                                >= date_trunc('month', (select ahora from hoy))),
          'cerrados_mes', count(*) filter (where (cerrado_en at time zone 'Europe/Madrid')
                                                 >= date_trunc('month', (select ahora from hoy)))
        ) from k),

      -- Una fila por población (escrita como la escribe la mayoría).
      'ciudades', coalesce((
        select json_agg(x order by x.contactos desc, x.poblacion)
          from (
            select mode() within group (order by poblacion)          as poblacion,
                   count(*)::int                                      as contactos,
                   count(*) filter (where estado = 'cerrado')::int    as cerrados,
                   count(distinct comercial_id)::int                  as comerciales
              from k
             where coalesce(poblacion_norm, '') <> ''
             group by poblacion_norm
          ) x
      ), '[]'::json),

      -- Las últimas 8 semanas, de lunes a domingo, con las vacías incluidas.
      'semanas', (
        select json_agg(json_build_object(
                 'semana',  to_char(s.semana, 'YYYY-MM-DD'),
                 'nuevos',  (select count(*) from k
                              where date_trunc('week', k.registrado_en at time zone 'Europe/Madrid') = s.semana),
                 'cierres', (select count(*) from k
                              where date_trunc('week', k.cerrado_en at time zone 'Europe/Madrid') = s.semana)
               ) order by s.semana)
          from generate_series(date_trunc('week', (select ahora from hoy)) - interval '7 weeks',
                               date_trunc('week', (select ahora from hoy)),
                               interval '1 week') as s(semana)
      )
    )
  end
$function$;

revoke all on function public.estadisticas_equipo() from public, anon;
grant execute on function public.estadisticas_equipo() to authenticated;

notify pgrst, 'reload schema';

-- Comprobación: desde el editor SQL no hay sesión, así que devuelve NULL
-- (es lo esperado). Donde se ve de verdad es en comandi.es/equipo.
select estadisticas_equipo() is null as sin_sesion_no_ve_nada;
