

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


CREATE TABLE contactos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(150) NOT NULL,
    telefono        VARCHAR(20) NOT NULL,
    oculto          BOOLEAN NOT NULL DEFAULT FALSE,
    archivado       BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_contactos_estado ON contactos(oculto, archivado);


ALTER TABLE usuarios ADD COLUMN nombre_completo VARCHAR(150);
ALTER TABLE usuarios ADD COLUMN alias VARCHAR(50);
ALTER TABLE usuarios ADD COLUMN foto_url VARCHAR(300);

