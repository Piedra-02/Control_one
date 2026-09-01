"""
Control One - Capa de acceso a datos
--------------------------------------
Repositorios con POO: cada clase se encarga de un grupo de
tablas y expone métodos simples (listar, crear, actualizar,
eliminar) para que app.py no tenga SQL suelto en las rutas.
"""

import os
import uuid
import datetime
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()


def serializar(valor):
    """Convierte tipos que json.dumps no entiende (UUID, fechas)
    a texto plano, recursivamente si es una lista o diccionario."""
    if isinstance(valor, dict):
        return {k: serializar(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [serializar(v) for v in valor]
    if isinstance(valor, (uuid.UUID, datetime.datetime, datetime.date)):
        return str(valor)
    return valor


class BaseDeDatos:
    """Maneja la conexión a PostgreSQL y ejecuta consultas."""

    def __init__(self):
        self.conexion = psycopg2.connect(
            host=os.getenv("DB_HOST", "localhost"),
            dbname=os.getenv("DB_NAME", "control_one"),
            user=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD"),
            port=int(os.getenv("DB_PORT", 5432)),
        )

    def ejecutar(self, sql, params=None, retornar="all"):
        """retornar: 'all' | 'one' | 'none'"""
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params or ())
            resultado = None
            if retornar == "all":
                resultado = cur.fetchall()
            elif retornar == "one":
                resultado = cur.fetchone()
            self.conexion.commit()
            return serializar(resultado)


class ContactoRepository:
    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def listar(self, filtro="todos"):
        if filtro == "ocultos":
            condicion = "WHERE oculto = TRUE"
        elif filtro == "archivados":
            condicion = "WHERE archivado = TRUE"
        else:
            condicion = "WHERE oculto = FALSE AND archivado = FALSE"
        return self.bd.ejecutar(
            f"SELECT * FROM contactos {condicion} ORDER BY fecha_creacion DESC"
        )

    def crear(self, nombre, telefono):
        return self.bd.ejecutar(
            """INSERT INTO contactos (nombre, telefono)
               VALUES (%s, %s) RETURNING *""",
            (nombre, telefono),
            retornar="one",
        )

    def actualizar_flags(self, contacto_id, oculto=None, archivado=None):
        campos, valores = [], []
        if oculto is not None:
            campos.append("oculto = %s")
            valores.append(oculto)
        if archivado is not None:
            campos.append("archivado = %s")
            valores.append(archivado)
        if not campos:
            return None
        valores.append(contacto_id)
        return self.bd.ejecutar(
            f"UPDATE contactos SET {', '.join(campos)} WHERE id = %s RETURNING *",
            tuple(valores),
            retornar="one",
        )

    def eliminar(self, contacto_id):
        self.bd.ejecutar("DELETE FROM contactos WHERE id = %s", (contacto_id,), retornar="none")


class PerfilRepository:
    """Como no hay multiusuario, siempre se opera sobre el único
    usuario existente (douglas123)."""

    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def obtener(self):
        return self.bd.ejecutar(
            "SELECT usuario, nombre_completo, alias, foto_url FROM usuarios LIMIT 1",
            retornar="one",
        )

    def actualizar(self, nombre_completo, alias):
        return self.bd.ejecutar(
            """UPDATE usuarios SET nombre_completo = %s, alias = %s
               WHERE id = (SELECT id FROM usuarios LIMIT 1)
               RETURNING usuario, nombre_completo, alias, foto_url""",
            (nombre_completo, alias),
            retornar="one",
        )


class ConfiguracionRepository:
    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def obtener(self):
        return self.bd.ejecutar(
            "SELECT correo_notificacion, notificar_por_correo FROM configuracion WHERE id = 1",
            retornar="one",
        )

    def actualizar(self, correo_notificacion, notificar_por_correo):
        return self.bd.ejecutar(
            """UPDATE configuracion SET correo_notificacion = %s, notificar_por_correo = %s
               WHERE id = 1 RETURNING correo_notificacion, notificar_por_correo""",
            (correo_notificacion, notificar_por_correo),
            retornar="one",
        )


class AutomatizacionRepository:
    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def crear(self, nombre, descripcion, tipo_regla, condicion):
        automatizacion = self.bd.ejecutar(
            """INSERT INTO automatizaciones (nombre, descripcion, tipo_regla, condicion)
               VALUES (%s, %s, %s, %s) RETURNING *""",
            (nombre, descripcion, tipo_regla, condicion),
            retornar="one",
        )
        # Registrar automáticamente la creación en el historial
        self.bd.ejecutar(
            """INSERT INTO historial_automatizacion (automatizacion_id, titulo, estado)
               VALUES (%s, %s, 'ejecutada')""",
            (automatizacion["id"], "Tarea Automatizada"),
            retornar="none",
        )
        return automatizacion

    def historial(self):
        return self.bd.ejecutar(
            """SELECT h.id, h.titulo, h.fecha_ejecucion, h.estado, a.nombre AS automatizacion_nombre
               FROM historial_automatizacion h
               JOIN automatizaciones a ON a.id = h.automatizacion_id
               ORDER BY h.fecha_ejecucion DESC
               LIMIT 20"""
        )
