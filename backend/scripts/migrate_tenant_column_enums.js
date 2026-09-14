const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  const schemas = ['tenant_cumed', 'tenant_sanrafael', 'tenant_univalle'];

  for (const schema of schemas) {
    console.log(`Checking and migrating enum columns for ${schema}...`);

    const cols = await p.$queryRawUnsafe(`
      SELECT table_name, column_name, column_default, udt_name
      FROM information_schema.columns
      WHERE table_schema = '${schema}'
        AND data_type = 'USER-DEFINED'
        AND udt_schema = 'public'
        AND table_name NOT IN ('usuario', 'rol');
    `);

    for (const col of cols) {
      const { table_name, column_name, column_default, udt_name } = col;
      console.log(`Migrating ${schema}.${table_name}.${column_name} to ${schema}.${udt_name}...`);

      if (column_default) {
        await p.$executeRawUnsafe(`ALTER TABLE ${schema}.${table_name} ALTER COLUMN ${column_name} DROP DEFAULT;`);
      }

      await p.$executeRawUnsafe(`
        ALTER TABLE ${schema}.${table_name} 
        ALTER COLUMN ${column_name} TYPE ${schema}.${udt_name} 
        USING ${column_name}::text::${schema}.${udt_name};
      `);

      if (column_default) {
        // Replace public.<udt_name> with schema.<udt_name> in default expression
        const cleanDefault = String(column_default)
          .replace(new RegExp(`'::public\\.${udt_name}`, 'g'), `'::${schema}.${udt_name}`)
          .replace(new RegExp(`'::${udt_name}`, 'g'), `'::${schema}.${udt_name}`);
        await p.$executeRawUnsafe(`ALTER TABLE ${schema}.${table_name} ALTER COLUMN ${column_name} SET DEFAULT ${cleanDefault};`);
      }
    }
  }

  console.log('All tenant columns successfully migrated to native tenant enum types!');
}

run()
  .catch(console.error)
  .finally(() => p.$disconnect());
