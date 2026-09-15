const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const organizations = await p.organizacion.findMany({ select: { schema_name: true } });
  const schemas = organizations.map((item) => item.schema_name);

  const enums = await p.$queryRawUnsafe(`
    SELECT t.typname, string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) AS labels
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname;
  `);

  for (const schema of schemas) {
    if (!/^[a-z][a-z0-9_]*$/.test(schema)) throw new Error(`Schema tenant inválido: ${schema}`);
    console.log(`Normalizando enums para ${schema}...`);
    for (const e of enums) {
      try {
        await p.$executeRawUnsafe(`CREATE TYPE ${schema}.${e.typname} AS ENUM (${e.labels});`);
      } catch (err) {
        if (!String(err.message).includes('already exists')) throw err;
      }
      const columns = await p.$queryRawUnsafe(`
        SELECT c.table_name, c.column_name, c.column_default
        FROM information_schema.columns c
        JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
        WHERE c.table_schema = '${schema}' AND c.udt_schema = 'public' AND c.udt_name = '${e.typname}'
      `);
      for (const column of columns) {
        await p.$executeRawUnsafe(`ALTER TABLE ${schema}."${column.table_name}" ALTER COLUMN "${column.column_name}" DROP DEFAULT`);
        await p.$executeRawUnsafe(`ALTER TABLE ${schema}."${column.table_name}" ALTER COLUMN "${column.column_name}" TYPE ${schema}.${e.typname} USING "${column.column_name}"::text::${schema}.${e.typname}`);
        const defaultMatch = column.column_default?.match(/^'([^']+)'::/);
        if (defaultMatch) {
          await p.$executeRawUnsafe(`ALTER TABLE ${schema}."${column.table_name}" ALTER COLUMN "${column.column_name}" SET DEFAULT '${defaultMatch[1]}'::${schema}.${e.typname}`);
        }
      }
    }
    // Also ensure views for usuario and rol
    try {
      await p.$executeRawUnsafe(`CREATE OR REPLACE VIEW ${schema}.usuario AS SELECT * FROM public.usuario;`);
      await p.$executeRawUnsafe(`CREATE OR REPLACE VIEW ${schema}.rol AS SELECT * FROM public.rol;`);
    } catch (err) {
      console.error(`Error creating views for ${schema}:`, err.message);
    }
  }

  console.log('Schemas tenant normalizados con enums propios y vistas de identidad.');
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
