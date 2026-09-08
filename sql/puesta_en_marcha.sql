-- =============================================================
-- Puesta en marcha: en qué punto está el alta de cada restaurante
-- =============================================================
-- Con un cliente se lleva de memoria. Con cinco a medias, cada uno en un paso
-- distinto, no. Esto guarda qué está hecho de cada uno.
--
-- La LISTA de pasos NO vive aquí: está en `lib/puestaEnMarcha.js`. Es el proceso
-- de alta de Comandi y mejora con el producto — si mañana se añade una función,
-- su paso aparece solo en todos los restaurantes. Si la lista fuera editable por
-- restaurante acabaríamos con un proceso distinto por cliente y ninguno bueno.
--
-- Aquí solo se guarda lo que cambia: qué pasos están tachados y la nota.
--
-- Aplicar en Supabase -> SQL editor.

create table if not exists puesta_en_marcha (
  restaurante_id  uuid not null references restaurantes(id) on delete cascade,
  -- Id del paso en lib/puestaEnMarcha.js. Texto a propósito: un paso que se
  -- retira deja su fila huérfana y se ignora, sin romper nada.
  paso            text not null,
  hecho           boolean not null default true,
  -- "falta el numero del 47", "el PIN lo tiene el encargado". Es la que salva
  -- cuando vuelves al restaurante dos semanas despues.
  nota            text,
  actualizado_en  timestamptz not null default now(),
  primary key (restaurante_id, paso)
);

create index if not exists puesta_en_marcha_rest_idx on puesta_en_marcha (restaurante_id);

-- ---------- RLS ----------
-- OJO: aquí `soy_superadmin()` SÍ es lo correcto, al revés que en las tablas de
-- datos del cliente (carta, menús, pedidos). Esto no es del restaurante: son las
-- notas de trabajo de la plataforma sobre su alta, y el restaurante no debe
-- verlas ni tocarlas.
alter table puesta_en_marcha enable row level security;

drop policy if exists "Superadmin gestiona la puesta en marcha" on public.puesta_en_marcha;
create policy "Superadmin gestiona la puesta en marcha" on public.puesta_en_marcha
  for all  using (soy_superadmin())
  with check (soy_superadmin());

notify pgrst, 'reload schema';
