-- HU-33: los tenants creados antes de la firma digital tenían solamente
-- consentimiento_informado. Prisma necesita también las relaciones auxiliares.
-- Esta migración es idempotente y cubre los esquemas tenant ya aprovisionados.
DO $$
DECLARE
  tenant_schema text;
BEGIN
  FOR tenant_schema IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'tenant_%'
  LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.plantilla_consentimiento
       (LIKE public.plantilla_consentimiento INCLUDING ALL)',
      tenant_schema
    );
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.firma_digital_consentimiento
       (LIKE public.firma_digital_consentimiento INCLUDING ALL)',
      tenant_schema
    );
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.anulacion_consentimiento
       (LIKE public.anulacion_consentimiento INCLUDING ALL)',
      tenant_schema
    );

    -- Instalaciones antiguas pueden tener la tabla base sin las columnas HU-33.
    EXECUTE format(
      'ALTER TABLE %I.consentimiento_informado
       ADD COLUMN IF NOT EXISTS id_plantilla bigint,
       ADD COLUMN IF NOT EXISTS version_plantilla integer DEFAULT 1,
       ADD COLUMN IF NOT EXISTS pdf_path varchar(500),
       ADD COLUMN IF NOT EXISTS pdf_hash varchar(64)',
      tenant_schema
    );
  END LOOP;
END $$;
