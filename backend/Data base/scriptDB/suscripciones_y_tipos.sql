
CREATE TABLE suscripciones (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre         VARCHAR(150) NOT NULL,
    monto          NUMERIC(10,2) NOT NULL DEFAULT 9.99,
    moneda         VARCHAR(5) NOT NULL DEFAULT 'USD',
    activa         BOOLEAN NOT NULL DEFAULT TRUE,
    categoria      VARCHAR(80) DEFAULT 'General',
    metodo_pago    VARCHAR(150),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE
    nombre_restriccion TEXT;
BEGIN
    SELECT con.conname INTO nombre_restriccion
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'favoritos' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%tipo_elemento%';

    IF nombre_restriccion IS NOT NULL THEN
        EXECUTE format('ALTER TABLE favoritos DROP CONSTRAINT %I', nombre_restriccion);
    END IF;

    ALTER TABLE favoritos ADD CONSTRAINT favoritos_tipo_elemento_check
        CHECK (tipo_elemento IN ('tarea','evento','nota','archivo','suscripcion'));
END $$;

DO $$
DECLARE
    nombre_restriccion TEXT;
BEGIN
    SELECT con.conname INTO nombre_restriccion
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'historial' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) LIKE '%tipo_elemento%';

    IF nombre_restriccion IS NOT NULL THEN
        EXECUTE format('ALTER TABLE historial DROP CONSTRAINT %I', nombre_restriccion);
    END IF;

    ALTER TABLE historial ADD CONSTRAINT historial_tipo_elemento_check
        CHECK (tipo_elemento IN ('tarea','evento','nota','archivo','suscripcion'));
END $$;
