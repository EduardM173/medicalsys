-- HU-36: publicación, segmentación, consentimiento, promociones y fidelización.
-- Se aplica a public y a cada schema tenant ya provisionado.
DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN SELECT schema_name FROM public.organizacion
           UNION SELECT 'public'
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema=s AND table_name='campania') THEN
      EXECUTE format('ALTER TABLE %I.campania ADD COLUMN IF NOT EXISTS contenido_publicable TEXT, ADD COLUMN IF NOT EXISTS imagen_url VARCHAR(500), ADD COLUMN IF NOT EXISTS segmento_edad_min INTEGER, ADD COLUMN IF NOT EXISTS segmento_edad_max INTEGER, ADD COLUMN IF NOT EXISTS segmento_sexo VARCHAR(20), ADD COLUMN IF NOT EXISTS segmento_ubicacion VARCHAR(120), ADD COLUMN IF NOT EXISTS segmento_condiciones JSONB, ADD COLUMN IF NOT EXISTS segmento_nivel VARCHAR(20), ADD COLUMN IF NOT EXISTS whatsapp_habilitado BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN IF NOT EXISTS puntos_conversion INTEGER NOT NULL DEFAULT 0', s);

      EXECUTE format('CREATE TABLE IF NOT EXISTS %I.preferencia_marketing (id_preferencia BIGSERIAL PRIMARY KEY, id_paciente BIGINT NOT NULL UNIQUE REFERENCES %I.paciente(id_paciente) ON DELETE CASCADE, suscrito BOOLEAN NOT NULL DEFAULT TRUE, whatsapp_autorizado BOOLEAN NOT NULL DEFAULT FALSE, fecha_exclusion TIMESTAMPTZ, fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW())', s, s);
      EXECUTE format('CREATE TABLE IF NOT EXISTS %I.campania_servicio (id_campania BIGINT NOT NULL REFERENCES %I.campania(id_campania) ON DELETE CASCADE, id_servicio BIGINT NOT NULL REFERENCES %I.servicio_medico(id_servicio) ON DELETE CASCADE, PRIMARY KEY (id_campania,id_servicio))', s, s, s);
      EXECUTE format('CREATE TABLE IF NOT EXISTS %I.campania_destinatario (id_destinatario BIGSERIAL PRIMARY KEY, id_campania BIGINT NOT NULL REFERENCES %I.campania(id_campania) ON DELETE CASCADE, id_paciente BIGINT NOT NULL REFERENCES %I.paciente(id_paciente) ON DELETE CASCADE, estado VARCHAR(30) NOT NULL DEFAULT ''ALCANZADO'', proveedor_referencia VARCHAR(255), fecha_alcance TIMESTAMPTZ NOT NULL DEFAULT NOW(), fecha_entrega TIMESTAMPTZ, fecha_conversion TIMESTAMPTZ, UNIQUE(id_campania,id_paciente))', s, s, s);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_campania_destinatario_estado ON %I.campania_destinatario(id_campania,estado)', s);
      EXECUTE format('CREATE TABLE IF NOT EXISTS %I.promocion_uso (id_uso BIGSERIAL PRIMARY KEY, id_campania BIGINT NOT NULL REFERENCES %I.campania(id_campania), id_paciente BIGINT NOT NULL REFERENCES %I.paciente(id_paciente), id_servicio BIGINT NOT NULL REFERENCES %I.servicio_medico(id_servicio), clave_idempotencia VARCHAR(120) NOT NULL UNIQUE, descuento_aplicado DECIMAL(12,2) NOT NULL, puntos_otorgados INTEGER NOT NULL DEFAULT 0 CHECK(puntos_otorgados >= 0), fecha_uso TIMESTAMPTZ NOT NULL DEFAULT NOW())', s, s, s, s);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_promocion_uso_campania ON %I.promocion_uso(id_campania,fecha_uso)', s);
      EXECUTE format('CREATE TABLE IF NOT EXISTS %I.evento_fidelizacion (id_evento BIGSERIAL PRIMARY KEY, id_paciente BIGINT NOT NULL REFERENCES %I.paciente(id_paciente) ON DELETE CASCADE, clave_idempotencia VARCHAR(120) NOT NULL UNIQUE, tipo VARCHAR(50) NOT NULL, puntos INTEGER NOT NULL CHECK(puntos >= 0), nivel_anterior VARCHAR(20), nivel_nuevo VARCHAR(20), referencia VARCHAR(180), fecha_evento TIMESTAMPTZ NOT NULL DEFAULT NOW())', s, s);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_evento_fidelizacion_paciente ON %I.evento_fidelizacion(id_paciente,fecha_evento)', s);
    END IF;
  END LOOP;
END $$;
