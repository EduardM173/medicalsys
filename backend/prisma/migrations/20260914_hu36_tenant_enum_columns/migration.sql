-- Prisma conectado con ?schema=tenant_x genera parámetros tipados contra los
-- enums de ese schema. Las columnas deben usar esos mismos tipos.
DO $$
DECLARE
  s TEXT;
  enum_record RECORD;
  column_record RECORD;
  default_label TEXT;
BEGIN
  FOR s IN SELECT schema_name FROM public.organizacion LOOP
    FOR enum_record IN
      SELECT t.typname, string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) AS labels
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname
    LOOP
      BEGIN
        EXECUTE format('CREATE TYPE %I.%I AS ENUM (%s)', s, enum_record.typname, enum_record.labels);
      EXCEPTION WHEN duplicate_object THEN
        NULL;
      END;

      FOR column_record IN
        SELECT c.table_name, c.column_name, c.column_default
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
         AND t.table_type = 'BASE TABLE'
        WHERE c.table_schema = s
          AND c.udt_schema = 'public'
          AND c.udt_name = enum_record.typname
      LOOP
        default_label := substring(column_record.column_default FROM '^''([^'']+)''::');
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT', s, column_record.table_name, column_record.column_name);
        EXECUTE format(
          'ALTER TABLE %I.%I ALTER COLUMN %I TYPE %I.%I USING %I::text::%I.%I',
          s, column_record.table_name, column_record.column_name,
          s, enum_record.typname, column_record.column_name, s, enum_record.typname
        );
        IF default_label IS NOT NULL THEN
          EXECUTE format(
            'ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %L::%I.%I',
            s, column_record.table_name, column_record.column_name,
            default_label, s, enum_record.typname
          );
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
