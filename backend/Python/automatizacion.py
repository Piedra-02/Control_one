"""
Control One - Backend de Automatización
-----------------------------------------
Maneja las operaciones y consultas de datos específicas para la vista
de Automatización:
  - Crear una automatización (Nombre, Descripción, Regla, Condición).
  - Consultar el Historial de acciones ejecutadas.

Puede utilizarse como módulo importable o ejecutarse directamente
como servidor API local ligero:
    python backend/Python/automatizacion.py
"""

import json
import os
import sys
import uuid
from datetime import datetime, date
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

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


class AutomatizacionDB:
    """Acceso a datos para Automatización, con soporte para PostgreSQL
    y fallback de datos en memoria si la BD no está configurada."""

    TIPOS_REGLA_VALIDOS = {
        "bidireccional",
        "direccional",
        "solo_si_se_cumple_condicion",
        "depurador_detallado",
        "solo_si_no_se_cumple_condicion",
    }

    def __init__(self):
        self.usar_mock = True
        self.conexion = None

        if PSYCOPG2_DISPONIBLE:
            try:
                self.conexion = psycopg2.connect(
                    host=os.getenv("DB_HOST", "localhost"),
                    dbname=os.getenv("DB_NAME", "control_one"),
                    user=os.getenv("DB_USER", "postgres"),
                    password=os.getenv("DB_PASSWORD"),
                    port=int(os.getenv("DB_PORT", 5432)),
                )
                self.usar_mock = False
                print("[Automatización] Conectado a PostgreSQL.")
            except Exception as e:
                print(f"[Automatización] No se pudo conectar a PostgreSQL ({e}). Usando datos de ejemplo.")

        if self.usar_mock:
            self._historial_mock = []

    def _ejecutar(self, sql, params=None, retornar="all"):
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            try:
                cur.execute(sql, params or ())
                resultado = None
                if retornar == "all":
                    resultado = cur.fetchall()
                elif retornar == "one":
                    resultado = cur.fetchone()
                self.conexion.commit()
                return resultado
            except Exception:
                self.conexion.rollback()
                raise

    def crear_automatizacion(self, nombre, descripcion, tipo_regla, condicion):
        if tipo_regla not in self.TIPOS_REGLA_VALIDOS:
            raise ValueError(f"Regla no válida: {tipo_regla}")

        if self.usar_mock:
            nueva = {
                "id": str(uuid.uuid4()),
                "nombre": nombre,
                "descripcion": descripcion,
                "tipo_regla": tipo_regla,
                "condicion": condicion,
                "activa": True,
                "fecha_creacion": datetime.now().isoformat(),
            }
            self._historial_mock.insert(0, {
                "id": str(uuid.uuid4()),
                "titulo": "Tarea Automatizada",
                "automatizacion_nombre": nombre,
                "fecha_ejecucion": datetime.now().isoformat(),
                "estado": "ejecutada",
            })
            return nueva

        automatizacion = self._ejecutar(
            """INSERT INTO automatizaciones (nombre, descripcion, tipo_regla, condicion)
               VALUES (%s, %s, %s, %s) RETURNING *""",
            (nombre, descripcion, tipo_regla, condicion), retornar="one",
        )
        self._ejecutar(
            """INSERT INTO historial_automatizacion (automatizacion_id, titulo, estado)
               VALUES (%s, %s, 'ejecutada')""",
            (automatizacion["id"], "Tarea Automatizada"), retornar="none",
        )
        return automatizacion

    def obtener_historial(self, limite=20):
        if self.usar_mock:
            return self._historial_mock[:limite]
        return self._ejecutar(
            """SELECT h.id, h.titulo, h.fecha_ejecucion, h.estado, a.nombre AS automatizacion_nombre
               FROM historial_automatizacion h
               JOIN automatizaciones a ON a.id = h.automatizacion_id
               ORDER BY h.fecha_ejecucion DESC
               LIMIT %s""",
            (limite,),
        )


class AutomatizacionAPIHandler(BaseHTTPRequestHandler):
    """Manejador HTTP REST para comunicarse con el frontend de Control One."""
    db = AutomatizacionDB()

    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _responder(self, datos, status=200):
        self._set_headers(status)
        self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode("utf-8"))

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/automatizaciones/historial":
            self._responder(self.db.obtener_historial())
        else:
            self._responder({"error": "Ruta no encontrada"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        data = json.loads(body.decode("utf-8")) if body else {}

        if parsed.path == "/api/automatizaciones":
            nombre = (data.get("nombre") or "").strip()
            if not nombre:
                self._responder({"error": "El nombre es obligatorio."}, 400)
                return
            try:
                nueva = self.db.crear_automatizacion(
                    nombre=nombre,
                    descripcion=data.get("descripcion", ""),
                    tipo_regla=data.get("tipo_regla", ""),
                    condicion=data.get("condicion", ""),
                )
                self._responder(nueva, 201)
            except ValueError as e:
                self._responder({"error": str(e)}, 400)
        else:
            self._responder({"error": "Endpoint no encontrado"}, 404)


def iniciar_servidor_api(puerto=8005):
    """Inicia el servidor API local para Automatización."""
    servidor = HTTPServer(("0.0.0.0", puerto), AutomatizacionAPIHandler)
    print("==================================================")
    print("  Control One - API Backend de Automatización")
    print(f"  Servidor activo en: http://localhost:{puerto}/")
    print("  Endpoints disponibles:")
    print("    - POST /api/automatizaciones")
    print("    - GET  /api/automatizaciones/historial")
    print("==================================================")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido por el usuario.")
        servidor.server_close()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        db = AutomatizacionDB()
        print("Creando automatización de prueba:")
        print(json.dumps(
            db.crear_automatizacion("Prueba", "Descripción de prueba", "direccional", "Sin condición"),
            indent=2, cls=SerializadorFecha
        ))
        print("Historial:")
        print(json.dumps(db.obtener_historial(), indent=2, cls=SerializadorFecha))
    else:
        iniciar_servidor_api(8005)
