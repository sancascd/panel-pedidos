-- =============================================================
-- Restaurante de mentira para probar el cobro con Stripe
-- =============================================================
-- Para hacer el pago de prueba sin tocar a ningún cliente: un pago de prueba
-- cambia el estado de cobro y la fecha de inicio del plan, y eso en Gran
-- Muralla o China Town descuadraría su conteo de pedidos.
--
-- No tiene WhatsApp ni cuenta: solo sirve para que salga en Admin -> Planes
-- y poder pulsar «Enlace de pago». Se borra al terminar (bloque de abajo).
--
-- Aplicar en Supabase -> SQL editor.

insert into public.restaurantes (
  nombre, slug, estado, plan, pedidos_incluidos, plan_iniciado_en,
  carta_tipo, acepta_efectivo, acepta_tarjeta, resenas_activas, es_demo
)
select 'Pruebas Stripe', 'pruebas-stripe', 'aprobado', 'basico', 1000, now(),
       'comandi', true, true, false, false
 where not exists (select 1 from public.restaurantes where slug = 'pruebas-stripe');

select nombre, slug, estado, plan, estado_cobro from public.restaurantes where slug = 'pruebas-stripe';


-- ---------- AL TERMINAR LAS PRUEBAS: borrarlo ----------
-- (La suscripción de prueba se puede dejar en Stripe: es del entorno de prueba
--  y no cobra nada de verdad.)
-- delete from public.restaurantes where slug = 'pruebas-stripe';
