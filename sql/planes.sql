-- ============================================================
-- Migración: sistema de planes + solicitudes de upgrade (Fase 1)
-- ============================================================
-- Aplicar en Supabase: SQL Editor > New query > pega esto > Run
--
-- Contexto: cada restaurante tiene un plan (basico/pro/premium) con un nº de
-- pedidos incluidos al mes. El periodo se cuenta como "mes desde fecha de alta"
-- usando `plan_iniciado_en` como ancla. Al exceder, se cobra overage (gestionado
-- en panel/Stripe, no en esta migración).

BEGIN;

-- =========================================================
-- 1) Columnas de plan en restaurantes
-- =========================================================

ALTER TABLE restaurantes
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'basico',
  ADD COLUMN IF NOT EXISTS plan_iniciado_en TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Valores válidos de plan
ALTER TABLE restaurantes DROP CONSTRAINT IF EXISTS restaurantes_plan_check;
ALTER TABLE restaurantes
  ADD CONSTRAINT restaurantes_plan_check CHECK (plan IN ('basico', 'pro', 'premium'));

-- =========================================================
-- 2) Tabla de solicitudes de upgrade
--    El restaurante solicita subir de plan; Sandra (superadmin) aprueba/rechaza.
-- =========================================================

CREATE TABLE IF NOT EXISTS solicitudes_upgrade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  plan_actual TEXT NOT NULL,
  plan_solicitado TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente',  -- 'pendiente' | 'aprobada' | 'rechazada'
  solicitado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resuelto_en TIMESTAMPTZ,
  nota TEXT
);

ALTER TABLE solicitudes_upgrade DROP CONSTRAINT IF EXISTS solicitudes_upgrade_estado_check;
ALTER TABLE solicitudes_upgrade
  ADD CONSTRAINT solicitudes_upgrade_estado_check
  CHECK (estado IN ('pendiente', 'aprobada', 'rechazada'));

CREATE INDEX IF NOT EXISTS idx_solicitudes_upgrade_pendientes
  ON solicitudes_upgrade(estado, solicitado_en) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_solicitudes_upgrade_restaurante
  ON solicitudes_upgrade(restaurante_id);

-- =========================================================
-- 3) RLS de solicitudes_upgrade
--    Usa las funciones existentes mi_restaurante_id() y soy_superadmin()
--    (las mismas que usan las RPC del panel). Si tus funciones tienen otro
--    nombre, ajusta aquí.
-- =========================================================

ALTER TABLE solicitudes_upgrade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Restaurante ve sus solicitudes" ON solicitudes_upgrade;
CREATE POLICY "Restaurante ve sus solicitudes" ON solicitudes_upgrade
  FOR SELECT
  USING (restaurante_id = mi_restaurante_id() OR soy_superadmin());

DROP POLICY IF EXISTS "Restaurante crea solicitudes" ON solicitudes_upgrade;
CREATE POLICY "Restaurante crea solicitudes" ON solicitudes_upgrade
  FOR INSERT
  WITH CHECK (restaurante_id = mi_restaurante_id());

DROP POLICY IF EXISTS "Superadmin gestiona solicitudes" ON solicitudes_upgrade;
CREATE POLICY "Superadmin gestiona solicitudes" ON solicitudes_upgrade
  FOR UPDATE
  USING (soy_superadmin())
  WITH CHECK (soy_superadmin());

COMMIT;

-- =========================================================
-- Verificación (opcional):
-- =========================================================
-- SELECT id, nombre, plan, plan_iniciado_en FROM restaurantes;
-- SELECT * FROM solicitudes_upgrade;
