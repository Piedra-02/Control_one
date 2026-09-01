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
            try:
                cur.execute(sql, params or ())
                resultado = None
                if retornar == "all":
                    resultado = cur.fetchall()
                elif retornar == "one":
                    resultado = cur.fetchone()
                self.conexion.commit()
                return serializar(resultado)
            except Exception:
                # Muy importante: sin este rollback, la conexión queda
                # "trabada" y TODAS las siguientes consultas fallan
                # hasta reiniciar el servidor.
                self.conexion.rollback()
                raise


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


# =============================================================
# Repositorios para las pantallas de Organización y Panel Principal
# (portados desde backend/Python/organizacion.py y panel_principal.py
# para que ambas pantallas usen la misma base de datos y el mismo
# servidor que Perfil y Automatización, en vez de sus propios
# mini-servidores en los puertos 8000/8001).
# =============================================================

class CategoriaRepository:
    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def listar_con_tareas(self):
        categorias = self.bd.ejecutar("SELECT id, nombre, color FROM categorias ORDER BY nombre ASC")
        for cat in categorias:
            cat["tareas"] = self.bd.ejecutar(
                "SELECT id, titulo, prioridad, estado FROM tareas WHERE categoria_id = %s ORDER BY fecha_creacion DESC",
                (cat["id"],),
            )
        return categorias

    def crear(self, nombre, color="#00bcd4"):
        return self.bd.ejecutar(
            "INSERT INTO categorias (nombre, color) VALUES (%s, %s) RETURNING id, nombre, color",
            (nombre.strip().upper(), color),
            retornar="one",
        )

    def modificar(self, categoria_id, nuevo_nombre):
        return self.bd.ejecutar(
            "UPDATE categorias SET nombre = %s WHERE id = %s RETURNING id, nombre, color",
            (nuevo_nombre.strip().upper(), categoria_id),
            retornar="one",
        )

    def eliminar(self, categoria_id):
        # Las tareas de la categoría no se borran, solo se desvinculan
        self.bd.ejecutar("UPDATE tareas SET categoria_id = NULL WHERE categoria_id = %s", (categoria_id,), retornar="none")
        self.bd.ejecutar("DELETE FROM categorias WHERE id = %s", (categoria_id,), retornar="none")


class TareaRepository:
    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def crear_en_categoria(self, titulo, categoria_id, prioridad="media"):
        return self.bd.ejecutar(
            """INSERT INTO tareas (titulo, categoria_id, prioridad)
               VALUES (%s, %s, %s) RETURNING id, titulo, categoria_id, prioridad, estado""",
            (titulo.strip(), categoria_id, prioridad),
            retornar="one",
        )

    def listar(self, estado=None, limite=20):
        base = """SELECT t.id, t.titulo, t.descripcion, t.estado, t.prioridad,
                          t.fecha_vencimiento, c.nombre AS categoria, c.color
                   FROM tareas t
                   LEFT JOIN categorias c ON t.categoria_id = c.id"""
        if estado:
            base += " WHERE t.estado = %s ORDER BY t.fecha_creacion DESC LIMIT %s"
            return self.bd.ejecutar(base, (estado, limite))
        base += " ORDER BY t.fecha_creacion DESC LIMIT %s"
        return self.bd.ejecutar(base, (limite,))

    def cambiar_estado(self, tarea_id, nuevo_estado):
        if nuevo_estado not in ("pendiente", "en_progreso", "completada"):
            raise ValueError(f"Estado no válido: {nuevo_estado}")
        return self.bd.ejecutar(
            "UPDATE tareas SET estado = %s WHERE id = %s RETURNING id, titulo, estado",
            (nuevo_estado, tarea_id),
            retornar="one",
        )

    def crear(self, titulo, descripcion="", prioridad="media", fecha_vencimiento=None, categoria_id=None):
        return self.bd.ejecutar(
            """INSERT INTO tareas (titulo, descripcion, prioridad, fecha_vencimiento, categoria_id)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, titulo, descripcion, estado, prioridad, fecha_vencimiento""",
            (titulo, descripcion, prioridad, fecha_vencimiento, categoria_id),
            retornar="one",
        )

    def eliminar(self, tarea_id):
        self.bd.ejecutar("DELETE FROM tareas WHERE id = %s", (tarea_id,), retornar="none")

    def modificar_titulo(self, tarea_id, titulo):
        return self.bd.ejecutar(
            "UPDATE tareas SET titulo = %s WHERE id = %s RETURNING id, titulo, estado",
            (titulo.strip(), tarea_id),
            retornar="one",
        )


class EventoRepository:
    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def listar_mes(self, anio, mes):
        return self.bd.ejecutar(
            """SELECT id, titulo, descripcion, ubicacion,
                      fecha_inicio::date AS fecha, fecha_inicio, fecha_fin
               FROM eventos
               WHERE EXTRACT(YEAR FROM fecha_inicio) = %s AND EXTRACT(MONTH FROM fecha_inicio) = %s
               ORDER BY fecha_inicio ASC""",
            (anio, mes),
        )

    def listar_recientes(self, limite=10):
        return self.bd.ejecutar(
            """SELECT e.id, e.titulo, e.descripcion, e.ubicacion, e.fecha_inicio, e.fecha_fin,
                      c.nombre AS categoria, c.color
               FROM eventos e
               LEFT JOIN categorias c ON e.categoria_id = c.id
               ORDER BY e.fecha_inicio ASC
               LIMIT %s""",
            (limite,),
        )

    def guardar(self, evento_id, titulo, descripcion, fecha, ubicacion):
        """Crea o modifica un evento a partir de una fecha simple (usado por
        el modal de Organización, que maneja solo día/mes/año)."""
        if evento_id:
            return self.bd.ejecutar(
                """UPDATE eventos
                   SET titulo = %s, descripcion = %s, ubicacion = %s, fecha_inicio = %s, fecha_fin = %s
                   WHERE id = %s
                   RETURNING id, titulo, descripcion, ubicacion, fecha_inicio::date AS fecha""",
                (titulo, descripcion, ubicacion, f"{fecha} 10:00:00", f"{fecha} 12:00:00", evento_id),
                retornar="one",
            )
        return self.bd.ejecutar(
            """INSERT INTO eventos (titulo, descripcion, ubicacion, fecha_inicio, fecha_fin)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, titulo, descripcion, ubicacion, fecha_inicio::date AS fecha""",
            (titulo, descripcion, ubicacion, f"{fecha} 10:00:00", f"{fecha} 12:00:00"),
            retornar="one",
        )

    def crear_detallado(self, titulo, descripcion, ubicacion, fecha_inicio, fecha_fin, categoria_id=None):
        """Crea un evento con fecha/hora completas (usado por el Panel Principal)."""
        return self.bd.ejecutar(
            """INSERT INTO eventos (titulo, descripcion, ubicacion, fecha_inicio, fecha_fin, categoria_id)
               VALUES (%s, %s, %s, %s, %s, %s)
               RETURNING id, titulo, descripcion, ubicacion, fecha_inicio, fecha_fin""",
            (titulo, descripcion, ubicacion, fecha_inicio, fecha_fin, categoria_id),
            retornar="one",
        )

    def eliminar(self, evento_id):
        self.bd.ejecutar("DELETE FROM eventos WHERE id = %s", (evento_id,), retornar="none")


class RecordatorioPanelRepository:
    """Recordatorios para el Panel Principal (distinto del envío por Gmail,
    que ya maneja gmail_notifier.py sobre esta misma tabla)."""

    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def listar(self, solo_pendientes=False, limite=10):
        sql = "SELECT id, titulo, fecha_hora, enviado, tarea_id, evento_id FROM recordatorios"
        if solo_pendientes:
            sql += " WHERE enviado = FALSE"
        sql += " ORDER BY fecha_hora ASC LIMIT %s"
        filas = self.bd.ejecutar(sql, (limite,))
        for r in filas:
            fecha_hora = r.get("fecha_hora") or ""
            r["hora_formateada"] = fecha_hora[11:16] if len(fecha_hora) >= 16 else ""
            r["subtitulo"] = "Recordatorio programado"
            r["destacado"] = False
        return filas

    def crear(self, titulo, fecha_hora, tarea_id=None, evento_id=None):
        return self.bd.ejecutar(
            """INSERT INTO recordatorios (titulo, fecha_hora, tarea_id, evento_id)
               VALUES (%s, %s, %s, %s) RETURNING id, titulo, fecha_hora, enviado""",
            (titulo, fecha_hora, tarea_id, evento_id),
            retornar="one",
        )

    def eliminar(self, recordatorio_id):
        self.bd.ejecutar("DELETE FROM recordatorios WHERE id = %s", (recordatorio_id,), retornar="none")

    def modificar_titulo(self, recordatorio_id, titulo):
        return self.bd.ejecutar(
            "UPDATE recordatorios SET titulo = %s WHERE id = %s RETURNING id, titulo, fecha_hora",
            (titulo.strip(), recordatorio_id),
            retornar="one",
        )


class OrganizacionRepository:
    """Combina Categorías + Eventos para armar la respuesta de
    /api/organizacion/datos, igual que hacía organizacion.py."""

    def __init__(self, categorias: CategoriaRepository, eventos: EventoRepository):
        self.categorias = categorias
        self.eventos = eventos

    def datos_completos(self, anio, mes):
        categorias = self.categorias.listar_con_tareas()
        eventos = self.eventos.listar_mes(anio, mes)
        total_tareas = sum(len(c.get("tareas", [])) for c in categorias)
        return {
            "mes": mes,
            "anio": anio,
            "eventos": eventos,
            "categorias": categorias,
            "estadisticas": {
                "total_eventos": len(eventos),
                "total_tareas": total_tareas,
                "total_categorias": len(categorias),
            },
        }


class PanelResumenRepository:
    """Combina Tareas + Eventos + Recordatorios para el resumen del
    Panel Principal, y da soporte al buscador global."""

    def __init__(self, bd: BaseDeDatos, tareas: TareaRepository, eventos: EventoRepository, recordatorios: RecordatorioPanelRepository):
        self.bd = bd
        self.tareas = tareas
        self.eventos = eventos
        self.recordatorios = recordatorios

    def resumen(self):
        eventos = self.eventos.listar_recientes()
        tareas = self.tareas.listar()
        recordatorios = self.recordatorios.listar()
        pendientes = len([t for t in tareas if t.get("estado") != "completada"])
        completadas = len([t for t in tareas if t.get("estado") == "completada"])
        return {
            "estadisticas": {
                "tareas_pendientes": pendientes,
                "tareas_completadas": completadas,
                "total_eventos": len(eventos),
                "total_recordatorios": len(recordatorios),
            },
            "eventos": eventos,
            "tareas": tareas,
            "recordatorios": recordatorios,
        }

    def buscar(self, q):
        q = (q or "").strip()
        if not q:
            return self.resumen()
        like = f"%{q}%"
        eventos = self.bd.ejecutar(
            "SELECT id, titulo, descripcion, 'evento' AS tipo FROM eventos WHERE titulo ILIKE %s OR descripcion ILIKE %s LIMIT 10",
            (like, like),
        )
        tareas = self.bd.ejecutar(
            "SELECT id, titulo, descripcion, estado, prioridad, 'tarea' AS tipo FROM tareas WHERE titulo ILIKE %s OR descripcion ILIKE %s LIMIT 10",
            (like, like),
        )
        recordatorios = self.bd.ejecutar(
            "SELECT id, titulo, fecha_hora, 'recordatorio' AS tipo FROM recordatorios WHERE titulo ILIKE %s LIMIT 10",
            (like,),
        )
        return {
            "eventos": eventos,
            "tareas": tareas,
            "recordatorios": recordatorios,
            "total_coincidencias": len(eventos) + len(tareas) + len(recordatorios),
        }



    