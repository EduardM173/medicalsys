-- ============================================================
-- MedicalSys - 01_schema_mvp.sql
-- Base de datos completa propuesta para el MVP universitario.
-- Ejecutar EN LA BASE DE DATOS: medicalsys
--
-- Alcance cubierto:
-- usuarios/roles, pacientes, médicos, horarios, servicios,
-- citas, salas/reservas, historia clínica, atenciones, recetas,
-- documentos, consentimientos, facturación, campañas y WhatsApp.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE estado_usuario AS ENUM (
    'ACTIVO',
    'INACTIVO',
    'SUSPENDIDO'
);

CREATE TYPE tipo_servicio AS ENUM (
    'CONSULTA',
    'PROCEDIMIENTO',
    'CIRUGIA',
    'EXAMEN',
    'OTRO'
);

CREATE TYPE tipo_sala AS ENUM (
    'CONSULTORIO',
    'QUIROFANO',
    'SALA'
);

CREATE TYPE estado_sala AS ENUM (
    'DISPONIBLE',
    'MANTENIMIENTO',
    'INACTIVA'
);

CREATE TYPE estado_cita AS ENUM (
    'PROGRAMADA',
    'CONFIRMADA',
    'EN_CONSULTA',
    'COMPLETADA',
    'CANCELADA'
);

CREATE TYPE estado_reserva AS ENUM (
    'ACTIVA',
    'CANCELADA',
    'FINALIZADA'
);

CREATE TYPE tipo_documento_clinico AS ENUM (
    'EXAMEN',
    'RADIOGRAFIA',
    'CONSENTIMIENTO',
    'RECETA',
    'INFORME',
    'OTRO'
);

CREATE TYPE estado_consentimiento AS ENUM (
    'GENERADO',
    'PENDIENTE_FIRMA',
    'FIRMADO',
    'ANULADO'
);

CREATE TYPE metodo_pago AS ENUM (
    'EFECTIVO',
    'QR',
    'TARJETA',
    'TRANSFERENCIA',
    'OTRO'
);

CREATE TYPE estado_factura AS ENUM (
    'BORRADOR',
    'EMITIDA',
    'ANULADA'
);

CREATE TYPE estado_sin AS ENUM (
    'NO_ENVIADA',
    'PENDIENTE',
    'EMITIDA',
    'RECHAZADA',
    'SIMULADA'
);

CREATE TYPE estado_campania AS ENUM (
    'BORRADOR',
    'PROGRAMADA',
    'ACTIVA',
    'FINALIZADA',
    'CANCELADA'
);

CREATE TYPE tipo_notificacion AS ENUM (
    'CONFIRMACION_CITA',
    'RECORDATORIO_CITA',
    'MENSAJE_DIRECTO',
    'RECETA',
    'CAMPANIA'
);

CREATE TYPE direccion_mensaje AS ENUM (
    'SALIENTE',
    'ENTRANTE'
);

CREATE TYPE estado_notificacion AS ENUM (
    'PENDIENTE',
    'ENVIADA',
    'ENTREGADA',
    'LEIDA',
    'FALLIDA'
);

-- ============================================================
-- CONFIGURACIÓN GENERAL
-- ============================================================

CREATE TABLE configuracion_clinica (
    id_configuracion      BIGSERIAL PRIMARY KEY,
    nombre_comercial      VARCHAR(150) NOT NULL,
    razon_social          VARCHAR(200) NOT NULL,
    nit                   VARCHAR(30) NOT NULL UNIQUE,
    direccion             VARCHAR(255),
    telefono              VARCHAR(30),
    email                 VARCHAR(150),
    ciudad                VARCHAR(100) DEFAULT 'La Paz',
    pais                  VARCHAR(100) DEFAULT 'Bolivia',
    activa                BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- IDENTIDAD Y ACCESO
-- ============================================================

CREATE TABLE rol (
    id_rol                BIGSERIAL PRIMARY KEY,
    codigo                VARCHAR(30) NOT NULL UNIQUE,
    nombre                VARCHAR(80) NOT NULL,
    descripcion           VARCHAR(255),
    activo                BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE usuario (
    id_usuario            BIGSERIAL PRIMARY KEY,
    id_rol                BIGINT NOT NULL,
    nombres               VARCHAR(100) NOT NULL,
    apellidos             VARCHAR(100) NOT NULL,
    email                 VARCHAR(150) NOT NULL UNIQUE,
    password_hash         VARCHAR(255) NOT NULL,
    telefono              VARCHAR(30),
    estado                estado_usuario NOT NULL DEFAULT 'ACTIVO',
    fecha_creacion        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_usuario_rol
        FOREIGN KEY (id_rol)
        REFERENCES rol(id_rol)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_usuario_rol
    ON usuario(id_rol);

CREATE INDEX idx_usuario_estado
    ON usuario(estado);

-- ============================================================
-- PACIENTES
-- ============================================================

CREATE TABLE paciente (
    id_paciente           BIGSERIAL PRIMARY KEY,
    id_usuario            BIGINT UNIQUE,
    nombres               VARCHAR(100) NOT NULL,
    apellidos             VARCHAR(100) NOT NULL,
    documento_identidad   VARCHAR(30) NOT NULL,
    complemento           VARCHAR(10) NOT NULL DEFAULT '',
    fecha_nacimiento      DATE,
    sexo                  VARCHAR(20),
    grupo_sanguineo       VARCHAR(5),
    email                 VARCHAR(150),
    telefono              VARCHAR(30),
    direccion             VARCHAR(255),
    contacto_emergencia   VARCHAR(150),
    telefono_emergencia   VARCHAR(30),
    activo                BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_paciente_documento
        UNIQUE (documento_identidad, complemento),

    CONSTRAINT fk_paciente_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_paciente_nombre
    ON paciente(apellidos, nombres);

CREATE INDEX idx_paciente_activo
    ON paciente(activo);

-- ============================================================
-- MÉDICOS Y HORARIOS
-- ============================================================

CREATE TABLE medico (
    id_medico                 BIGSERIAL PRIMARY KEY,
    id_usuario                BIGINT NOT NULL UNIQUE,
    matricula_profesional     VARCHAR(100) NOT NULL UNIQUE,
    especialidad              VARCHAR(150) NOT NULL,
    activo                    BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_medico_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE horario_medico (
    id_horario             BIGSERIAL PRIMARY KEY,
    id_medico              BIGINT NOT NULL,
    dia_semana             SMALLINT NOT NULL,
    hora_inicio            TIME NOT NULL,
    hora_fin               TIME NOT NULL,
    activo                 BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_horario_dia
        CHECK (dia_semana BETWEEN 1 AND 7),

    CONSTRAINT ck_horario_intervalo
        CHECK (hora_fin > hora_inicio),

    CONSTRAINT uq_horario_medico
        UNIQUE (id_medico, dia_semana, hora_inicio, hora_fin),

    CONSTRAINT fk_horario_medico
        FOREIGN KEY (id_medico)
        REFERENCES medico(id_medico)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX idx_horario_medico_dia
    ON horario_medico(id_medico, dia_semana);

-- ============================================================
-- CATÁLOGO DE SERVICIOS
-- ============================================================

CREATE TABLE servicio_medico (
    id_servicio            BIGSERIAL PRIMARY KEY,
    codigo                 VARCHAR(30) NOT NULL UNIQUE,
    nombre                 VARCHAR(180) NOT NULL,
    descripcion            TEXT,
    tipo                   tipo_servicio NOT NULL,
    duracion_minutos       INTEGER NOT NULL,
    precio_base            NUMERIC(12,2) NOT NULL,
    activo                 BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_servicio_duracion
        CHECK (duracion_minutos > 0),

    CONSTRAINT ck_servicio_precio
        CHECK (precio_base >= 0)
);

-- ============================================================
-- SALAS / CONSULTORIOS / QUIRÓFANOS
-- ============================================================

CREATE TABLE sala (
    id_sala                BIGSERIAL PRIMARY KEY,
    nombre                 VARCHAR(120) NOT NULL UNIQUE,
    tipo                   tipo_sala NOT NULL,
    ubicacion              VARCHAR(180),
    estado                 estado_sala NOT NULL DEFAULT 'DISPONIBLE',
    fecha_creacion         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CITAS Y RESERVAS
-- ============================================================

CREATE TABLE cita (
    id_cita                BIGSERIAL PRIMARY KEY,
    id_paciente            BIGINT NOT NULL,
    id_medico              BIGINT NOT NULL,
    id_servicio            BIGINT NOT NULL,
    creado_por             BIGINT,
    fecha_hora_inicio      TIMESTAMPTZ NOT NULL,
    fecha_hora_fin         TIMESTAMPTZ NOT NULL,
    motivo                 TEXT,
    indicaciones_previas   TEXT,
    estado                 estado_cita NOT NULL DEFAULT 'PROGRAMADA',
    fecha_creacion         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_cita_intervalo
        CHECK (fecha_hora_fin > fecha_hora_inicio),

    CONSTRAINT fk_cita_paciente
        FOREIGN KEY (id_paciente)
        REFERENCES paciente(id_paciente)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_cita_medico
        FOREIGN KEY (id_medico)
        REFERENCES medico(id_medico)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_cita_servicio
        FOREIGN KEY (id_servicio)
        REFERENCES servicio_medico(id_servicio)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_cita_creado_por
        FOREIGN KEY (creado_por)
        REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_cita_medico_fecha
    ON cita(id_medico, fecha_hora_inicio);

CREATE INDEX idx_cita_paciente_fecha
    ON cita(id_paciente, fecha_hora_inicio);

CREATE INDEX idx_cita_estado
    ON cita(estado);

CREATE TABLE reserva_sala (
    id_reserva             BIGSERIAL PRIMARY KEY,
    id_cita                BIGINT NOT NULL UNIQUE,
    id_sala                BIGINT NOT NULL,
    fecha_hora_inicio      TIMESTAMPTZ NOT NULL,
    fecha_hora_fin         TIMESTAMPTZ NOT NULL,
    estado                 estado_reserva NOT NULL DEFAULT 'ACTIVA',
    fecha_creacion         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_reserva_intervalo
        CHECK (fecha_hora_fin > fecha_hora_inicio),

    CONSTRAINT fk_reserva_cita
        FOREIGN KEY (id_cita)
        REFERENCES cita(id_cita)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_reserva_sala
        FOREIGN KEY (id_sala)
        REFERENCES sala(id_sala)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX idx_reserva_sala_fecha
    ON reserva_sala(id_sala, fecha_hora_inicio, fecha_hora_fin);

-- ============================================================
-- HISTORIA CLÍNICA Y ATENCIONES
-- ============================================================

CREATE TABLE historia_clinica (
    id_historia                BIGSERIAL PRIMARY KEY,
    id_paciente                BIGINT NOT NULL UNIQUE,
    fecha_apertura             DATE NOT NULL DEFAULT CURRENT_DATE,
    antecedentes               TEXT,
    alergias                   TEXT,
    condiciones_cronicas       TEXT,
    observaciones_generales    TEXT,
    fecha_creacion             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_historia_paciente
        FOREIGN KEY (id_paciente)
        REFERENCES paciente(id_paciente)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE TABLE atencion_medica (
    id_atencion               BIGSERIAL PRIMARY KEY,
    id_historia               BIGINT NOT NULL,
    id_medico                 BIGINT NOT NULL,
    id_cita                   BIGINT UNIQUE,
    fecha_atencion            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    motivo_consulta           TEXT NOT NULL,
    anamnesis                 TEXT,
    diagnostico_codigo        VARCHAR(30),
    diagnostico_descripcion   TEXT,
    tratamiento               TEXT,
    observaciones             TEXT,
    presion_sistolica         SMALLINT,
    presion_diastolica        SMALLINT,
    frecuencia_cardiaca       SMALLINT,
    temperatura               NUMERIC(4,1),
    saturacion_oxigeno        SMALLINT,
    peso_kg                   NUMERIC(6,2),
    talla_cm                  NUMERIC(6,2),
    fecha_creacion            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_atencion_sistolica
        CHECK (presion_sistolica IS NULL OR presion_sistolica > 0),

    CONSTRAINT ck_atencion_diastolica
        CHECK (presion_diastolica IS NULL OR presion_diastolica > 0),

    CONSTRAINT ck_atencion_fc
        CHECK (frecuencia_cardiaca IS NULL OR frecuencia_cardiaca > 0),

    CONSTRAINT ck_atencion_spo2
        CHECK (saturacion_oxigeno IS NULL OR saturacion_oxigeno BETWEEN 0 AND 100),

    CONSTRAINT ck_atencion_peso
        CHECK (peso_kg IS NULL OR peso_kg > 0),

    CONSTRAINT ck_atencion_talla
        CHECK (talla_cm IS NULL OR talla_cm > 0),

    CONSTRAINT fk_atencion_historia
        FOREIGN KEY (id_historia)
        REFERENCES historia_clinica(id_historia)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_atencion_medico
        FOREIGN KEY (id_medico)
        REFERENCES medico(id_medico)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_atencion_cita
        FOREIGN KEY (id_cita)
        REFERENCES cita(id_cita)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_atencion_historia_fecha
    ON atencion_medica(id_historia, fecha_atencion DESC);

CREATE TABLE receta (
    id_receta               BIGSERIAL PRIMARY KEY,
    id_atencion             BIGINT NOT NULL,
    indicaciones            TEXT NOT NULL,
    estado                  VARCHAR(30) NOT NULL DEFAULT 'ACTIVA',
    fecha_emision           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_receta_atencion
        FOREIGN KEY (id_atencion)
        REFERENCES atencion_medica(id_atencion)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX idx_receta_atencion
    ON receta(id_atencion);

-- ============================================================
-- DOCUMENTOS CLÍNICOS
-- ============================================================

CREATE TABLE documento_clinico (
    id_documento            BIGSERIAL PRIMARY KEY,
    id_historia             BIGINT NOT NULL,
    id_atencion             BIGINT,
    subido_por              BIGINT,
    tipo                    tipo_documento_clinico NOT NULL,
    titulo                  VARCHAR(180) NOT NULL,
    nombre_archivo          VARCHAR(255) NOT NULL,
    storage_provider        VARCHAR(30) NOT NULL DEFAULT 'LOCAL',
    storage_key             VARCHAR(500) NOT NULL UNIQUE,
    mime_type               VARCHAR(120),
    tamano_bytes            BIGINT,
    hash_sha256             VARCHAR(64),
    fecha_registro          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_documento_tamano
        CHECK (tamano_bytes IS NULL OR tamano_bytes >= 0),

    CONSTRAINT fk_documento_historia
        FOREIGN KEY (id_historia)
        REFERENCES historia_clinica(id_historia)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_documento_atencion
        FOREIGN KEY (id_atencion)
        REFERENCES atencion_medica(id_atencion)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_documento_subido_por
        FOREIGN KEY (subido_por)
        REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_documento_historia_fecha
    ON documento_clinico(id_historia, fecha_registro DESC);

CREATE INDEX idx_documento_atencion
    ON documento_clinico(id_atencion);

-- ============================================================
-- CONSENTIMIENTO INFORMADO
-- ============================================================

CREATE TABLE consentimiento_informado (
    id_consentimiento       BIGSERIAL PRIMARY KEY,
    id_documento            BIGINT UNIQUE,
    id_paciente             BIGINT NOT NULL,
    id_medico               BIGINT NOT NULL,
    id_cita                 BIGINT,
    folio                   VARCHAR(50) NOT NULL UNIQUE,
    procedimiento           VARCHAR(255) NOT NULL,
    contenido               TEXT NOT NULL,
    estado                  estado_consentimiento NOT NULL DEFAULT 'GENERADO',
    firma_storage_key       VARCHAR(500),
    firma_hash_sha256       VARCHAR(64),
    fecha_generacion        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_firma             TIMESTAMPTZ,

    CONSTRAINT fk_consentimiento_documento
        FOREIGN KEY (id_documento)
        REFERENCES documento_clinico(id_documento)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_consentimiento_paciente
        FOREIGN KEY (id_paciente)
        REFERENCES paciente(id_paciente)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_consentimiento_medico
        FOREIGN KEY (id_medico)
        REFERENCES medico(id_medico)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_consentimiento_cita
        FOREIGN KEY (id_cita)
        REFERENCES cita(id_cita)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

-- ============================================================
-- FACTURACIÓN
-- ============================================================

CREATE TABLE factura (
    id_factura                 BIGSERIAL PRIMARY KEY,
    id_configuracion_clinica   BIGINT NOT NULL,
    id_paciente                BIGINT NOT NULL,
    id_cita                    BIGINT,
    emitida_por                BIGINT,
    numero_factura             VARCHAR(60) NOT NULL UNIQUE,
    fecha_emision              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    nit_ci                     VARCHAR(40),
    complemento                VARCHAR(10) NOT NULL DEFAULT '',
    razon_social               VARCHAR(200) NOT NULL,
    email_receptor             VARCHAR(150),
    metodo_pago                metodo_pago NOT NULL,
    subtotal                   NUMERIC(12,2) NOT NULL DEFAULT 0,
    total                      NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado                     estado_factura NOT NULL DEFAULT 'BORRADOR',
    sin_estado                 estado_sin NOT NULL DEFAULT 'NO_ENVIADA',
    sin_referencia             VARCHAR(255),
    codigo_autorizacion        VARCHAR(255),
    cuf                        VARCHAR(255),
    qr_payload                 TEXT,
    fecha_creacion             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_factura_subtotal
        CHECK (subtotal >= 0),

    CONSTRAINT ck_factura_total
        CHECK (total >= 0),

    CONSTRAINT fk_factura_configuracion
        FOREIGN KEY (id_configuracion_clinica)
        REFERENCES configuracion_clinica(id_configuracion)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_factura_paciente
        FOREIGN KEY (id_paciente)
        REFERENCES paciente(id_paciente)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_factura_cita
        FOREIGN KEY (id_cita)
        REFERENCES cita(id_cita)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_factura_emitida_por
        FOREIGN KEY (emitida_por)
        REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_factura_paciente_fecha
    ON factura(id_paciente, fecha_emision DESC);

CREATE INDEX idx_factura_estado
    ON factura(estado, sin_estado);

CREATE TABLE detalle_factura (
    id_detalle              BIGSERIAL PRIMARY KEY,
    id_factura              BIGINT NOT NULL,
    id_servicio             BIGINT,
    descripcion             VARCHAR(255) NOT NULL,
    cantidad                INTEGER NOT NULL DEFAULT 1,
    precio_unitario         NUMERIC(12,2) NOT NULL,
    subtotal                NUMERIC(12,2) NOT NULL,

    CONSTRAINT ck_detalle_cantidad
        CHECK (cantidad > 0),

    CONSTRAINT ck_detalle_precio
        CHECK (precio_unitario >= 0),

    CONSTRAINT ck_detalle_subtotal
        CHECK (subtotal >= 0),

    CONSTRAINT fk_detalle_factura
        FOREIGN KEY (id_factura)
        REFERENCES factura(id_factura)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_detalle_servicio
        FOREIGN KEY (id_servicio)
        REFERENCES servicio_medico(id_servicio)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_detalle_factura
    ON detalle_factura(id_factura);

-- ============================================================
-- CAMPAÑAS Y WHATSAPP
-- ============================================================

CREATE TABLE campania (
    id_campania             BIGSERIAL PRIMARY KEY,
    creada_por              BIGINT,
    nombre                  VARCHAR(180) NOT NULL,
    descripcion             TEXT,
    fecha_inicio            TIMESTAMPTZ,
    fecha_fin               TIMESTAMPTZ,
    estado                  estado_campania NOT NULL DEFAULT 'BORRADOR',
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_campania_fechas
        CHECK (
            fecha_fin IS NULL
            OR fecha_inicio IS NULL
            OR fecha_fin >= fecha_inicio
        ),

    CONSTRAINT fk_campania_creada_por
        FOREIGN KEY (creada_por)
        REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE TABLE notificacion (
    id_notificacion         BIGSERIAL PRIMARY KEY,
    id_paciente             BIGINT NOT NULL,
    id_cita                 BIGINT,
    id_campania             BIGINT,
    usuario_emisor          BIGINT,
    tipo                    tipo_notificacion NOT NULL,
    direccion               direccion_mensaje NOT NULL DEFAULT 'SALIENTE',
    canal                   VARCHAR(30) NOT NULL DEFAULT 'WHATSAPP',
    telefono_destino        VARCHAR(30) NOT NULL,
    mensaje                 TEXT NOT NULL,
    fecha_programada        TIMESTAMPTZ,
    fecha_envio             TIMESTAMPTZ,
    fecha_entrega           TIMESTAMPTZ,
    fecha_lectura           TIMESTAMPTZ,
    estado                  estado_notificacion NOT NULL DEFAULT 'PENDIENTE',
    proveedor_referencia    VARCHAR(255),
    fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_notificacion_paciente
        FOREIGN KEY (id_paciente)
        REFERENCES paciente(id_paciente)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_notificacion_cita
        FOREIGN KEY (id_cita)
        REFERENCES cita(id_cita)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_notificacion_campania
        FOREIGN KEY (id_campania)
        REFERENCES campania(id_campania)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_notificacion_emisor
        FOREIGN KEY (usuario_emisor)
        REFERENCES usuario(id_usuario)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);

CREATE INDEX idx_notificacion_paciente_fecha
    ON notificacion(id_paciente, fecha_creacion DESC);

CREATE INDEX idx_notificacion_estado
    ON notificacion(estado);

CREATE INDEX idx_notificacion_campania
    ON notificacion(id_campania);

COMMIT;
