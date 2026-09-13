-- ============================================================
-- MedicalSys - 03_sprint5_multitenancy.sql
-- Implementación de Multitenencia SaaS por Infraestructura (HU-30)
-- Aislamiento físico multi-schema en PostgreSQL
-- ============================================================

BEGIN;

-- 1. Tablas globales del SaaS (en esquema public)
CREATE TABLE IF NOT EXISTS public.organizacion (
    id_organizacion BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(30) NOT NULL DEFAULT 'CLINICA',
    subdominio VARCHAR(60) UNIQUE NOT NULL,
    schema_name VARCHAR(60) UNIQUE NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVA',
    plan_suscripcion VARCHAR(50) NOT NULL DEFAULT 'PROFESIONAL',
    fecha_suscripcion_fin TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizacion_codigo ON public.organizacion(codigo);
CREATE INDEX IF NOT EXISTS idx_organizacion_subdominio ON public.organizacion(subdominio);
CREATE INDEX IF NOT EXISTS idx_organizacion_estado ON public.organizacion(estado);

CREATE TABLE IF NOT EXISTS public.usuario_organizacion (
    id_usuario_org BIGSERIAL PRIMARY KEY,
    id_usuario BIGINT NOT NULL REFERENCES public.usuario(id_usuario) ON DELETE CASCADE,
    id_organizacion BIGINT NOT NULL REFERENCES public.organizacion(id_organizacion) ON DELETE CASCADE,
    rol_en_organizacion VARCHAR(50) NOT NULL DEFAULT 'ADMINISTRADOR',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_usuario_organizacion UNIQUE (id_usuario, id_organizacion)
);

CREATE INDEX IF NOT EXISTS idx_usr_org_usuario ON public.usuario_organizacion(id_usuario);
CREATE INDEX IF NOT EXISTS idx_usr_org_organizacion ON public.usuario_organizacion(id_organizacion);

CREATE TABLE IF NOT EXISTS public.pago_suscripcion_tenant (
    id_pago BIGSERIAL PRIMARY KEY,
    id_organizacion BIGINT NOT NULL REFERENCES public.organizacion(id_organizacion) ON DELETE CASCADE,
    monto DECIMAL(12, 2) NOT NULL,
    moneda VARCHAR(10) NOT NULL DEFAULT 'BOB',
    codigo_qr TEXT,
    referencia_pago VARCHAR(100) UNIQUE NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    meses_renovacion INT NOT NULL DEFAULT 1,
    fecha_pago TIMESTAMPTZ,
    fecha_creacion TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pago_suscripcion_org ON public.pago_suscripcion_tenant(id_organizacion);
CREATE INDEX IF NOT EXISTS idx_pago_suscripcion_ref ON public.pago_suscripcion_tenant(referencia_pago);

-- 2. Procedimiento para provisionar un nuevo esquema de tenant
CREATE OR REPLACE PROCEDURE public.sp_provision_tenant(
    p_codigo VARCHAR,
    p_nombre VARCHAR,
    p_tipo VARCHAR,
    p_subdominio VARCHAR,
    p_nit VARCHAR,
    p_direccion VARCHAR,
    p_telefono VARCHAR,
    p_email VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_schema VARCHAR := 'tenant_' || lower(p_codigo);
    v_org_id BIGINT;
BEGIN
    -- Registrar en catalogo central
    INSERT INTO public.organizacion (codigo, nombre, tipo, subdominio, schema_name, estado, plan_suscripcion, fecha_suscripcion_fin)
    VALUES (lower(p_codigo), p_nombre, p_tipo, lower(p_subdominio), v_schema, 'ACTIVA', 'PROFESIONAL', NOW() + INTERVAL '30 days')
    ON CONFLICT (codigo) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        tipo = EXCLUDED.tipo,
        subdominio = EXCLUDED.subdominio,
        schema_name = EXCLUDED.schema_name
    RETURNING id_organizacion INTO v_org_id;

    -- Crear esquema fisico
    EXECUTE 'CREATE SCHEMA IF NOT EXISTS ' || quote_ident(v_schema);

    -- Clonar tablas clinicas en el esquema del tenant
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.configuracion_clinica (LIKE public.configuracion_clinica INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.paciente (LIKE public.paciente INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.medico (LIKE public.medico INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.horario_medico (LIKE public.horario_medico INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.servicio_medico (LIKE public.servicio_medico INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.sala (LIKE public.sala INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.cita (LIKE public.cita INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.reserva_sala (LIKE public.reserva_sala INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.historia_clinica (LIKE public.historia_clinica INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.atencion_medica (LIKE public.atencion_medica INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.receta (LIKE public.receta INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.documento_clinico (LIKE public.documento_clinico INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.consentimiento_informado (LIKE public.consentimiento_informado INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.factura (LIKE public.factura INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.detalle_factura (LIKE public.detalle_factura INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.notificacion (LIKE public.notificacion INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.campania (LIKE public.campania INCLUDING ALL)';
    EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident(v_schema) || '.fidelizacion_paciente (LIKE public.fidelizacion_paciente INCLUDING ALL)';

    -- Insertar configuracion fiscal independiente del tenant
    EXECUTE 'INSERT INTO ' || quote_ident(v_schema) || '.configuracion_clinica (nombre_comercial, razon_social, nit, direccion, telefono, email, activa)
             SELECT ' || quote_literal(p_nombre) || ', ' || quote_literal(p_nombre || ' S.R.L.') || ', ' || quote_literal(p_nit) || ', ' || quote_literal(p_direccion) || ', ' || quote_literal(p_telefono) || ', ' || quote_literal(p_email) || ', TRUE
             WHERE NOT EXISTS (SELECT 1 FROM ' || quote_ident(v_schema) || '.configuracion_clinica)';
END;
$$;

-- 3. Aprovisionar los tenants base
CALL public.sp_provision_tenant(
    'cumed',
    'Clínica Cumed',
    'CLINICA',
    'cumed',
    '1023942027',
    'Av. Arce Nro. 2300, La Paz',
    '+591 2 244 0000',
    'administracion@cumed.bo'
);

CALL public.sp_provision_tenant(
    'sanrafael',
    'Centro Médico San Rafael',
    'CONSULTORIO',
    'sanrafael',
    '4247012018',
    'Av. 20 de Octubre Nro. 450, Sucre',
    '+591 4 645 1122',
    'contacto@sanrafael.bo'
);

-- 4. Copiar datos existentes de public hacia tenant_cumed para preservar continuidad
INSERT INTO tenant_cumed.paciente SELECT * FROM public.paciente ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.medico SELECT * FROM public.medico ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.horario_medico SELECT * FROM public.horario_medico ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.servicio_medico SELECT * FROM public.servicio_medico ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.sala SELECT * FROM public.sala ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.cita SELECT * FROM public.cita ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.reserva_sala SELECT * FROM public.reserva_sala ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.historia_clinica SELECT * FROM public.historia_clinica ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.atencion_medica SELECT * FROM public.atencion_medica ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.receta SELECT * FROM public.receta ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.documento_clinico SELECT * FROM public.documento_clinico ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.consentimiento_informado SELECT * FROM public.consentimiento_informado ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.factura SELECT * FROM public.factura ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.detalle_factura SELECT * FROM public.detalle_factura ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.notificacion SELECT * FROM public.notificacion ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.campania SELECT * FROM public.campania ON CONFLICT DO NOTHING;
INSERT INTO tenant_cumed.fidelizacion_paciente SELECT * FROM public.fidelizacion_paciente ON CONFLICT DO NOTHING;

-- 5. Insertar datos demostrativos específicos en tenant_sanrafael (para demostrar aislamiento físico)
INSERT INTO tenant_sanrafael.servicio_medico (codigo, nombre, descripcion, tipo, duracion_minutos, precio_base, activo)
VALUES ('SR-MED-01', 'Consulta Traumatología San Rafael', 'Atención especializada en Sucre', 'CONSULTA', 30, 220.00, true)
ON CONFLICT DO NOTHING;

INSERT INTO tenant_sanrafael.paciente (nombres, apellidos, documento_identidad, complemento, fecha_nacimiento, sexo, grupo_sanguineo, email, telefono, direccion, contacto_emergencia, telefono_emergencia, activo)
VALUES ('Carlos Rodrigo', 'Mendoza Paredes', '7788990', '', '1985-06-12', 'MASCULINO', 'O+', 'carlos.mendoza@email.com', '+591 76543210', 'Calle Calvo 123, Sucre', 'Mariana Paredes', '+591 76543211', true)
ON CONFLICT DO NOTHING;

-- 6. Asociar usuarios existentes a las organizaciones
-- Administrador (id_usuario = 1) tiene acceso a Cumed y a San Rafael
INSERT INTO public.usuario_organizacion (id_usuario, id_organizacion, rol_en_organizacion, activo)
SELECT u.id_usuario, o.id_organizacion, 'ADMINISTRADOR', true
FROM public.usuario u
CROSS JOIN public.organizacion o
WHERE u.id_rol = 1
ON CONFLICT DO NOTHING;

COMMIT;
