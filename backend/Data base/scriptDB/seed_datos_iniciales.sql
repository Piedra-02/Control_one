
INSERT INTO categorias (nombre, color) VALUES
    ('IMPORTANTE', '#00bcd4'),
    ('OBLIGATORIO', '#00bcd4'),
    ('UNIVERSIDAD', '#00bcd4'),
    ('PROYECTO INTEGRADOR', '#00bcd4'),
    ('NO IMPORTANTE', '#00bcd4');

INSERT INTO tareas (titulo, categoria_id, prioridad) VALUES
    ('Hacer las compras del mes', (SELECT id FROM categorias WHERE nombre = 'IMPORTANTE'), 'alta'),
    ('Hablar al licenciado de Filosofía', (SELECT id FROM categorias WHERE nombre = 'IMPORTANTE'), 'media'),
    ('Acabar el proyecto integrador', (SELECT id FROM categorias WHERE nombre = 'IMPORTANTE'), 'alta'),
    ('Limpiar la casa', (SELECT id FROM categorias WHERE nombre = 'OBLIGATORIO'), 'media'),
    ('Ir a entregar el pedido', (SELECT id FROM categorias WHERE nombre = 'OBLIGATORIO'), 'baja'),
    ('Terminar de decorar la habitación', (SELECT id FROM categorias WHERE nombre = 'OBLIGATORIO'), 'baja'),
    ('Estudiar para el examen de cálculo', (SELECT id FROM categorias WHERE nombre = 'UNIVERSIDAD'), 'alta'),
    ('Diseñar mockups de interfaz', (SELECT id FROM categorias WHERE nombre = 'PROYECTO INTEGRADOR'), 'media');

INSERT INTO eventos (titulo, descripcion, ubicacion, fecha_inicio, fecha_fin) VALUES
    ('Cumpleaños Mamá', 'Hoy es el cumpleaños de tu mamá.', 'Casa familiar', '2026-08-30 19:00:00', '2026-08-30 23:00:00'),
    ('Entrega de Proyecto', 'Revisión final de Control One.', 'Oficina', '2026-08-27 10:00:00', '2026-08-27 12:00:00'),
    ('Reunión de Planificación', 'Planificar las actividades del mes de septiembre.', 'Virtual', '2026-08-31 15:00:00', '2026-08-31 16:00:00');

INSERT INTO recordatorios (titulo, fecha_hora) VALUES
    ('Tomar descanso activo', '2026-08-31 18:30:00'),
    ('Sincronizar tareas de la semana', '2026-08-31 21:00:00'),
    ('Regar las plantas del balcón', '2026-09-01 08:00:00');
