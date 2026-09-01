-- =========================================================
-- Control One - Ampliación del esquema (v4)
-- Ejecutar DESPUÉS de control_one_schema.sql y
-- control_one_mejoras.sql
-- Incluye:
--   1. Automatización (Acciones, Reglas, Historial) - según Figma
--   2. Contactos (según pantalla de Perfil del Figma)
--   3. Datos de perfil en usuarios (nombre, alias, foto)
-- =========================================================


-- =========================================================
-- 1. AUTOMATIZACIÓN
-- Refleja los campos exactos del formulario: Nombre y
-- Descripción de la acción, el tipo de regla (bidireccional,
-- direccional, condicional, etc.) y la Condición en texto
-- libre.
-- =========================================================

CREATE TABLE automatizaciones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(150) NOT NULL,
    descripcion     TEXT,
    tipo_regla      VARCHAR(30) NOT NULL DEFAULT 'direccional'
                    CHECK (tipo_regla IN (
                        'bidireccional',
                        'direccional',
                        'solo_si_se_cumple_condicion',
                        'depurador_detallado',
                        'solo_si_no_se_cumple_condicion'
                    )),
    condicion       TEXT,
    activa          BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Historial de acciones" - cada tarjeta "Tarea Automatizada"
-- que se ve en la pantalla corresponde a una fila aquí.
CREATE TABLE historial_automatizacion (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automatizacion_id   UUID NOT NULL REFERENCES automatizaciones(id) ON DELETE CASCADE,
    titulo              VARCHAR(150) NOT NULL DEFAULT 'Tarea Automatizada',
    fecha_ejecucion     TIMESTAMPTZ NOT NULL DEFAULT now(),
    estado              VARCHAR(20) NOT NULL DEFAULT 'ejecutada'
                        CHECK (estado IN ('programada','ejecutada','fallida')),
    detalle_resultado   TEXT
);
CREATE INDEX idx_historial_automatizacion_fecha ON historial_automatizacion(fecha_ejecucion DESC);


-- =========================================================
-- 2. CONTACTOS
-- Según la pantalla de Perfil: lista de contactos con
-- teléfono, opción de llamar, y estados Ocultos/Archivados.
-- =========================================================

CREATE TABLE contactos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(150) NOT NULL,
    telefono        VARCHAR(20) NOT NULL,
    oculto          BOOLEAN NOT NULL DEFAULT FALSE,
    archivado       BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contactos_estado ON contactos(oculto, archivado);


-- =========================================================
-- 3. DATOS DE PERFIL EN USUARIOS
-- La pantalla de Perfil muestra nombre completo, alias y
-- foto — se agregan a la tabla usuarios ya existente.
-- =========================================================

ALTER TABLE usuarios ADD COLUMN nombre_completo VARCHAR(150);
ALTER TABLE usuarios ADD COLUMN alias VARCHAR(50);
ALTER TABLE usuarios ADD COLUMN foto_url VARCHAR(300);

-- Cuando definan el perfil real, complétenlo así (ejemplo):
-- UPDATE usuarios
-- SET nombre_completo = 'Nombre completo aquí',
--     alias = 'alias_aqui'
-- WHERE usuario = 'douglas123';

-- =========================================================
-- Fin del script
-- =========================================================
