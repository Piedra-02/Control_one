"""
Control One - Backend de Panel Principal
-----------------------------------------
Maneja las operaciones y consultas de datos específicas para la vista
del Panel Principal:
  - Resumen y estadísticas para el dashboard.
  - Gestión de Eventos (consulta, creación, eliminación).
  - Gestión de Tareas (consulta, cambio de estado, creación, eliminación).
  - Gestión de Recordatorios (consulta, creación, marcado como completado/enviado).
  - Búsqueda global en tiempo real.

Puede utilizarse como módulo importable o ejecutarse directamente
como servidor API local ligero:
    python backend/Python/panel_principal.py
"""

import json
import os
import sys
from datetime import datetime, date
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Intentar cargar variables de entorno desde .env si existe python-dotenv
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Intentar importar psycopg2 para conexión con PostgreSQL
try:
    import psycopg2
    import psycopg2.extras
    PSYCOPG2_DISPONIBLE = True
except ImportError:
    PSYCOPG2_DISPONIBLE = False


class SerializadorFecha(json.JSONEncoder):
    """Permite serializar fechas y UUIDs a JSON de forma segura."""
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return str(obj)


class PanelPrincipalDB:
    """Acceso a datos para el Panel Principal con soporte para PostgreSQL
    y fallback de datos en memoria si la BD no está configurada.
    """

    def __init__(self):
        self.usar_mock = True
        self.conexion = None

        if PSYCOPG2_DISPONIBLE:
            try:
                self.conexion = psycopg2.connect(
                    host=os.getenv("DB_HOST", "localhost"),
                    dbname=os.getenv("DB_NAME", "control_one"),
                    user=os.getenv("DB_USER", "postgres"),
                    password=os.getenv("DB_PASSWORD", "cruz123"),
                    port=int(os.getenv("DB_PORT", 5432)),
                    connect_timeout=3
                )
                self.usar_mock = False
                print("[INFO] Conectado a PostgreSQL exitosamente.")
            except Exception as e:
                print(f"[AVISO] No se pudo conectar a PostgreSQL ({e}). Operando en modo datos de prueba.")
                self.usar_mock = True
        else:
            print("[AVISO] psycopg2 no está instalado. Operando en modo datos de prueba.")
            self.usar_mock = True

        # Datos de prueba iniciales para funcionamiento fuera de línea
        if self.usar_mock:
            self._init_mock_data()

    def _init_mock_data(self):
        """Inicializa datos de ejemplo fieles al modelo de negocio."""
        self.eventos = [
            {
                "id": "e1",
                "titulo": "Cumpleaños Mamá",
                "descripcion": "Celebración familiar y cena de cumpleaños.",
                "ubicacion": "Casa familiar",
                "fecha_inicio": "2026-08-30T19:00:00",
                "fecha_fin": "2026-08-30T23:00:00",
                "categoria": "Familia",
                "color": "#10b981",
                "estado": "pendiente"
            },
            {
                "id": "e2",
                "titulo": "Revisión de Proyecto Control One",
                "descripcion": "Entrega y revisión de interfaces con el equipo.",
                "ubicacion": "Oficina / Virtual",
                "fecha_inicio": "2026-09-02T10:00:00",
                "fecha_fin": "2026-09-02T12:00:00",
                "categoria": "Trabajo",
                "color": "#3b82f6",
                "estado": "proximo"
            }
        ]

        self.tareas = [
            {
                "id": "t1",
                "titulo": "Hacer las compras del mes",
                "descripcion": "Comprar víveres, artículos de limpieza y despensa general.",
                "estado": "pendiente",
                "prioridad": "alta",
                "fecha_vencimiento": "2026-08-30T18:00:00",
                "categoria": "Hogar"
            },
            {
                "id": "t2",
                "titulo": "Revisar facturas de servicios",
                "descripcion": "Comprobar facturas de luz, agua e internet.",
                "estado": "pendiente",
                "prioridad": "media",
                "fecha_vencimiento": "2026-08-31T20:00:00",
                "categoria": "Finanzas"
            },
            {
                "id": "t3",
                "titulo": "Organizar carpetas de diseño",
                "descripcion": "Ordenar los archivos fuente e ilustraciones en assets.",
                "estado": "completada",
                "prioridad": "baja",
                "fecha_vencimiento": "2026-08-29T16:00:00",
                "categoria": "Diseño"
            },
            {
                "id": "t4",
                "titulo": "Actualizar copia de seguridad",
                "descripcion": "Generar respaldo del esquema de base de datos.",
                "estado": "pendiente",
                "prioridad": "alta",
                "fecha_vencimiento": "2026-09-01T12:00:00",
                "categoria": "Sistema"
            }
        ]

        self.recordatorios = [
            {
                "id": "r1",
                "titulo": "Tomar descanso activo",
                "subtitulo": "Pausa de 5 minutos y estiramientos",
                "fecha_hora": "2026-08-31T18:30:00",
                "hora_formateada": "18:30",
                "destacado": True,
                "enviado": False
            },
            {
                "id": "r2",
                "titulo": "Sincronizar tareas de la semana",
                "subtitulo": "Planificar las actividades del día de mañana",
                "fecha_hora": "2026-08-31T21:00:00",
                "hora_formateada": "21:00",
                "destacado": False,
                "enviado": False
            },
            {
                "id": "r3",
                "titulo": "Regar las plantas del balcón",
                "subtitulo": "Cuidado del jardín",
                "fecha_hora": "2026-09-01T08:00:00",
                "hora_formateada": "08:00",
                "destacado": True,
                "enviado": False
            }
        ]

    # ---------------------------------------------------------
    # EVENTOS
    # ---------------------------------------------------------
    def obtener_eventos(self, limite=10):
        if self.usar_mock:
            return self.eventos[:limite]

        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT e.id, e.titulo, e.descripcion, e.ubicacion, 
                       e.fecha_inicio, e.fecha_fin, c.nombre AS categoria, c.color
                FROM eventos e
                LEFT JOIN categorias c ON e.categoria_id = c.id
                ORDER BY e.fecha_inicio ASC
                LIMIT %s
            """, (limite,))
            return cur.fetchall()

    def crear_evento(self, titulo, descripcion="", ubicacion="", fecha_inicio=None, fecha_fin=None, categoria_id=None):
        if self.usar_mock:
            nuevo = {
                "id": f"e{len(self.eventos) + 1}",
                "titulo": titulo,
                "descripcion": descripcion,
                "ubicacion": ubicacion,
                "fecha_inicio": fecha_inicio or datetime.now().isoformat(),
                "fecha_fin": fecha_fin or datetime.now().isoformat(),
                "categoria": "General",
                "color": "#0ea5e9",
                "estado": "pendiente"
            }
            self.eventos.append(nuevo)
            return nuevo

        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO eventos (titulo, descripcion, ubicacion, fecha_inicio, fecha_fin, categoria_id)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, titulo, descripcion, ubicacion, fecha_inicio, fecha_fin
            """, (titulo, descripcion, ubicacion, fecha_inicio, fecha_fin, categoria_id))
            self.conexion.commit()
            return cur.fetchone()

    # ---------------------------------------------------------
    # TAREAS
    # ---------------------------------------------------------
    def obtener_tareas(self, estado=None, limite=20):
        if self.usar_mock:
            if estado:
                return [t for t in self.tareas if t["estado"] == estado][:limite]
            return self.tareas[:limite]

        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            query = """
                SELECT t.id, t.titulo, t.descripcion, t.estado, t.prioridad, 
                       t.fecha_vencimiento, c.nombre AS categoria, c.color
                FROM tareas t
                LEFT JOIN categorias c ON t.categoria_id = c.id
            """
            params = []
            if estado:
                query += " WHERE t.estado = %s"
                params.append(estado)
            query += " ORDER BY t.fecha_creacion DESC LIMIT %s"
            params.append(limite)

            cur.execute(query, tuple(params))
            return cur.fetchall()

    def cambiar_estado_tarea(self, tarea_id, nuevo_estado):
        if nuevo_estado not in ('pendiente', 'en_progreso', 'completada'):
            raise ValueError(f"Estado no válido: {nuevo_estado}")

        if self.usar_mock:
            for t in self.tareas:
                if str(t["id"]) == str(tarea_id):
                    t["estado"] = nuevo_estado
                    return t
            return None

        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                UPDATE tareas
                SET estado = %s
                WHERE id = %s
                RETURNING id, titulo, estado
            """, (nuevo_estado, tarea_id))
            self.conexion.commit()
            return cur.fetchone()

    def crear_tarea(self, titulo, descripcion="", prioridad="media", fecha_vencimiento=None, categoria_id=None):
        if self.usar_mock:
            nueva = {
                "id": f"t{len(self.tareas) + 1}",
                "titulo": titulo,
                "descripcion": descripcion,
                "estado": "pendiente",
                "prioridad": prioridad,
                "fecha_vencimiento": fecha_vencimiento or datetime.now().isoformat(),
                "categoria": "General"
            }
            self.tareas.insert(0, nueva)
            return nueva

        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO tareas (titulo, descripcion, prioridad, fecha_vencimiento, categoria_id)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, titulo, descripcion, estado, prioridad, fecha_vencimiento
            """, (titulo, descripcion, prioridad, fecha_vencimiento, categoria_id))
            self.conexion.commit()
            return cur.fetchone()

    def eliminar_tarea(self, tarea_id):
        if self.usar_mock:
            self.tareas = [t for t in self.tareas if str(t["id"]) != str(tarea_id)]
            return True

        with self.conexion.cursor() as cur:
            cur.execute("DELETE FROM tareas WHERE id = %s", (tarea_id,))
            self.conexion.commit()
            return True

    # ---------------------------------------------------------
    # RECORDATORIOS
    # ---------------------------------------------------------
    def obtener_recordatorios(self, solo_pendientes=False, limite=10):
        if self.usar_mock:
            if solo_pendientes:
                return [r for r in self.recordatorios if not r.get("enviado", False)][:limite]
            return self.recordatorios[:limite]

        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            query = """
                SELECT r.id, r.titulo, r.fecha_hora, r.enviado, r.tarea_id, r.evento_id
                FROM recordatorios r
            """
            if solo_pendientes:
                query += " WHERE r.enviado = FALSE"
            query += " ORDER BY r.fecha_hora ASC LIMIT %s"

            cur.execute(query, (limite,))
            res = cur.fetchall()
            for r in res:
                if "fecha_hora" in r and r["fecha_hora"]:
                    r["hora_formateada"] = r["fecha_hora"].strftime("%H:%M")
                    r["subtitulo"] = "Recordatorio programado"
                    r["destacado"] = False
            return res

    def crear_recordatorio(self, titulo, fecha_hora, subtitulo="", tarea_id=None, evento_id=None):
        if self.usar_mock:
            nuevo = {
                "id": f"r{len(self.recordatorios) + 1}",
                "titulo": titulo,
                "subtitulo": subtitulo or "Recordatorio personal",
                "fecha_hora": fecha_hora,
                "hora_formateada": fecha_hora.split("T")[1][:5] if "T" in str(fecha_hora) else "12:00",
                "destacado": False,
                "enviado": False
            }
            self.recordatorios.append(nuevo)
            return nuevo

        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO recordatorios (titulo, fecha_hora, tarea_id, evento_id)
                VALUES (%s, %s, %s, %s)
                RETURNING id, titulo, fecha_hora, enviado
            """, (titulo, fecha_hora, tarea_id, evento_id))
            self.conexion.commit()
            return cur.fetchone()

    # ---------------------------------------------------------
    # BÚSQUEDA Y RESUMEN GENERAL
    # ---------------------------------------------------------
    def buscar(self, query):
        """Busca texto en tareas, eventos y recordatorios."""
        q = query.lower().strip()
        if not q:
            return self.obtener_resumen()

        if self.usar_mock:
            eventos_filtrados = [
                e for e in self.eventos 
                if q in e["titulo"].lower() or q in e.get("descripcion", "").lower()
            ]
            tareas_filtradas = [
                t for t in self.tareas 
                if q in t["titulo"].lower() or q in t.get("descripcion", "").lower()
            ]
            recordatorios_filtrados = [
                r for r in self.recordatorios 
                if q in r["titulo"].lower() or q in r.get("subtitulo", "").lower()
            ]
            return {
                "eventos": eventos_filtrados,
                "tareas": tareas_filtradas,
                "recordatorios": recordatorios_filtrados,
                "total_coincidencias": len(eventos_filtrados) + len(tareas_filtradas) + len(recordatorios_filtrados)
            }

        # Búsqueda usando full-text search o ILIKE
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, titulo, descripcion, 'evento' as tipo FROM eventos 
                WHERE titulo ILIKE %s OR descripcion ILIKE %s
                LIMIT 10
            """, (f"%{q}%", f"%{q}%"))
            eventos = cur.fetchall()

            cur.execute("""
                SELECT id, titulo, descripcion, estado, prioridad, 'tarea' as tipo FROM tareas 
                WHERE titulo ILIKE %s OR descripcion ILIKE %s
                LIMIT 10
            """, (f"%{q}%", f"%{q}%"))
            tareas = cur.fetchall()

            cur.execute("""
                SELECT id, titulo, fecha_hora, 'recordatorio' as tipo FROM recordatorios 
                WHERE titulo ILIKE %s
                LIMIT 10
            """, (f"%{q}%",))
            recordatorios = cur.fetchall()

            return {
                "eventos": eventos,
                "tareas": tareas,
                "recordatorios": recordatorios,
                "total_coincidencias": len(eventos) + len(tareas) + len(recordatorios)
            }

    def obtener_resumen(self):
        """Retorna todos los datos listos para alimentar la vista del Panel Principal."""
        eventos = self.obtener_eventos()
        tareas = self.obtener_tareas()
        recordatorios = self.obtener_recordatorios()

        tareas_pendientes = len([t for t in tareas if t.get("estado") != "completada"])
        tareas_completadas = len([t for t in tareas if t.get("estado") == "completada"])

        return {
            "estadisticas": {
                "tareas_pendientes": tareas_pendientes,
                "tareas_completadas": tareas_completadas,
                "total_eventos": len(eventos),
                "total_recordatorios": len(recordatorios),
                "fecha_actual": datetime.now().strftime("%d/%m/%Y")
            },
            "eventos": eventos,
            "tareas": tareas,
            "recordatorios": recordatorios
        }

    def cerrar(self):
        if self.conexion and not self.conexion.closed:
            self.conexion.close()


# =============================================================
# SERVIDOR API HTTP LOCAL (Opcional para conectar con el Frontend)
# =============================================================

class PanelPrincipalAPIHandler(BaseHTTPRequestHandler):
    """Manejador HTTP REST para comunicarse con el frontend de Control One."""
    db = PanelPrincipalDB()

    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/api/panel/resumen":
            datos = self.db.obtener_resumen()
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode("utf-8"))

        elif parsed.path == "/api/panel/eventos":
            datos = self.db.obtener_eventos()
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode("utf-8"))

        elif parsed.path == "/api/panel/tareas":
            estado = params.get("estado", [None])[0]
            datos = self.db.obtener_tareas(estado=estado)
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode("utf-8"))

        elif parsed.path == "/api/panel/recordatorios":
            datos = self.db.obtener_recordatorios()
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode("utf-8"))

        elif parsed.path == "/api/panel/buscar":
            q = params.get("q", [""])[0]
            datos = self.db.buscar(q)
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode("utf-8"))

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Ruta no encontrada"}).encode("utf-8"))

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        data = json.loads(body.decode("utf-8")) if body else {}

        if parsed.path == "/api/panel/tareas":
            nueva = self.db.crear_tarea(
                titulo=data.get("titulo", ""),
                descripcion=data.get("descripcion", ""),
                prioridad=data.get("prioridad", "media"),
                fecha_vencimiento=data.get("fecha_vencimiento")
            )
            self._set_headers(201)
            self.wfile.write(json.dumps(nueva, cls=SerializadorFecha).encode("utf-8"))

        elif parsed.path == "/api/panel/eventos":
            nuevo = self.db.crear_evento(
                titulo=data.get("titulo", ""),
                descripcion=data.get("descripcion", ""),
                ubicacion=data.get("ubicacion", ""),
                fecha_inicio=data.get("fecha_inicio"),
                fecha_fin=data.get("fecha_fin")
            )
            self._set_headers(201)
            self.wfile.write(json.dumps(nuevo, cls=SerializadorFecha).encode("utf-8"))

        elif parsed.path == "/api/panel/recordatorios":
            nuevo = self.db.crear_recordatorio(
                titulo=data.get("titulo", ""),
                fecha_hora=data.get("fecha_hora", datetime.now().isoformat()),
                subtitulo=data.get("subtitulo", "")
            )
            self._set_headers(201)
            self.wfile.write(json.dumps(nuevo, cls=SerializadorFecha).encode("utf-8"))

        elif parsed.path == "/api/panel/tareas/estado":
            tarea_id = data.get("id")
            nuevo_estado = data.get("estado")
            actualizada = self.db.cambiar_estado_tarea(tarea_id, nuevo_estado)
            self._set_headers(200)
            self.wfile.write(json.dumps(actualizada, cls=SerializadorFecha).encode("utf-8"))

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint no encontrado"}).encode("utf-8"))


def iniciar_servidor_api(puerto=8000):
    """Inicia el servidor API local para el panel principal."""
    servidor = HTTPServer(("0.0.0.0", puerto), PanelPrincipalAPIHandler)
    print(f"==================================================")
    print(f"  Control One - API Backend de Panel Principal")
    print(f"  Servidor activo en: http://localhost:{puerto}/")
    print(f"  Endpoints disponibles:")
    print(f"    - GET  /api/panel/resumen")
    print(f"    - GET  /api/panel/eventos")
    print(f"    - GET  /api/panel/tareas")
    print(f"    - GET  /api/panel/recordatorios")
    print(f"    - GET  /api/panel/buscar?q=algo")
    print(f"    - POST /api/panel/tareas/estado")
    print(f"==================================================")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido por el usuario.")
        servidor.server_close()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        db = PanelPrincipalDB()
        print("Resumen obtenido:")
        print(json.dumps(db.obtener_resumen(), indent=2, cls=SerializadorFecha))
    else:
        iniciar_servidor_api(8000)
