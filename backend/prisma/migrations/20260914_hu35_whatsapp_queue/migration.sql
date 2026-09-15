-- HU-35 / MED-320, MED-322
-- Cola persistente (outbox) para los mensajes automáticos de citas.

ALTER TYPE "estado_cita" ADD VALUE IF NOT EXISTS 'PENDIENTE_REPROGRAMACION';

DO $$ BEGIN
  CREATE TYPE "estado_cola_notificacion" AS ENUM (
    'PENDIENTE',
    'PROCESANDO',
    'ENVIADA',
    'FALLIDA',
    'CANCELADA'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "cola_notificacion" (
  "id_cola" BIGSERIAL PRIMARY KEY,
  "id_notificacion" BIGINT NOT NULL UNIQUE,
  "id_cita" BIGINT NOT NULL,
  "clave_idempotencia" VARCHAR(255) NOT NULL UNIQUE,
  "fecha_cita_programada" TIMESTAMPTZ NOT NULL,
  "fecha_disponible" TIMESTAMPTZ NOT NULL,
  "estado" "estado_cola_notificacion" NOT NULL DEFAULT 'PENDIENTE',
  "intentos" INTEGER NOT NULL DEFAULT 0 CHECK ("intentos" >= 0),
  "max_intentos" INTEGER NOT NULL DEFAULT 5 CHECK ("max_intentos" > 0),
  "bloqueado_por" VARCHAR(120),
  "bloqueado_hasta" TIMESTAMPTZ,
  "ultimo_error" TEXT,
  "fecha_procesada" TIMESTAMPTZ,
  "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "fecha_actualizacion" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fk_cola_notificacion_cita"
    FOREIGN KEY ("id_cita") REFERENCES "cita"("id_cita") ON DELETE CASCADE,
  CONSTRAINT "fk_cola_notificacion_notificacion"
    FOREIGN KEY ("id_notificacion") REFERENCES "notificacion"("id_notificacion") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_cola_notificacion_lista"
  ON "cola_notificacion" ("estado", "fecha_disponible");
CREATE INDEX IF NOT EXISTS "idx_cola_notificacion_bloqueo"
  ON "cola_notificacion" ("estado", "bloqueado_hasta");
CREATE INDEX IF NOT EXISTS "idx_cola_notificacion_cita"
  ON "cola_notificacion" ("id_cita");
