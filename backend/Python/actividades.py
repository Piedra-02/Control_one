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

class ActividadesDB:

    def __init__(self):
        self.usar_mock = True
        self.conexion = None
        if PSYCOPG2_DISPONIBLE:
            try:
                self.conexion = psycopg2.connect(host=os.getenv('DB_HOST', 'localhost'), dbname=os.getenv('DB_NAME', 'control_one'), user=os.getenv('DB_USER', 'postgres'), password=os.getenv('DB_PASSWORD', 'cruz123'), port=int(os.getenv('DB_PORT', 5432)), connect_timeout=3)
                self.usar_mock = False
                print('[INFO] Actividades conectada a PostgreSQL exitosamente.')
            except Exception as e:
                print(f'[AVISO] No se pudo conectar a PostgreSQL ({e}). Operando en modo datos de prueba.')
                self.usar_mock = True
        else:
            self.usar_mock = True
        if self.usar_mock:
            self._init_mock_data()

    def _init_mock_data(self):
        self.correos = [{'id': 'c1', 'remitente': 'Equipos de Gmail', 'email_remitente': 'mail-noreply@google.com', 'destinatario': 'usuario@controlone.app', 'asunto': 'Organízate mejor con la bandeja', 'cuerpo': 'Hola. Descubre las herramientas de organización para clasificar tus correos por categorías y prioridades.', 'fecha': '2026-08-31T10:15:00', 'leido': False, 'destacado': True, 'categoria': 'principal'}, {'id': 'c2', 'remitente': 'Equipos de Gmail', 'email_remitente': 'mail-noreply@google.com', 'destinatario': 'usuario@controlone.app', 'asunto': 'Lo mejor de Gmail', 'cuerpo': 'Conoce los atajos de teclado y la búsqueda avanzada para encontrar cualquier mensaje en segundos.', 'fecha': '2026-08-30T16:20:00', 'leido': False, 'destacado': True, 'categoria': 'principal'}, {'id': 'c3', 'remitente': 'Equipos de Gmail', 'email_remitente': 'mail-noreply@google.com', 'destinatario': 'usuario@controlone.app', 'asunto': 'Consejos para usar el correo', 'cuerpo': 'Aprovecha al máximo el espacio de almacenamiento y la sincronización en todos tus dispositivos.', 'fecha': '2026-08-29T11:45:00', 'leido': False, 'destacado': False, 'categoria': 'principal'}, {'id': 'c4', 'remitente': 'Equipos de Gmail', 'email_remitente': 'mail-noreply@google.com', 'destinatario': 'usuario@controlone.app', 'asunto': 'Consejos para usar el correo', 'cuerpo': 'Crea filtros automáticos y etiquetas personalizadas para no perderte ningún mensaje importante.', 'fecha': '2026-08-28T09:00:00', 'leido': True, 'destacado': False, 'categoria': 'principal'}, {'id': 'c5', 'remitente': 'Equipos de Gmail', 'email_remitente': 'mail-noreply@google.com', 'destinatario': 'usuario@controlone.app', 'asunto': 'Consejos para usar el correo', 'cuerpo': 'Activa la verificación en dos pasos para proteger la seguridad de tu cuenta.', 'fecha': '2026-08-27T14:30:00', 'leido': True, 'destacado': False, 'categoria': 'principal'}, {'id': 'c6', 'remitente': 'Equipos de Gmail', 'email_remitente': 'mail-noreply@google.com', 'destinatario': 'usuario@controlone.app', 'asunto': 'Consejos para usar el correo', 'cuerpo': 'Gestiona tus firmas electrónicas y respuestas automáticas de vacaciones.', 'fecha': '2026-08-26T18:10:00', 'leido': True, 'destacado': False, 'categoria': 'social'}, {'id': 'c7', 'remitente': 'Equipos de Gmail', 'email_remitente': 'mail-noreply@google.com', 'destinatario': 'usuario@controlone.app', 'asunto': 'Consejos para usar el correo', 'cuerpo': 'Aprende a programar el envío de correos en la fecha y hora que prefieras.', 'fecha': '2026-08-25T08:00:00', 'leido': True, 'destacado': False, 'categoria': 'promociones'}]
        self.carpetas = [{'id': 'f_downloads', 'nombre': 'Downloads', 'icono': 'download', 'descripcion': 'Descargas recientes del navegador', 'archivos': [{'id': 'doc1', 'nombre': 'Instalador_Control_One.exe', 'tamano': '45.2 MB', 'tipo': 'exe', 'fecha': '2026-08-31'}, {'id': 'doc2', 'nombre': 'Reporte_Mensual_Agosto.pdf', 'tamano': '2.4 MB', 'tipo': 'pdf', 'fecha': '2026-08-30'}]}, {'id': 'f_usuario', 'nombre': 'Usuario', 'icono': 'user', 'descripcion': 'Archivos del perfil de usuario', 'archivos': [{'id': 'doc3', 'nombre': 'perfil_avatar.png', 'tamano': '1.1 MB', 'tipo': 'png', 'fecha': '2026-08-28'}, {'id': 'doc4', 'nombre': 'configuracion_personal.json', 'tamano': '14 KB', 'tipo': 'json', 'fecha': '2026-08-29'}]}, {'id': 'f_documentos', 'nombre': 'Documentos', 'icono': 'file-text', 'descripcion': 'Documentos de texto, hojas de cálculo y proyectos', 'archivos': [{'id': 'doc5', 'nombre': 'Especificaciones_Control_One.docx', 'tamano': '1.8 MB', 'tipo': 'docx', 'fecha': '2026-08-31'}, {'id': 'doc6', 'nombre': 'Presupuesto_2026.xlsx', 'tamano': '850 KB', 'tipo': 'xlsx', 'fecha': '2026-08-25'}, {'id': 'doc7', 'nombre': 'Bitacora_Actividades.txt', 'tamano': '42 KB', 'tipo': 'txt', 'fecha': '2026-08-31'}]}, {'id': 'f_videos', 'nombre': 'Videos', 'icono': 'video', 'descripcion': 'Grabaciones y material multimedia en video', 'archivos': [{'id': 'doc8', 'nombre': 'Demo_Interactivo.mp4', 'tamano': '120.5 MB', 'tipo': 'mp4', 'fecha': '2026-08-29'}]}, {'id': 'f_imagenes', 'nombre': 'Imagenes', 'icono': 'image', 'descripcion': 'Capturas, fotos e ilustraciones de diseño', 'archivos': [{'id': 'doc9', 'nombre': 'Mockup_Actividades.png', 'tamano': '3.5 MB', 'tipo': 'png', 'fecha': '2026-08-31'}, {'id': 'doc10', 'nombre': 'Logo_Vectorial.svg', 'tamano': '120 KB', 'tipo': 'svg', 'fecha': '2026-08-20'}]}, {'id': 'f_musica', 'nombre': 'Musica', 'icono': 'music', 'descripcion': 'Pistas de audio y efectos sonoros', 'archivos': [{'id': 'doc11', 'nombre': 'Notificacion_Sonido.mp3', 'tamano': '340 KB', 'tipo': 'mp3', 'fecha': '2026-08-15'}]}, {'id': 'f_papelera', 'nombre': 'Papelera', 'icono': 'trash-2', 'descripcion': 'Elementos eliminados temporalmente', 'archivos': [{'id': 'doc12', 'nombre': 'Borrador_Antiguo.txt', 'tamano': '12 KB', 'tipo': 'txt', 'fecha': '2026-08-24'}]}, {'id': 'f_escritorio', 'nombre': 'Escritorio', 'icono': 'home', 'descripcion': 'Accesos directos y archivos del escritorio', 'archivos': [{'id': 'doc13', 'nombre': 'Acceso_Control_One.lnk', 'tamano': '4 KB', 'tipo': 'lnk', 'fecha': '2026-08-31'}]}, {'id': 'f_programas', 'nombre': 'Programas x32', 'icono': 'cpu', 'descripcion': 'Software y binarios del sistema de 32 bits', 'archivos': [{'id': 'doc14', 'nombre': 'ControlOne_Engine.dll', 'tamano': '8.4 MB', 'tipo': 'dll', 'fecha': '2026-08-30'}]}, {'id': 'f_tmp', 'nombre': 'Tmp', 'icono': 'clock', 'descripcion': 'Archivos y cachés temporales de ejecución', 'archivos': [{'id': 'doc15', 'nombre': 'session_cache.tmp', 'tamano': '64 KB', 'tipo': 'tmp', 'fecha': '2026-08-31'}]}]
        self.notas = [{'id': 'n1', 'titulo': 'Título de la nota', 'contenido': 'contenido de la nota', 'fecha_actualizacion': '2026-08-31T20:00:00'}]

    def obtener_correos(self, categoria=None, limite=30):
        if self.usar_mock:
            if categoria and categoria != 'todos':
                return [c for c in self.correos if c.get('categoria') == categoria][:limite]
            return self.correos[:limite]
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('\n                SELECT id, remitente, destinatario, asunto, cuerpo, fecha, leido, destacado, categoria\n                FROM correos\n                ORDER BY fecha DESC\n                LIMIT %s\n            ', (limite,))
            return cur.fetchall()

    def obtener_correo_por_id(self, correo_id):
        if self.usar_mock:
            for c in self.correos:
                if str(c['id']) == str(correo_id):
                    return c
            return None
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('SELECT * FROM correos WHERE id = %s', (correo_id,))
            return cur.fetchone()

    def crear_correo(self, destinatario, asunto, cuerpo='', remitente='Equipos de Gmail', categoria='principal'):
        if self.usar_mock:
            nuevo = {'id': f'c_{len(self.correos) + 1}_{int(datetime.now().timestamp())}', 'remitente': remitente, 'email_remitente': 'usuario@controlone.app', 'destinatario': destinatario, 'asunto': asunto.strip() or '(Sin Asunto)', 'cuerpo': cuerpo.strip(), 'fecha': datetime.now().isoformat(), 'leido': True, 'destacado': False, 'categoria': categoria}
            self.correos.insert(0, nuevo)
            return nuevo
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('\n                INSERT INTO correos (remitente, destinatario, asunto, cuerpo, categoria)\n                VALUES (%s, %s, %s, %s, %s)\n                RETURNING *\n            ', (remitente, destinatario, asunto, cuerpo, categoria))
            self.conexion.commit()
            return cur.fetchone()

    def toggle_destacado_correo(self, correo_id, destacado=None):
        if self.usar_mock:
            for c in self.correos:
                if str(c['id']) == str(correo_id):
                    if destacado is not None:
                        c['destacado'] = bool(destacado)
                    else:
                        c['destacado'] = not c.get('destacado', False)
                    return c
            return None

    def toggle_leido_correo(self, correo_id, leido=None):
        if self.usar_mock:
            for c in self.correos:
                if str(c['id']) == str(correo_id):
                    if leido is not None:
                        c['leido'] = bool(leido)
                    else:
                        c['leido'] = not c.get('leido', False)
                    return c
            return None

    def eliminar_correo(self, correo_id):
        if self.usar_mock:
            self.correos = [c for c in self.correos if str(c['id']) != str(correo_id)]
            return True

    def obtener_carpetas(self):
        if self.usar_mock:
            return self.carpetas
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('SELECT id, nombre, url, tipo, tamano_bytes, fecha_subida FROM archivos')
            return cur.fetchall()

    def obtener_archivos_carpeta(self, carpeta_id):
        if self.usar_mock:
            for f in self.carpetas:
                if f['id'] == carpeta_id or f['nombre'].lower() == carpeta_id.lower():
                    return f
            return None

    def agregar_archivo_carpeta(self, carpeta_id, nombre, tamano='1.2 MB', tipo='txt'):
        if self.usar_mock:
            for f in self.carpetas:
                if f['id'] == carpeta_id or f['nombre'].lower() == carpeta_id.lower():
                    nuevo = {'id': f"doc_{len(f['archivos']) + 1}_{int(datetime.now().timestamp())}", 'nombre': nombre.strip(), 'tamano': tamano, 'tipo': tipo, 'fecha': datetime.now().strftime('%Y-%m-%d')}
                    f['archivos'].insert(0, nuevo)
                    return nuevo
            return None

    def eliminar_archivo(self, carpeta_id, archivo_id):
        if self.usar_mock:
            for f in self.carpetas:
                if f['id'] == carpeta_id or f['nombre'].lower() == carpeta_id.lower():
                    f['archivos'] = [a for a in f['archivos'] if str(a['id']) != str(archivo_id)]
                    return True
            return False

    def obtener_notas(self):
        if self.usar_mock:
            return self.notas
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('SELECT id, titulo, contenido, fecha_actualizacion FROM notas ORDER BY fecha_actualizacion DESC')
            return cur.fetchall()

    def obtener_nota(self, nota_id='n1'):
        if self.usar_mock:
            for n in self.notas:
                if str(n['id']) == str(nota_id):
                    return n
            if self.notas:
                return self.notas[0]
            return {'id': 'n1', 'titulo': 'Título de la nota', 'contenido': 'contenido de la nota'}
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('SELECT id, titulo, contenido, fecha_actualizacion FROM notas WHERE id = %s', (nota_id,))
            return cur.fetchone()

    def guardar_nota(self, nota_id='n1', titulo='Título de la nota', contenido='contenido de la nota'):
        if self.usar_mock:
            for n in self.notas:
                if str(n['id']) == str(nota_id):
                    n['titulo'] = titulo
                    n['contenido'] = contenido
                    n['fecha_actualizacion'] = datetime.now().isoformat()
                    return n
            nueva = {'id': nota_id or f'n_{len(self.notas) + 1}', 'titulo': titulo, 'contenido': contenido, 'fecha_actualizacion': datetime.now().isoformat()}
            self.notas.append(nueva)
            return nueva
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('\n                INSERT INTO notas (id, titulo, contenido, fecha_actualizacion)\n                VALUES (%s, %s, %s, now())\n                ON CONFLICT (id) DO UPDATE \n                SET titulo = EXCLUDED.titulo, contenido = EXCLUDED.contenido, fecha_actualizacion = now()\n                RETURNING *\n            ', (nota_id, titulo, contenido))
            self.conexion.commit()
            return cur.fetchone()

    def eliminar_nota(self, nota_id):
        if self.usar_mock:
            self.notas = [n for n in self.notas if str(n['id']) != str(nota_id)]
            return True
        with self.conexion.cursor() as cur:
            cur.execute('DELETE FROM notas WHERE id = %s', (nota_id,))
            self.conexion.commit()
            return True

    def buscar(self, query):
        q = query.lower().strip()
        if not q:
            return self.obtener_resumen()
        if self.usar_mock:
            correos_filtrados = [c for c in self.correos if q in c['remitente'].lower() or q in c['asunto'].lower() or q in c.get('cuerpo', '').lower()]
            carpetas_filtradas = []
            for carp in self.carpetas:
                if q in carp['nombre'].lower() or q in carp.get('descripcion', '').lower():
                    carpetas_filtradas.append(carp)
                else:
                    archivos_match = [a for a in carp.get('archivos', []) if q in a['nombre'].lower()]
                    if archivos_match:
                        carp_copia = dict(carp)
                        carp_copia['archivos'] = archivos_match
                        carpetas_filtradas.append(carp_copia)
            notas_filtradas = [n for n in self.notas if q in n['titulo'].lower() or q in n.get('contenido', '').lower()]
            return {'correos': correos_filtrados, 'carpetas': carpetas_filtradas, 'notas': notas_filtradas, 'total': len(correos_filtrados) + len(carpetas_filtradas) + len(notas_filtradas)}

    def obtener_resumen(self):
        return {'correos': self.obtener_correos(), 'carpetas': self.obtener_carpetas(), 'nota_actual': self.obtener_nota('n1'), 'todas_las_notas': self.obtener_notas(), 'estadisticas': {'total_correos': len(self.correos), 'correos_no_leidos': len([c for c in self.correos if not c.get('leido', False)]), 'total_carpetas': len(self.carpetas), 'total_archivos': sum((len(c.get('archivos', [])) for c in self.carpetas)), 'total_notas': len(self.notas)}}

    def cerrar(self):
        if self.conexion and (not self.conexion.closed):
            self.conexion.close()

class ActividadesAPIHandler(BaseHTTPRequestHandler):
    db = ActividadesDB()

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
        if parsed.path == '/api/actividades/resumen':
            datos = self.db.obtener_resumen()
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode('utf-8'))
        elif parsed.path == '/api/actividades/correos':
            cat = params.get('categoria', [None])[0]
            datos = self.db.obtener_correos(categoria=cat)
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode('utf-8'))
        elif parsed.path == '/api/actividades/carpetas':
            datos = self.db.obtener_carpetas()
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode('utf-8'))
        elif parsed.path == '/api/actividades/notas':
            nota_id = params.get('id', ['n1'])[0]
            datos = self.db.obtener_nota(nota_id)
            self._set_headers(200)
            self.wfile.write(json.dumps(datos, cls=SerializadorFecha).encode('utf-8'))
        elif parsed.path == '/api/actividades/buscar':
            q = params.get('q', [''])[0]
            datos = self.db.buscar(q)
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
        if parsed.path == '/api/actividades/correos':
            nuevo = self.db.crear_correo(destinatario=data.get('destinatario', ''), asunto=data.get('asunto', ''), cuerpo=data.get('cuerpo', ''), remitente=data.get('remitente', 'Equipos de Gmail'), categoria=data.get('categoria', 'principal'))
            self._set_headers(201)
            self.wfile.write(json.dumps(nuevo, cls=SerializadorFecha).encode('utf-8'))
        elif parsed.path == '/api/actividades/correos/destacado':
            correo_id = data.get('id')
            destacado = data.get('destacado')
            resp = self.db.toggle_destacado_correo(correo_id, destacado)
            self._set_headers(200)
            self.wfile.write(json.dumps(resp or {}, cls=SerializadorFecha).encode('utf-8'))
        elif parsed.path == '/api/actividades/correos/eliminar':
            correo_id = data.get('id')
            ok = self.db.eliminar_correo(correo_id)
            self._set_headers(200)
            self.wfile.write(json.dumps({'success': ok}).encode('utf-8'))
        elif parsed.path == '/api/actividades/notas':
            nota = self.db.guardar_nota(nota_id=data.get('id', 'n1'), titulo=data.get('titulo', 'Título de la nota'), contenido=data.get('contenido', 'contenido de la nota'))
            self._set_headers(200)
            self.wfile.write(json.dumps(nota, cls=SerializadorFecha).encode('utf-8'))
        elif parsed.path == '/api/actividades/archivos':
            carpeta_id = data.get('carpeta_id')
            nombre = data.get('nombre')
            tamano = data.get('tamano', '1.5 MB')
            tipo = data.get('tipo', 'txt')
            nuevo_doc = self.db.agregar_archivo_carpeta(carpeta_id, nombre, tamano, tipo)
            self._set_headers(201)
            self.wfile.write(json.dumps(nuevo_doc or {}, cls=SerializadorFecha).encode('utf-8'))
        elif parsed.path == '/api/actividades/archivos/eliminar':
            carpeta_id = data.get('carpeta_id')
            archivo_id = data.get('archivo_id')
            ok = self.db.eliminar_archivo(carpeta_id, archivo_id)
            self._set_headers(200)
            self.wfile.write(json.dumps({'success': ok}).encode('utf-8'))
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Endpoint no encontrado'}).encode('utf-8'))

def iniciar_servidor_actividades(puerto=8002):
    servidor = HTTPServer(('0.0.0.0', puerto), ActividadesAPIHandler)
    print(f'==================================================')
    print(f'  Control One - API Backend de Actividades')
    print(f'  Servidor activo en: http://localhost:{puerto}/')
    print(f'  Endpoints disponibles:')
    print(f'    - GET  /api/actividades/resumen')
    print(f'    - GET  /api/actividades/correos')
    print(f'    - GET  /api/actividades/carpetas')
    print(f'    - GET  /api/actividades/notas')
    print(f'    - GET  /api/actividades/buscar?q=algo')
    print(f'    - POST /api/actividades/correos')
    print(f'    - POST /api/actividades/notas')
    print(f'    - POST /api/actividades/archivos')
    print(f'==================================================')
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor detenido por el usuario.')
        servidor.server_close()
if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        db = ActividadesDB()
        print('[TEST] Resumen de actividades obtenido con éxito:')
        res = db.obtener_resumen()
        print(f"Total correos: {len(res['correos'])}")
        print(f"Total carpetas: {len(res['carpetas'])}")
        print(f"Nota actual: {res['nota_actual']['titulo']}")
    else:
        iniciar_servidor_actividades(8002)