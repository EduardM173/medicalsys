const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const schemas = ['tenant_cumed', 'tenant_sanrafael', 'tenant_univalle'];

  const enums = await p.$queryRawUnsafe(`
    SELECT t.typname, string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) as labels
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname;
  `);

  for (const schema of schemas) {
    console.log(`Configuring enums and casts for ${schema}...`);
    for (const e of enums) {
      try {
        await p.$executeRawUnsafe(`CREATE TYPE ${schema}.${e.typname} AS ENUM (${e.labels});`);
      } catch (_err) {
        // enum already exists
      }

      try {
        await p.$executeRawUnsafe(`CREATE CAST (public.${e.typname} AS ${schema}.${e.typname}) WITH INOUT AS IMPLICIT;`);
      } catch (_err) {
        // cast already exists
      }

      try {
        await p.$executeRawUnsafe(`CREATE CAST (${schema}.${e.typname} AS public.${e.typname}) WITH INOUT AS IMPLICIT;`);
      } catch (_err) {
        // cast already exists
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

  console.log('All tenant schemas successfully configured with enums, casts, and identity views!');
}

run()
  .catch(console.error)
  .finally(() => p.$disconnect());
