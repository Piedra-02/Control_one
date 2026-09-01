

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
