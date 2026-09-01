"""
Control One - Backend de Perfil
--------------------------------
Maneja las operaciones y consultas de datos específicas para la vista
de Perfil:
  - Login (validación de usuario/contraseña).
  - Perfil (obtener y actualizar nombre completo/alias).
  - Contactos (listar, crear, ocultar/archivar, eliminar).
  - Configuración de correos (obtener y actualizar).

Puede utilizarse como módulo importable o ejecutarse directamente
como servidor API local ligero:
    python backend/Python/perfil.py
"""

import json
import os
import sys
import uuid
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


class PerfilDB:
    """Acceso a datos para Perfil, con soporte para PostgreSQL y
    fallback de datos en memoria si la BD no está configurada."""

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
                print("[Perfil] Conectado a PostgreSQL.")
            except Exception as e:
                print(f"[Perfil] No se pudo conectar a PostgreSQL ({e}). Usando datos de ejemplo.")

        if self.usar_mock:
            self._datos_mock = {
                "usuario": "douglas123",
                "contrasena": "cruz123",
                "nombre_completo": "Pedro Sanchez",
                "alias": "@Alias_guacho",
                "foto_url": None,
            }
            self._contactos_mock = [
                {"id": "c1", "nombre": "Contacto 1", "telefono": "+593 992 2939 322", "oculto": False, "archivado": False},
                {"id": "c2", "nombre": "Contacto 2", "telefono": "+593 987 3834 033", "oculto": False, "archivado": False},
            ]
            self._config_mock = {"correo_notificacion": "tu_correo@gmail.com", "notificar_por_correo": True}

    def _ejecutar(self, sql, params=None, retornar="all"):
        """Ejecuta una consulta y hace commit/rollback automáticamente."""
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

    # ---------------- LOGIN ----------------
    def login(self, usuario, contrasena):
        if self.usar_mock:
            if usuario == self._datos_mock["usuario"] and contrasena == self._datos_mock["contrasena"]:
                return {"usuario": usuario, "nombre_completo": self._datos_mock["nombre_completo"]}
            return None
        fila = self._ejecutar(
            """SELECT usuario, nombre_completo, alias FROM usuarios
               WHERE usuario = %s AND contrasena_hash = crypt(%s, contrasena_hash)""",
            (usuario, contrasena), retornar="one",
        )
        return fila

    # ---------------- PERFIL ----------------
    def obtener_perfil(self):
        if self.usar_mock:
            return {k: v for k, v in self._datos_mock.items() if k != "contrasena"}
        return self._ejecutar(
            "SELECT usuario, nombre_completo, alias, foto_url FROM usuarios LIMIT 1", retornar="one"
        )

    def actualizar_perfil(self, nombre_completo, alias):
        if self.usar_mock:
            self._datos_mock["nombre_completo"] = nombre_completo
            self._datos_mock["alias"] = alias
            return self.obtener_perfil()
        return self._ejecutar(
            """UPDATE usuarios SET nombre_completo = %s, alias = %s
               WHERE id = (SELECT id FROM usuarios LIMIT 1)
               RETURNING usuario, nombre_completo, alias, foto_url""",
            (nombre_completo, alias), retornar="one",
        )

    # ---------------- CONTACTOS ----------------
    def listar_contactos(self, filtro="todos"):
        if self.usar_mock:
            if filtro == "ocultos":
                return [c for c in self._contactos_mock if c["oculto"]]
            if filtro == "archivados":
                return [c for c in self._contactos_mock if c["archivado"]]
            return [c for c in self._contactos_mock if not c["oculto"] and not c["archivado"]]

        if filtro == "ocultos":
            condicion = "WHERE oculto = TRUE"
        elif filtro == "archivados":
            condicion = "WHERE archivado = TRUE"
        else:
            condicion = "WHERE oculto = FALSE AND archivado = FALSE"
        return self._ejecutar(f"SELECT * FROM contactos {condicion} ORDER BY fecha_creacion DESC")

    def crear_contacto(self, nombre, telefono):
        if self.usar_mock:
            nuevo = {"id": str(uuid.uuid4()), "nombre": nombre, "telefono": telefono, "oculto": False, "archivado": False}
            self._contactos_mock.append(nuevo)
            return nuevo
        return self._ejecutar(
            "INSERT INTO contactos (nombre, telefono) VALUES (%s, %s) RETURNING *",
            (nombre, telefono), retornar="one",
        )

    def actualizar_flags_contacto(self, contacto_id, oculto=None, archivado=None):
        if self.usar_mock:
            for c in self._contactos_mock:
                if c["id"] == contacto_id:
                    if oculto is not None:
                        c["oculto"] = oculto
                    if archivado is not None:
                        c["archivado"] = archivado
                    return c
            return None

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
        return self._ejecutar(
            f"UPDATE contactos SET {', '.join(campos)} WHERE id = %s RETURNING *",
            tuple(valores), retornar="one",
        )

    def eliminar_contacto(self, contacto_id):
        if self.usar_mock:
            self._contactos_mock = [c for c in self._contactos_mock if c["id"] != contacto_id]
            return {"eliminado": True}
        self._ejecutar("DELETE FROM contactos WHERE id = %s", (contacto_id,), retornar="none")
        return {"eliminado": True}

    # ---------------- CONFIGURACIÓN DE CORREOS ----------------
    def obtener_configuracion(self):
        if self.usar_mock:
            return self._config_mock
        return self._ejecutar(
            "SELECT correo_notificacion, notificar_por_correo FROM configuracion WHERE id = 1", retornar="one"
        )

    def actualizar_configuracion(self, correo_notificacion, notificar_por_correo):
        if self.usar_mock:
            self._config_mock = {"correo_notificacion": correo_notificacion, "notificar_por_correo": notificar_por_correo}
            return self._config_mock
        return self._ejecutar(
            """UPDATE configuracion SET correo_notificacion = %s, notificar_por_correo = %s
               WHERE id = 1 RETURNING correo_notificacion, notificar_por_correo""",
            (correo_notificacion, notificar_por_correo), retornar="one",
        )


class PerfilAPIHandler(BaseHTTPRequestHandler):
    """Manejador HTTP REST para comunicarse con el frontend de Control One."""
    db = PerfilDB()

    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _leer_json(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        return json.loads(body.decode("utf-8")) if body else {}

    def _responder(self, datos, status=200):
        self._set_headers(status)
        self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode("utf-8"))

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/api/perfil":
            self._responder(self.db.obtener_perfil())
        elif parsed.path == "/api/contactos":
            filtro = params.get("filtro", ["todos"])[0]
            self._responder(self.db.listar_contactos(filtro))
        elif parsed.path == "/api/configuracion":
            self._responder(self.db.obtener_configuracion())
        else:
            self._responder({"error": "Ruta no encontrada"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        data = self._leer_json()

        if parsed.path == "/api/login":
            resultado = self.db.login(data.get("usuario", ""), data.get("contrasena", ""))
            if resultado:
                self._responder(resultado, 200)
            else:
                self._responder({"error": "Usuario o contraseña incorrectos."}, 401)
        elif parsed.path == "/api/contactos":
            nuevo = self.db.crear_contacto(data.get("nombre", ""), data.get("telefono", ""))
            self._responder(nuevo, 201)
        else:
            self._responder({"error": "Endpoint no encontrado"}, 404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        data = self._leer_json()

        if parsed.path == "/api/perfil":
            actualizado = self.db.actualizar_perfil(data.get("nombre_completo", ""), data.get("alias", ""))
            self._responder(actualizado)
        elif parsed.path == "/api/configuracion":
            actualizado = self.db.actualizar_configuracion(
                data.get("correo_notificacion", ""), data.get("notificar_por_correo", True)
            )
            self._responder(actualizado)
        else:
            self._responder({"error": "Endpoint no encontrado"}, 404)

    def do_PATCH(self):
        parsed = urlparse(self.path)
        data = self._leer_json()

        if parsed.path.startswith("/api/contactos/"):
            contacto_id = parsed.path.split("/")[-1]
            actualizado = self.db.actualizar_flags_contacto(
                contacto_id, oculto=data.get("oculto"), archivado=data.get("archivado")
            )
            self._responder(actualizado)
        else:
            self._responder({"error": "Endpoint no encontrado"}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)

        if parsed.path.startswith("/api/contactos/"):
            contacto_id = parsed.path.split("/")[-1]
            self._responder(self.db.eliminar_contacto(contacto_id))
        else:
            self._responder({"error": "Endpoint no encontrado"}, 404)


def iniciar_servidor_api(puerto=8004):
    """Inicia el servidor API local para Perfil."""
    servidor = HTTPServer(("0.0.0.0", puerto), PerfilAPIHandler)
    print("==================================================")
    print("  Control One - API Backend de Perfil")
    print(f"  Servidor activo en: http://localhost:{puerto}/")
    print("  Endpoints disponibles:")
    print("    - POST /api/login")
    print("    - GET  /api/perfil")
    print("    - PUT  /api/perfil")
    print("    - GET  /api/contactos?filtro=todos|ocultos|archivados")
    print("    - POST /api/contactos")
    print("    - PATCH /api/contactos/<id>")
    print("    - DELETE /api/contactos/<id>")
    print("    - GET  /api/configuracion")
    print("    - PUT  /api/configuracion")
    print("==================================================")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido por el usuario.")
        servidor.server_close()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        db = PerfilDB()
        print("Perfil obtenido:")
        print(json.dumps(db.obtener_perfil(), indent=2, cls=SerializadorFecha))
        print("Contactos:")
        print(json.dumps(db.listar_contactos(), indent=2, cls=SerializadorFecha))
    else:
        iniciar_servidor_api(8004)
