-- ============================================================
-- SPRINT 4: HU-27 (Campañas de Salud) y HU-28 (Fidelización)
-- ============================================================

-- HU-27: Campos extendidos para promociones de salud
ALTER TABLE campania
    ADD COLUMN IF NOT EXISTS tipo_promocion VARCHAR(50) DEFAULT 'GENERAL',
    ADD COLUMN IF NOT EXISTS descuento_porcentaje NUMERIC(5, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS publico_objetivo VARCHAR(200),
    ADD COLUMN IF NOT EXISTS presupuesto NUMERIC(10, 2) DEFAULT 0;

-- HU-28: Tipos enum y tabla de fidelización de pacientes
DO $$ BEGIN
    CREATE TYPE estado_fidelizacion AS ENUM ('ACTIVO', 'INACTIVO', 'SUSPENDIDO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE nivel_fidelizacion AS ENUM ('ESTANDAR', 'FRECUENTE', 'PREMIUM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS fidelizacion_paciente (
    id_fidelizacion     BIGSERIAL PRIMARY KEY,
    id_paciente         BIGINT NOT NULL UNIQUE,
    estado              estado_fidelizacion NOT NULL DEFAULT 'ACTIVO',
    nivel               nivel_fidelizacion NOT NULL DEFAULT 'ESTANDAR',
    puntos_acumulados   INTEGER NOT NULL DEFAULT 0,
    fecha_inscripcion   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notas               TEXT,

    CONSTRAINT fk_fidelizacion_paciente
        FOREIGN KEY (id_paciente)
        REFERENCES paciente(id_paciente)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fidelizacion_estado ON fidelizacion_paciente(estado);
CREATE INDEX IF NOT EXISTS idx_fidelizacion_nivel ON fidelizacion_paciente(nivel);
