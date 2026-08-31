-- =========================================================
-- Control One - Mejoras al esquema (v3)
-- Ejecutar DESPUÉS de control_one_schema.sql
-- Incluye:
--   1. Actualización automática de fecha_actualizacion
--   2. Búsqueda rápida (texto completo) en tareas/notas/archivos
--   3. Zona horaria en todas las fechas (TIMESTAMPTZ)
-- =========================================================


-- =========================================================
-- 1. ACTUALIZACIÓN AUTOMÁTICA DE fecha_actualizacion
-- Cada vez que se haga un UPDATE en tareas, notas o
-- configuracion, este trigger pone la fecha actual sin que
-- el backend tenga que acordarse de hacerlo manualmente.
-- =========================================================

CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tareas_actualizado
BEFORE UPDATE ON tareas
FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_actualizacion();

CREATE TRIGGER trg_notas_actualizado
BEFORE UPDATE ON notas
FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_actualizacion();

CREATE TRIGGER trg_configuracion_actualizado
BEFORE UPDATE ON configuracion
FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_actualizacion();


-- =========================================================
-- 2. BÚSQUEDA RÁPIDA E INTELIGENTE (texto completo)
-- Se agrega una columna calculada 'busqueda' que combina
-- los campos de texto relevantes, y un índice GIN para que
-- las consultas sean casi instantáneas incluso con muchos
-- registros. El idioma 'spanish' hace que encuentre
-- coincidencias aunque cambien singular/plural o género.
-- =========================================================

ALTER TABLE tareas ADD COLUMN busqueda tsvector
    GENERATED ALWAYS AS (
        to_tsvector('spanish', coalesce(titulo,'') || ' ' || coalesce(descripcion,''))
    ) STORED;
CREATE INDEX idx_tareas_busqueda ON tareas USING GIN(busqueda);

ALTER TABLE notas ADD COLUMN busqueda tsvector
    GENERATED ALWAYS AS (
        to_tsvector('spanish', coalesce(titulo,'') || ' ' || coalesce(contenido,''))
    ) STORED;
CREATE INDEX idx_notas_busqueda ON notas USING GIN(busqueda);

ALTER TABLE archivos ADD COLUMN busqueda tsvector
    GENERATED ALWAYS AS (
        to_tsvector('spanish', coalesce(nombre,''))
    ) STORED;
CREATE INDEX idx_archivos_busqueda ON archivos USING GIN(busqueda);

-- Ejemplo de cómo el backend usaría esto (no se ejecuta aquí,
-- es solo referencia para cuando programen el buscador):
--
-- SELECT titulo, descripcion FROM tareas
-- WHERE busqueda @@ plainto_tsquery('spanish', 'reunion viernes');


-- =========================================================
-- 3. ZONA HORARIA EN LAS FECHAS (TIMESTAMPTZ)
-- Cambia todas las columnas de fecha de TIMESTAMP a
-- TIMESTAMPTZ. Esto evita confusiones si en el futuro se
-- accede desde otro dispositivo en otra zona horaria (patrón:
-- "Acceso desde diferentes dispositivos" / "Sincronización").
-- Se asume que las fechas ya guardadas están en hora de
-- Ecuador (America/Guayaquil); ajusta esa zona si no aplica.
-- =========================================================

ALTER TABLE usuarios
    ALTER COLUMN fecha_creacion TYPE TIMESTAMPTZ USING fecha_creacion AT TIME ZONE 'America/Guayaquil';

ALTER TABLE configuracion
    ALTER COLUMN fecha_actualizacion TYPE TIMESTAMPTZ USING fecha_actualizacion AT TIME ZONE 'America/Guayaquil';

ALTER TABLE tareas
    ALTER COLUMN fecha_vencimiento TYPE TIMESTAMPTZ USING fecha_vencimiento AT TIME ZONE 'America/Guayaquil',
    ALTER COLUMN fecha_creacion TYPE TIMESTAMPTZ USING fecha_creacion AT TIME ZONE 'America/Guayaquil',
    ALTER COLUMN fecha_actualizacion TYPE TIMESTAMPTZ USING fecha_actualizacion AT TIME ZONE 'America/Guayaquil';

ALTER TABLE eventos
    ALTER COLUMN fecha_inicio TYPE TIMESTAMPTZ USING fecha_inicio AT TIME ZONE 'America/Guayaquil',
    ALTER COLUMN fecha_fin TYPE TIMESTAMPTZ USING fecha_fin AT TIME ZONE 'America/Guayaquil',
    ALTER COLUMN fecha_creacion TYPE TIMESTAMPTZ USING fecha_creacion AT TIME ZONE 'America/Guayaquil';

ALTER TABLE recordatorios
    ALTER COLUMN fecha_hora TYPE TIMESTAMPTZ USING fecha_hora AT TIME ZONE 'America/Guayaquil';

ALTER TABLE notas
    ALTER COLUMN fecha_creacion TYPE TIMESTAMPTZ USING fecha_creacion AT TIME ZONE 'America/Guayaquil',
    ALTER COLUMN fecha_actualizacion TYPE TIMESTAMPTZ USING fecha_actualizacion AT TIME ZONE 'America/Guayaquil';

ALTER TABLE archivos
    ALTER COLUMN fecha_subida TYPE TIMESTAMPTZ USING fecha_subida AT TIME ZONE 'America/Guayaquil';

ALTER TABLE favoritos
    ALTER COLUMN fecha_agregado TYPE TIMESTAMPTZ USING fecha_agregado AT TIME ZONE 'America/Guayaquil';

ALTER TABLE historial
    ALTER COLUMN fecha TYPE TIMESTAMPTZ USING fecha AT TIME ZONE 'America/Guayaquil';

-- =========================================================
-- Fin del script de mejoras
-- =========================================================
