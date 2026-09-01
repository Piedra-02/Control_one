-- =========================================================
-- Control One - Esquema de base de datos (v2)
-- Aplicación de un solo usuario (sin login).
-- Basado en: Mapa de afinidad, Patrones encontrados y
-- Estructura general de navegación.
-- Motor objetivo: PostgreSQL
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- para gen_random_uuid()

-- ---------------------------------------------------------
-- USUARIOS
-- Login simple con un único usuario fijo. La contraseña
-- se guarda como hash (bcrypt vía pgcrypto), nunca en texto
-- plano.
-- ---------------------------------------------------------
CREATE TABLE usuarios (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario          VARCHAR(50) NOT NULL UNIQUE,
    contrasena_hash  VARCHAR(255) NOT NULL,
    fecha_creacion   TIMESTAMP NOT NULL DEFAULT now()
);

-- Usuario inicial: douglas123 / cruz123
INSERT INTO usuarios (usuario, contrasena_hash)
VALUES ('douglas123', crypt('cruz123', gen_salt('bf')));

-- ---------------------------------------------------------
-- CONFIGURACION
-- Fila única con los ajustes generales de la app,
-- incluido el correo donde llegan los avisos.
-- ---------------------------------------------------------
CREATE TABLE configuracion (
    id                    SMALLINT PRIMARY KEY DEFAULT 1,
    correo_notificacion   VARCHAR(160) NOT NULL,
    notificar_por_correo  BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_actualizacion   TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT solo_una_fila CHECK (id = 1)
);

-- ---------------------------------------------------------
-- CATEGORIAS  (patrón: "Categorías y filtros")
-- Transversal: tareas, eventos, notas y archivos
-- ---------------------------------------------------------
CREATE TABLE categorias (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre  VARCHAR(80) NOT NULL UNIQUE,
    color   VARCHAR(20)
);

-- ---------------------------------------------------------
-- TAREAS  (Organización > Tareas y actividades)
-- ---------------------------------------------------------
CREATE TABLE tareas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id        UUID REFERENCES categorias(id) ON DELETE SET NULL,
    titulo              VARCHAR(200) NOT NULL,
    descripcion         TEXT,
    estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                         CHECK (estado IN ('pendiente','en_progreso','completada')),
    prioridad           VARCHAR(10) NOT NULL DEFAULT 'media'
                         CHECK (prioridad IN ('baja','media','alta')),
    fecha_vencimiento   TIMESTAMP,
    fecha_creacion      TIMESTAMP NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_tareas_estado ON tareas(estado);
CREATE INDEX idx_tareas_categoria ON tareas(categoria_id);

-- ---------------------------------------------------------
-- EVENTOS  (Organización > Calendario)
-- ---------------------------------------------------------
CREATE TABLE eventos (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id   UUID REFERENCES categorias(id) ON DELETE SET NULL,
    titulo         VARCHAR(200) NOT NULL,
    descripcion    TEXT,
    ubicacion      VARCHAR(200),
    fecha_inicio   TIMESTAMP NOT NULL,
    fecha_fin      TIMESTAMP NOT NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT now(),
    CHECK (fecha_fin >= fecha_inicio)
);
CREATE INDEX idx_eventos_fecha ON eventos(fecha_inicio);

-- ---------------------------------------------------------
-- RECORDATORIOS  (patrón: "Recordatorios y notificaciones")
-- Puede asociarse a una tarea O a un evento (no ambos)
-- ---------------------------------------------------------
CREATE TABLE recordatorios (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarea_id       UUID REFERENCES tareas(id) ON DELETE CASCADE,
    evento_id      UUID REFERENCES eventos(id) ON DELETE CASCADE,
    titulo         VARCHAR(200) NOT NULL,
    fecha_hora     TIMESTAMP NOT NULL,
    enviado        BOOLEAN NOT NULL DEFAULT FALSE,
    intentos_envio INT NOT NULL DEFAULT 0,
    CHECK (
        (tarea_id IS NOT NULL AND evento_id IS NULL) OR
        (tarea_id IS NULL AND evento_id IS NOT NULL) OR
        (tarea_id IS NULL AND evento_id IS NULL)
    )
);
CREATE INDEX idx_recordatorios_pendientes ON recordatorios(fecha_hora) WHERE enviado = FALSE;

-- ---------------------------------------------------------
-- NOTAS  (Información > Notas)
-- ---------------------------------------------------------
CREATE TABLE notas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id        UUID REFERENCES categorias(id) ON DELETE SET NULL,
    titulo              VARCHAR(200) NOT NULL,
    contenido           TEXT,
    fecha_creacion      TIMESTAMP NOT NULL DEFAULT now(),
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- ARCHIVOS  (Información > Archivos y documentos)
-- ---------------------------------------------------------
CREATE TABLE archivos (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id   UUID REFERENCES categorias(id) ON DELETE SET NULL,
    nombre         VARCHAR(200) NOT NULL,
    url            VARCHAR(500) NOT NULL,
    tipo           VARCHAR(50),
    tamano_bytes   BIGINT,
    fecha_subida   TIMESTAMP NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- FAVORITOS  (Información > Favoritos)
-- Referencia polimórfica: tipo_elemento indica a qué tabla
-- apunta elemento_id ('tarea', 'evento', 'nota', 'archivo')
-- La integridad referencial se valida a nivel de aplicación.
-- ---------------------------------------------------------
CREATE TABLE favoritos (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_elemento  VARCHAR(20) NOT NULL CHECK (tipo_elemento IN ('tarea','evento','nota','archivo')),
    elemento_id    UUID NOT NULL,
    fecha_agregado TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (tipo_elemento, elemento_id)
);

-- ---------------------------------------------------------
-- HISTORIAL  (Información > Historial)
-- Registro de actividad reciente, también polimórfico
-- ---------------------------------------------------------
CREATE TABLE historial (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_elemento  VARCHAR(20) NOT NULL CHECK (tipo_elemento IN ('tarea','evento','nota','archivo')),
    elemento_id    UUID NOT NULL,
    accion         VARCHAR(20) NOT NULL CHECK (accion IN ('creado','editado','completado','eliminado','consultado')),
    fecha          TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_historial_fecha ON historial(fecha DESC);

-- ---------------------------------------------------------
-- Fila inicial de configuración
-- Reemplaza el correo por el que vaya a recibir los avisos
-- ---------------------------------------------------------
INSERT INTO configuracion (id, correo_notificacion, notificar_por_correo)
VALUES (1, 'tu_correo@gmail.com', TRUE);

-- =========================================================
-- Fin del script
-- =========================================================
