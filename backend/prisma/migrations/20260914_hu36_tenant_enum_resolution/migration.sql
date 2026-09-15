-- Los schemas tenant clonados con LIKE public conservan los tipos enum de
-- public. Eliminar tipos locales sin uso evita que Prisma resuelva sus
-- parámetros contra un enum homónimo incompatible.
DO $$
DECLARE
  s TEXT;
  enum_name TEXT;
BEGIN
  FOR s IN SELECT schema_name FROM public.organizacion LOOP
    FOR enum_name IN
      SELECT t.typname
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname
    LOOP
      BEGIN
        EXECUTE format('DROP CAST IF EXISTS (public.%I AS %I.%I)', enum_name, s, enum_name);
        EXECUTE format('DROP CAST IF EXISTS (%I.%I AS public.%I)', s, enum_name, enum_name);
        EXECUTE format('DROP TYPE IF EXISTS %I.%I', s, enum_name);
      EXCEPTION WHEN dependent_objects_still_exist OR undefined_object THEN
        NULL;
      END;
    END LOOP;
  END LOOP;
END $$;
