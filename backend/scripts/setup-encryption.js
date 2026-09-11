require('dotenv').config();
const prisma = require('../src/config/prisma');

/**
 * HU-31: configurción de cifrado en la base de datos.
 * Idempotente: agrega columnas de índices ciegos y la tabla de mensajes
 * clínicos sin borrar datos ni cambiar permisos existentes.
 */
async function setupEncryption() {
  await prisma.$transaction(async (db) => {
    await db.$executeRawUnsafe(`
      ALTER TABLE atencion_medica
        ALTER COLUMN diagnostico_codigo TYPE VARCHAR(255)
    `);
    await db.$executeRawUnsafe(`
      ALTER TABLE atencion_medica
        ADD COLUMN IF NOT EXISTS diagnostico_codigo_blind_index VARCHAR(64)
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_atencion_diagnostico_blind
        ON atencion_medica (diagnostico_codigo_blind_index)
    `);
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS mensaje_clinico (
        id_mensaje BIGSERIAL PRIMARY KEY,
        id_historia BIGINT NOT NULL REFERENCES historia_clinica(id_historia),
        id_medico BIGINT NOT NULL REFERENCES medico(id_medico),
        destinatario_role VARCHAR(50),
        contenido TEXT NOT NULL,
        fecha_envio TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_mensaje_clinico_historia_fecha
        ON mensaje_clinico (id_historia, fecha_envio DESC)
    `);
  });
}

if (require.main === module) {
  setupEncryption()
    .then(() => console.log('Configuración de cifrado lista. Datos existentes conservados.'))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = setupEncryption;