import json
import os
import sys
from datetime import datetime, date
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass
try:
    import psycopg2
    import psycopg2.extras
    PSYCOPG2_DISPONIBLE = True
except ImportError:
    PSYCOPG2_DISPONIBLE = False

class SerializadorFecha(json.JSONEncoder):

    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return str(obj)

class OrganizacionDB:

    def __init__(self):
        self.usar_mock = True
        self.conexion = None
        if PSYCOPG2_DISPONIBLE:
            try:
                self.conexion = psycopg2.connect(host=os.getenv('DB_HOST', 'localhost'), dbname=os.getenv('DB_NAME', 'control_one'), user=os.getenv('DB_USER', 'postgres'), password=os.getenv('DB_PASSWORD', 'cruz123'), port=int(os.getenv('DB_PORT', 5432)), connect_timeout=3)
                self.usar_mock = False
                print('[INFO] Organización conectada a PostgreSQL.')
            except Exception as e:
                print(f'[AVISO] PostgreSQL no disponible ({e}). Operando en memoria.')
                self.usar_mock = True
        else:
            self.usar_mock = True
        if self.usar_mock:
            self._init_mock_data()

    def _init_mock_data(self):
        self.eventos = [{'id': 'e1', 'titulo': 'Cumpleaños Mama', 'descripcion': 'hoy es el cumpleaños de tu Mama', 'ubicacion': 'Casa familiar', 'fecha': '2026-08-30', 'fecha_inicio': '2026-08-30T19:00:00', 'fecha_fin': '2026-08-30T23:00:00', 'categoria': 'Familia', 'color': '#00bcd4'}]
        self.categorias = [{'id': 'cat1', 'nombre': 'IMPORTANTE', 'color': '#00bcd4'}, {'id': 'cat2', 'nombre': 'OBLIGATORIO', 'color': '#00bcd4'}, {'id': 'cat3', 'nombre': 'UNIVERSIDAD', 'color': '#00bcd4'}, {'id': 'cat4', 'nombre': 'PROYECTO INTEGRADOR', 'color': '#00bcd4'}, {'id': 'cat5', 'nombre': 'NO IMPORTANTE', 'color': '#00bcd4'}]
        self.tareas = [{'id': 't1', 'titulo': 'Hacer las compras del mes', 'categoria_id': 'cat1', 'prioridad': 'alta'}, {'id': 't2', 'titulo': 'Hablar al licenciado de Filosofía', 'categoria_id': 'cat1', 'prioridad': 'media'}, {'id': 't3', 'titulo': 'Acabar el proyecto integrador', 'categoria_id': 'cat1', 'prioridad': 'alta'}, {'id': 't4', 'titulo': 'Limpiar la casa', 'categoria_id': 'cat2', 'prioridad': 'media'}, {'id': 't5', 'titulo': 'Ir a entregar el pedido', 'categoria_id': 'cat2', 'prioridad': 'baja'}, {'id': 't6', 'titulo': 'Terminar de Decorar la Habitacion', 'categoria_id': 'cat2', 'prioridad': 'baja'}, {'id': 't7', 'titulo': 'Estudiar para el examen de cálculo', 'categoria_id': 'cat3', 'prioridad': 'alta'}, {'id': 't8', 'titulo': 'Diseñar mockups de interfaz', 'categoria_id': 'cat4', 'prioridad': 'media'}]

    def obtener_categorias(self):
        if self.usar_mock:
            resultado = []
            for cat in self.categorias:
                tareas_cat = [t for t in self.tareas if t.get('categoria_id') == cat['id']]
                resultado.append({'id': cat['id'], 'nombre': cat['nombre'], 'color': cat.get('color', '#00bcd4'), 'tareas': tareas_cat})
            return resultado
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('SELECT id, nombre, color FROM categorias ORDER BY nombre ASC')
            cats = cur.fetchall()
            for c in cats:
                cur.execute('SELECT id, titulo, prioridad, estado FROM tareas WHERE categoria_id = %s', (c['id'],))
                c['tareas'] = cur.fetchall()
            return cats

    def crear_categoria(self, nombre, color='#00bcd4'):
        nombre_upper = nombre.strip().upper()
        if self.usar_mock:
            nuevo_id = f'cat_{len(self.categorias) + 1}'
            nueva = {'id': nuevo_id, 'nombre': nombre_upper, 'color': color, 'tareas': []}
            self.categorias.append(nueva)
            return nueva
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('\n                INSERT INTO categorias (nombre, color)\n                VALUES (%s, %s)\n                RETURNING id, nombre, color\n            ', (nombre_upper, color))
            self.conexion.commit()
            res = cur.fetchone()
            res['tareas'] = []
            return res

    def modificar_categoria(self, categoria_id, nuevo_nombre):
        nuevo_nombre = nuevo_nombre.strip().upper()
        if self.usar_mock:
            for cat in self.categorias:
                if cat['id'] == categoria_id:
                    cat['nombre'] = nuevo_nombre
                    return cat
            return None
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('\n                UPDATE categorias\n                SET nombre = %s\n                WHERE id = %s\n                RETURNING id, nombre, color\n            ', (nuevo_nombre, categoria_id))
            self.conexion.commit()
            return cur.fetchone()

    def eliminar_categoria(self, categoria_id):
        if self.usar_mock:
            self.categorias = [c for c in self.categorias if c['id'] != categoria_id]
            for t in self.tareas:
                if t.get('categoria_id') == categoria_id:
                    t['categoria_id'] = None
            return True
        with self.conexion.cursor() as cur:
            cur.execute('UPDATE tareas SET categoria_id = NULL WHERE categoria_id = %s', (categoria_id,))
            cur.execute('DELETE FROM categorias WHERE id = %s', (categoria_id,))
            self.conexion.commit()
            return True

    def asignar_tarea_categoria(self, tarea_id, categoria_id):
        if self.usar_mock:
            for t in self.tareas:
                if str(t['id']) == str(tarea_id):
                    t['categoria_id'] = categoria_id
                    return t
            return None
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('\n                UPDATE tareas\n                SET categoria_id = %s\n                WHERE id = %s\n                RETURNING id, titulo, categoria_id\n            ', (categoria_id, tarea_id))
            self.conexion.commit()
            return cur.fetchone()

    def crear_tarea_en_categoria(self, titulo, categoria_id, prioridad='media'):
        if self.usar_mock:
            nueva = {'id': f't_{len(self.tareas) + 1}', 'titulo': titulo.strip(), 'categoria_id': categoria_id, 'prioridad': prioridad, 'estado': 'pendiente'}
            self.tareas.append(nueva)
            return nueva
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('\n                INSERT INTO tareas (titulo, categoria_id, prioridad)\n                VALUES (%s, %s, %s)\n                RETURNING id, titulo, categoria_id, prioridad, estado\n            ', (titulo.strip(), categoria_id, prioridad))
            self.conexion.commit()
            return cur.fetchone()

    def obtener_eventos_mes(self, anio=2026, mes=8):
        if self.usar_mock:
            prefijo = f'{anio}-{mes:02d}'
            return [e for e in self.eventos if e['fecha'].startswith(prefijo)]
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('\n                SELECT id, titulo, descripcion, ubicacion, \n                       fecha_inicio::date as fecha, fecha_inicio, fecha_fin\n                FROM eventos\n                WHERE EXTRACT(YEAR FROM fecha_inicio) = %s AND EXTRACT(MONTH FROM fecha_inicio) = %s\n                ORDER BY fecha_inicio ASC\n            ', (anio, mes))
            return cur.fetchall()

    def guardar_evento(self, evento_data):
        evento_id = evento_data.get('id')
        titulo = evento_data.get('titulo', 'Nuevo Evento')
        descripcion = evento_data.get('descripcion', '')
        fecha = evento_data.get('fecha', datetime.now().strftime('%Y-%m-%d'))
        ubicacion = evento_data.get('ubicacion', '')
        if self.usar_mock:
            if evento_id:
                for e in self.eventos:
                    if str(e['id']) == str(evento_id):
                        e.update({'titulo': titulo, 'descripcion': descripcion, 'fecha': fecha, 'ubicacion': ubicacion})
                        return e
            nuevo = {'id': f'e{len(self.eventos) + 1}', 'titulo': titulo, 'descripcion': descripcion, 'ubicacion': ubicacion, 'fecha': fecha, 'fecha_inicio': f'{fecha}T10:00:00', 'fecha_fin': f'{fecha}T12:00:00', 'categoria': 'General', 'color': '#00bcd4'}
            self.eventos.append(nuevo)
            return nuevo
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if evento_id:
                cur.execute('\n                    UPDATE eventos\n                    SET titulo = %s, descripcion = %s, ubicacion = %s, fecha_inicio = %s, fecha_fin = %s\n                    WHERE id = %s\n                    RETURNING id, titulo, descripcion, ubicacion, fecha_inicio::date as fecha\n                ', (titulo, descripcion, ubicacion, f'{fecha} 10:00:00', f'{fecha} 12:00:00', evento_id))
            else:
                cur.execute('\n                    INSERT INTO eventos (titulo, descripcion, ubicacion, fecha_inicio, fecha_fin)\n                    VALUES (%s, %s, %s, %s, %s)\n                    RETURNING id, titulo, descripcion, ubicacion, fecha_inicio::date as fecha\n                ', (titulo, descripcion, ubicacion, f'{fecha} 10:00:00', f'{fecha} 12:00:00'))
            self.conexion.commit()
            return cur.fetchone()

    def eliminar_evento(self, evento_id):
        if self.usar_mock:
            self.eventos = [e for e in self.eventos if str(e['id']) != str(evento_id)]
            return True
        with self.conexion.cursor() as cur:
            cur.execute('DELETE FROM eventos WHERE id = %s', (evento_id,))
            self.conexion.commit()
            return True

    def obtener_todo_organizacion(self, anio=2026, mes=8):
        return {'mes': mes, 'anio': anio, 'nombre_mes': 'agosto de 2026', 'eventos': self.obtener_eventos_mes(anio, mes), 'categorias': self.obtener_categorias(), 'estadisticas': {'puntos_grafico': [20, 25, 80, 45, 10, 50, 50], 'total_eventos': len(self.eventos), 'total_tareas': len(self.tareas), 'total_categorias': len(self.categorias)}}

class OrganizacionAPIHandler(BaseHTTPRequestHandler):
    db = OrganizacionDB()

    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)
        if parsed.path == '/api/organizacion/datos':
            anio = int(params.get('anio', [2026])[0])
            mes = int(params.get('mes', [8])[0])
            datos = self.db.obtener_todo_organizacion(anio, mes)
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode('utf-8'))
        elif parsed.path == '/api/organizacion/categorias':
            datos = self.db.obtener_categorias()
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode('utf-8'))
        elif parsed.path == '/api/organizacion/eventos':
            anio = int(params.get('anio', [2026])[0])
            mes = int(params.get('mes', [8])[0])
            datos = self.db.obtener_eventos_mes(anio, mes)
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode('utf-8'))
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Ruta no encontrada'}).encode('utf-8'))

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        data = json.loads(body.decode('utf-8')) if body else {}
        if parsed.path == '/api/organizacion/categorias':
            cat_id = data.get('id')
            nombre = data.get('nombre')
            if cat_id:
                res = self.db.modificar_categoria(cat_id, nombre)
            else:
                res = self.db.crear_categoria(nombre)
            self._set_headers(200)
            self.wfile.write(json.dumps(res, cls=SerializadorFecha).encode('utf-8'))
        elif parsed.path == '/api/organizacion/categorias/eliminar':
            cat_id = data.get('id')
            ok = self.db.eliminar_categoria(cat_id)
            self._set_headers(200)
            self.wfile.write(json.dumps({'success': ok}).encode('utf-8'))
        elif parsed.path == '/api/organizacion/tareas':
            titulo = data.get('titulo')
            cat_id = data.get('categoria_id')
            res = self.db.crear_tarea_en_categoria(titulo, cat_id)
            self._set_headers(200)
            self.wfile.write(json.dumps(res, cls=SerializadorFecha).encode('utf-8'))
        elif parsed.path == '/api/organizacion/eventos':
            evento = self.db.guardar_evento(data)
            self._set_headers(200)
            self.wfile.write(json.dumps(evento, cls=SerializadorFecha).encode('utf-8'))
        elif parsed.path == '/api/organizacion/eventos/eliminar':
            evento_id = data.get('id')
            ok = self.db.eliminar_evento(evento_id)
            self._set_headers(200)
            self.wfile.write(json.dumps({'success': ok}).encode('utf-8'))
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Endpoint no encontrado'}).encode('utf-8'))

def iniciar_servidor(puerto=8001):
    servidor = HTTPServer(('0.0.0.0', puerto), OrganizacionAPIHandler)
    print(f'Control One - API Backend de Organización activa en http://localhost:{puerto}/')
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        servidor.server_close()
if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        db = OrganizacionDB()
        print('Datos de Organización y Categorías:')
        print(json.dumps(db.obtener_todo_organizacion(), indent=2, cls=SerializadorFecha))
    else:
        iniciar_servidor(8001)