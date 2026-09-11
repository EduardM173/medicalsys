require('dotenv').config();
const prisma = require('../src/config/prisma');

/**
 * HU-33: configuración de firma digital de consentimientos en la base de datos.
 * Idempotente: crea el enum de firmante, las tablas de plantillas, firmas PKI y
 * anulaciones, y las columnas de PDF en consentimiento_informado, sin borrar
 * datos existentes. Equivalente a la migración `add_digital_signature_consent_models`.
 */
async function setupDigitalSignature() {
  await prisma.$transaction(async (db) => {
    await db.$executeRawUnsafe(`
      DO $$
      BEGIN
        CREATE TYPE tipo_firmante AS ENUM ('PACIENTE', 'TUTOR');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await db.$executeRawUnsafe(`
      ALTER TABLE consentimiento_informado
        ADD COLUMN IF NOT EXISTS id_plantilla BIGINT,
        ADD COLUMN IF NOT EXISTS version_plantilla INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS pdf_path VARCHAR(500),
        ADD COLUMN IF NOT EXISTS pdf_hash VARCHAR(64)
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_consentimiento_plantilla
        ON consentimiento_informado (id_plantilla)
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS plantilla_consentimiento (
        id_plantilla BIGSERIAL PRIMARY KEY,
        codigo VARCHAR(50) NOT NULL UNIQUE,
        titulo VARCHAR(180) NOT NULL,
        tipo_procedimiento VARCHAR(100) NOT NULL,
        contenido TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        activa BOOLEAN NOT NULL DEFAULT TRUE,
        fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_plantilla_consentimiento_activa
        ON plantilla_consentimiento (codigo, activa)
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS firma_digital_consentimiento (
        id_firma BIGSERIAL PRIMARY KEY,
        id_consentimiento BIGINT NOT NULL UNIQUE
          REFERENCES consentimiento_informado(id_consentimiento),
        tipo_firmante tipo_firmante NOT NULL DEFAULT 'PACIENTE',
        nombre_firmante VARCHAR(180) NOT NULL,
        ci_firmante VARCHAR(40) NOT NULL,
        relacion_tutor VARCHAR(80),
        certificado_pem TEXT NOT NULL,
        emisor_ca VARCHAR(255) NOT NULL,
        serial_number VARCHAR(100) NOT NULL,
        valido_desde TIMESTAMPTZ NOT NULL,
        valido_hasta TIMESTAMPTZ NOT NULL,
        algoritmo VARCHAR(50) NOT NULL,
        fecha_firma TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        hash_documento VARCHAR(64),
        firma_bruta TEXT NOT NULL,
        resultado_validacion BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_firma_consentimiento_emisor
        ON firma_digital_consentimiento (emisor_ca)
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS anulacion_consentimiento (
        id_anulacion BIGSERIAL PRIMARY KEY,
        id_consentimiento BIGINT NOT NULL UNIQUE
          REFERENCES consentimiento_informado(id_consentimiento),
        motivo TEXT NOT NULL,
        anulado_por_usuario BIGINT NOT NULL,
        fecha_anulacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  });
}

if (require.main === module) {
  setupDigitalSignature()
    .then(() => console.log('Firma digital de consentimientos lista. Datos existentes conservados.'))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = setupDigitalSignature;