-- ============================================================
-- Función: borrado de datos de un cliente final (derecho al olvido RGPD)
-- ============================================================
-- Aplicar en Supabase: SQL Editor > New query > pega esto > Run
--
-- Borra los datos personales de un cliente final de un restaurante:
--   - ANONIMIZA sus pedidos (conserva la venta: importe, productos, fecha;
--     elimina nombre, teléfono y dirección).
--   - ANONIMIZA sus reseñas (conserva la puntuación para la media; elimina
--     teléfono y comentario, que podrían contener datos personales).
--   - ELIMINA por completo: ficha de cliente, conversaciones, registros de
--     campañas y límites de uso.
--
-- Es atómica (todo o nada). SECURITY DEFINER para poder tocar tablas que el
-- panel no puede por RLS (conversaciones, rate_limits), pero con control de
-- autorización dentro: solo el dueño del restaurante o un superadmin.

CREATE OR REPLACE FUNCTION borrar_cliente_rgpd(p_restaurante_id uuid, p_telefono text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Autorización: solo el dueño del restaurante o un superadmin.
  IF NOT (p_restaurante_id = mi_restaurante_id() OR soy_superadmin()) THEN
    RAISE EXCEPTION 'No autorizado para borrar datos de este restaurante';
  END IF;

  -- Anonimizar pedidos: conservar la venta sin datos personales.
  UPDATE pedidos
    SET cliente_nombre = 'Cliente eliminado',
        cliente_telefono = NULL,
        cliente_direccion = NULL
    WHERE restaurante_id = p_restaurante_id AND cliente_telefono = p_telefono;

  -- Anonimizar reseñas: conservar la puntuación (media), quitar PII.
  UPDATE resenas
    SET cliente_telefono = NULL,
        comentario = NULL
    WHERE restaurante_id = p_restaurante_id AND cliente_telefono = p_telefono;

  -- Eliminar por completo el resto de datos personales.
  DELETE FROM clientes        WHERE restaurante_id = p_restaurante_id AND telefono = p_telefono;
  DELETE FROM conversaciones  WHERE restaurante_id = p_restaurante_id AND telefono = p_telefono;
  DELETE FROM campanas_envios WHERE restaurante_id = p_restaurante_id AND cliente_telefono = p_telefono;
  DELETE FROM rate_limits     WHERE restaurante_id = p_restaurante_id AND telefono = p_telefono;
END;
$$;

-- Permitir que los usuarios autenticados la invoquen (la autorización fina
-- está dentro de la función).
GRANT EXECUTE ON FUNCTION borrar_cliente_rgpd(uuid, text) TO authenticated;
