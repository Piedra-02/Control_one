"""
Control One - Backend de Información
--------------------------------------
Maneja las operaciones y consultas de datos para la vista de Información:
  - Gestión de Favoritos (consulta, creación, eliminación).
  - Gestión de Historial de Actividades (registro, consulta cronológica, limpieza).
  - Gestión de Suscripciones (consulta, alta, toggle activo/pausado, eliminación).
  - Búsqueda global en tiempo real sobre elementos de información.
  - Soporte de base de datos PostgreSQL y fallback automático en memoria.

Puede utilizarse como módulo importable o ejecutarse directamente:
    python backend/Python/informacion.py
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

# Soporte opcional para PostgreSQL
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


class InformacionDB:
    """Acceso y lógica de datos para la vista de Información."""

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
                print("[INFO] Información conectada a PostgreSQL exitosamente.")
            except Exception as e:
                print(f"[AVISO] No se pudo conectar a PostgreSQL ({e}). Operando en modo datos de prueba.")
                self.usar_mock = True
        else:
            self.usar_mock = True

        if self.usar_mock:
            self._init_mock_data()

    def _init_mock_data(self):
        """Inicializa los datos de prueba fieles a la interfaz mostrada en la captura."""
        
        # 1. FAVORITOS
        self.favoritos = [
            {
                "id": "fav1",
                "titulo": "Cumpleaños de Mama",
                "tipo_elemento": "evento",
                "elemento_id": "e1",
                "fecha_agregado": "2026-08-30T10:00:00"
            },
            {
                "id": "fav2",
                "titulo": "Revision de correo Social de Discord",
                "tipo_elemento": "correo",
                "elemento_id": "c6",
                "fecha_agregado": "2026-08-31T12:00:00"
            },
            {
                "id": "fav3",
                "titulo": "Suscripcion de Disney",
                "tipo_elemento": "suscripcion",
                "elemento_id": "sub2",
                "fecha_agregado": "2026-08-31T14:30:00"
            }
        ]

        # 2. HISTORIAL DE ACTIVIDAD
        self.historial = [
            {
                "id": "h1",
                "hora": "22:01",
                "hora_linea1": "22:",
                "hora_linea2": "01",
                "descripcion": "Suscripcion de netflix",
                "tipo_elemento": "suscripcion",
                "accion": "creado",
                "fecha": "2026-08-31T22:01:00"
            },
            {
                "id": "h2",
                "hora": "22:06",
                "hora_linea1": "22:",
                "hora_linea2": "06",
                "descripcion": "Nuevo favorito agregado",
                "tipo_elemento": "favorito",
                "accion": "creado",
                "fecha": "2026-08-31T22:06:00"
            },
            {
                "id": "h3",
                "hora": "22:12",
                "hora_linea1": "22:",
                "hora_linea2": "12",
                "descripcion": "Recordatorio: Feliz cumpleaños mama",
                "tipo_elemento": "recordatorio",
                "accion": "consultado",
                "fecha": "2026-08-31T22:12:00"
            },
            {
                "id": "h4",
                "hora": "22:33",
                "hora_linea1": "22:",
                "hora_linea2": "33",
                "descripcion": "Revision de correo",
                "tipo_elemento": "correo",
                "accion": "consultado",
                "fecha": "2026-08-31T22:33:00"
            },
            {
                "id": "h5",
                "hora": "22:56",
                "hora_linea1": "22:",
                "hora_linea2": "56",
                "descripcion": "Suscripcion de Disney",
                "tipo_elemento": "suscripcion",
                "accion": "editado",
                "fecha": "2026-08-31T22:56:00"
            }
        ]

        # 3. SUSCRIPCIONES
        self.suscripciones = [
            {
                "id": "sub1",
                "nombre": "Play Station Plus",
                "monto": 9.99,
                "moneda": "USD",
                "activa": True,
                "categoria": "Gaming",
                "metodo_pago": "Tarjeta Visa **** 4242"
            },
            {
                "id": "sub2",
                "nombre": "Directv Go",
                "monto": 14.99,
                "moneda": "USD",
                "activa": True,
                "categoria": "Streaming TV",
                "metodo_pago": "Tarjeta Mastercard **** 8821"
            },
            {
                "id": "sub3",
                "nombre": "DAZN",
                "monto": 19.99,
                "moneda": "USD",
                "activa": True,
                "categoria": "Deportes",
                "metodo_pago": "Tarjeta Visa **** 4242"
            },
            {
                "id": "sub4",
                "nombre": "Spotify",
                "monto": 5.99,
                "moneda": "USD",
                "activa": True,
                "categoria": "Música",
                "metodo_pago": "PayPal"
            },
            {
                "id": "sub5",
                "nombre": "Duolingo Plus",
                "monto": 6.99,
                "moneda": "USD",
                "activa": True,
                "categoria": "Educación",
                "metodo_pago": "Tarjeta Visa **** 4242"
            },
            {
                "id": "sub6",
                "nombre": "Gemini Pro",
                "monto": 19.99,
                "moneda": "USD",
                "activa": True,
                "categoria": "Inteligencia Artificial",
                "metodo_pago": "Google Pay"
            }
        ]

    # =========================================================
    # GESTIÓN DE FAVORITOS
    # =========================================================
    def obtener_favoritos(self):
        if self.usar_mock:
            return self.favoritos

        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT id, tipo_elemento, elemento_id, fecha_agregado FROM favoritos ORDER BY fecha_agregado DESC")
            favs = cur.fetchall()
            for f in favs:
                f["titulo"] = f"Favorito {f.get('tipo_elemento', 'General')}"
            return favs

    def crear_favorito(self, titulo, tipo_elemento="general", elemento_id=None):
        if self.usar_mock:
            nuevo = {
                "id": f"fav_{len(self.favoritos) + 1}_{int(datetime.now().timestamp())}",
                "titulo": titulo.strip(),
                "tipo_elemento": tipo_elemento,
                "elemento_id": elemento_id or f"elem_{int(datetime.now().timestamp())}",
                "fecha_agregado": datetime.now().isoformat()
            }
            self.favoritos.append(nuevo)
            # Registrar en el historial automáticamente
            self.registrar_historial(f"Nuevo favorito: {titulo.strip()}", tipo_elemento="favorito")
            return nuevo

        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO favoritos (tipo_elemento, elemento_id)
                VALUES (%s, %s)
                RETURNING *
            """, (tipo_elemento, elemento_id))
            self.conexion.commit()
            res = cur.fetchone()
            res["titulo"] = titulo
            return res

    def eliminar_favorito(self, favorito_id):
        if self.usar_mock:
            self.favoritos = [f for f in self.favoritos if str(f["id"]) != str(favorito_id)]
            return True

        with self.conexion.cursor() as cur:
            cur.execute("DELETE FROM favoritos WHERE id = %s", (favorito_id,))
            self.conexion.commit()
            return True

    # =========================================================
    # GESTIÓN DE HISTORIAL
    # =========================================================
    def obtener_historial(self, limite=30):
        if self.usar_mock:
            return self.historial[:limite]

        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, tipo_elemento, elemento_id, accion, fecha
                FROM historial
                ORDER BY fecha DESC
                LIMIT %s
            """, (limite,))
            res = cur.fetchall()
            for h in res:
                dt = h["fecha"] if isinstance(h["fecha"], (datetime, date)) else datetime.now()
                h["hora"] = dt.strftime("%H:%M")
                h["hora_linea1"] = f"{dt.strftime('%H')}:"
                h["hora_linea2"] = dt.strftime("%M")
                h["descripcion"] = f"Acción {h.get('accion')} en {h.get('tipo_elemento')}"
            return res

    def registrar_historial(self, descripcion, tipo_elemento="general", accion="creado"):
        dt = datetime.now()
        if self.usar_mock:
            nuevo = {
                "id": f"h_{len(self.historial) + 1}_{int(dt.timestamp())}",
                "hora": dt.strftime("%H:%M"),
                "hora_linea1": f"{dt.strftime('%H')}:",
                "hora_linea2": dt.strftime("%M"),
                "descripcion": descripcion.strip(),
                "tipo_elemento": tipo_elemento,
                "accion": accion,
                "fecha": dt.isoformat()
            }
            self.historial.insert(0, nuevo)
            return nuevo

        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO historial (tipo_elemento, accion)
                VALUES (%s, %s)
                RETURNING *
            """, (tipo_elemento, accion))
            self.conexion.commit()
            return cur.fetchone()

    def limpiar_historial(self):
        if self.usar_mock:
            self.historial = []
            return True

        with self.conexion.cursor() as cur:
            cur.execute("DELETE FROM historial")
            self.conexion.commit()
            return True

    # =========================================================
    # GESTIÓN DE SUSCRIPCIONES
    # =========================================================
    def obtener_suscripciones(self):
        return self.suscripciones

    def crear_suscripcion(self, nombre, monto=9.99, moneda="USD", activa=True, categoria="General"):
        nuevo = {
            "id": f"sub_{len(self.suscripciones) + 1}_{int(datetime.now().timestamp())}",
            "nombre": nombre.strip(),
            "monto": float(monto),
            "moneda": moneda,
            "activa": bool(activa),
            "categoria": categoria,
            "metodo_pago": "Tarjeta de crédito"
        }
        self.suscripciones.append(nuevo)
        self.registrar_historial(f"Suscripcion de {nombre.strip()}", tipo_elemento="suscripcion")
        return nuevo

    def toggle_suscripcion(self, suscripcion_id, activa=None):
        for s in self.suscripciones:
            if str(s["id"]) == str(s_id := suscripcion_id):
                if activa is not None:
                    s["activa"] = bool(activa)
                else:
                    s["activa"] = not s.get("activa", True)
                
                estado_str = "activada" if s["activa"] else "pausada"
                self.registrar_historial(f"Suscripción {s['nombre']} {estado_str}", tipo_elemento="suscripcion", accion="editado")
                return s
        return None

    def eliminar_suscripcion(self, suscripcion_id):
        self.suscripciones = [s for s in self.suscripciones if str(s["id"]) != str(suscripcion_id)]
        return True

    # =========================================================
    # BÚSQUEDA GLOBAL
    # =========================================================
    def buscar(self, query):
        """Busca texto en favoritos, historial y suscripciones."""
        q = query.lower().strip()
        if not q:
            return self.obtener_resumen()

        favoritos_filtrados = [
            f for f in self.favoritos if q in f["titulo"].lower()
        ]
        historial_filtrado = [
            h for h in self.historial if q in h["descripcion"].lower() or q in h["hora"]
        ]
        suscripciones_filtradas = [
            s for s in self.suscripciones if q in s["nombre"].lower() or q in s.get("categoria", "").lower()
        ]

        return {
            "favoritos": favoritos_filtrados,
            "historial": historial_filtrado,
            "suscripciones": suscripciones_filtradas,
            "total": len(favoritos_filtrados) + len(historial_filtrado) + len(suscripciones_filtradas)
        }

    def obtener_resumen(self):
        """Retorna todos los datos listos para alimentar la vista Información."""
        return {
            "favoritos": self.obtener_favoritos(),
            "historial": self.obtener_historial(),
            "suscripciones": self.obtener_suscripciones(),
            "estadisticas": {
                "total_favoritos": len(self.favoritos),
                "total_historial": len(self.historial),
                "total_suscripciones": len(self.suscripciones),
                "suscripciones_activas": len([s for s in self.suscripciones if s.get("activa", True)])
            }
        }

    def cerrar(self):
        if self.conexion and not self.conexion.closed:
            self.conexion.close()


# =============================================================
# SERVIDOR API HTTP LOCAL PARA INFORMACIÓN
# =============================================================

class InformacionAPIHandler(BaseHTTPRequestHandler):
    """Manejador HTTP REST para comunicarse con el frontend de Información."""
    db = InformacionDB()

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

        if parsed.path == "/api/informacion/resumen":
            datos = self.db.obtener_resumen()
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode("utf-8"))

        elif parsed.path == "/api/informacion/favoritos":
            datos = self.db.obtener_favoritos()
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode("utf-8"))

        elif parsed.path == "/api/informacion/historial":
            limite = int(params.get("limite", [30])[0])
            datos = self.db.obtener_historial(limite=limite)
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode("utf-8"))

        elif parsed.path == "/api/informacion/suscripciones":
            datos = self.db.obtener_suscripciones()
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode("utf-8"))

        elif parsed.path == "/api/informacion/buscar":
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

        if parsed.path == "/api/informacion/favoritos":
            nuevo = self.db.crear_favorito(
                titulo=data.get("titulo", ""),
                tipo_elemento=data.get("tipo_elemento", "general"),
                elemento_id=data.get("elemento_id")
            )
            self._set_headers(201)
            self.wfile.write(json.dumps(nuevo, cls=SerializadorFecha).encode("utf-8"))

        elif parsed.path == "/api/informacion/favoritos/eliminar":
            fav_id = data.get("id")
            ok = self.db.eliminar_favorito(fav_id)
            self._set_headers(200)
            self.wfile.write(json.dumps({"success": ok}).encode("utf-8"))

        elif parsed.path == "/api/informacion/suscripciones":
            nueva = self.db.crear_suscripcion(
                nombre=data.get("nombre", ""),
                monto=data.get("monto", 9.99),
                moneda=data.get("moneda", "USD"),
                activa=data.get("activa", True),
                categoria=data.get("categoria", "General")
            )
            self._set_headers(201)
            self.wfile.write(json.dumps(nueva, cls=SerializadorFecha).encode("utf-8"))

        elif parsed.path == "/api/informacion/suscripciones/toggle":
            sub_id = data.get("id")
            activa = data.get("activa")
            resp = self.db.toggle_suscripcion(sub_id, activa)
            self._set_headers(200)
            self.wfile.write(json.dumps(resp or {}, cls=SerializadorFecha).encode("utf-8"))

        elif parsed.path == "/api/informacion/suscripciones/eliminar":
            sub_id = data.get("id")
            ok = self.db.eliminar_suscripcion(sub_id)
            self._set_headers(200)
            self.wfile.write(json.dumps({"success": ok}).encode("utf-8"))

        elif parsed.path == "/api/informacion/historial/limpiar":
            ok = self.db.limpiar_historial()
            self._set_headers(200)
            self.wfile.write(json.dumps({"success": ok}).encode("utf-8"))

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Endpoint no encontrado"}).encode("utf-8"))


def iniciar_servidor_informacion(puerto=8003):
    """Inicia el servidor API local para la vista de información."""
    servidor = HTTPServer(("0.0.0.0", puerto), InformacionAPIHandler)
    print(f"==================================================")
    print(f"  Control One - API Backend de Información")
    print(f"  Servidor activo en: http://localhost:{puerto}/")
    print(f"  Endpoints disponibles:")
    print(f"    - GET  /api/informacion/resumen")
    print(f"    - GET  /api/informacion/favoritos")
    print(f"    - GET  /api/informacion/historial")
    print(f"    - GET  /api/informacion/suscripciones")
    print(f"    - GET  /api/informacion/buscar?q=algo")
    print(f"    - POST /api/informacion/favoritos")
    print(f"    - POST /api/informacion/suscripciones")
    print(f"==================================================")
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido por el usuario.")
        servidor.server_close()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        db = InformacionDB()
        print("[TEST] Resumen de información obtenido con éxito:")
        res = db.obtener_resumen()
        print(f"Total favoritos: {len(res['favoritos'])}")
        print(f"Total historial: {len(res['historial'])}")
        print(f"Total suscripciones: {len(res['suscripciones'])}")
    else:
        iniciar_servidor_informacion(8003)
