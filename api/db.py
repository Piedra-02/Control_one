import os
import uuid
import datetime
import ssl
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
load_dotenv()

def serializar(valor):
    if isinstance(valor, dict):
        return {k: serializar(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [serializar(v) for v in valor]
    if isinstance(valor, (uuid.UUID, datetime.datetime, datetime.date)):
        return str(valor)
    return valor

class BaseDeDatos:

    def __init__(self):
        self.conexion = psycopg2.connect(host=os.getenv('DB_HOST', 'localhost'), dbname=os.getenv('DB_NAME', 'control_one'), user=os.getenv('DB_USER', 'postgres'), password=os.getenv('DB_PASSWORD'), port=int(os.getenv('DB_PORT', 5432)))

    def ejecutar(self, sql, params=None, retornar='all'):
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            try:
                cur.execute(sql, params or ())
                resultado = None
                if retornar == 'all':
                    resultado = cur.fetchall()
                elif retornar == 'one':
                    resultado = cur.fetchone()
                self.conexion.commit()
                return serializar(resultado)
            except Exception:
                self.conexion.rollback()
                raise

class ContactoRepository:

    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def listar(self, filtro='todos'):
        if filtro == 'ocultos':
            condicion = 'WHERE oculto = TRUE'
        elif filtro == 'archivados':
            condicion = 'WHERE archivado = TRUE'
        else:
            condicion = 'WHERE oculto = FALSE AND archivado = FALSE'
        return self.bd.ejecutar(f'SELECT * FROM contactos {condicion} ORDER BY fecha_creacion DESC')

    def crear(self, nombre, telefono):
        return self.bd.ejecutar('INSERT INTO contactos (nombre, telefono)\n               VALUES (%s, %s) RETURNING *', (nombre, telefono), retornar='one')

    def actualizar_flags(self, contacto_id, oculto=None, archivado=None):
        campos, valores = ([], [])
        if oculto is not None:
            campos.append('oculto = %s')
            valores.append(oculto)
        if archivado is not None:
            campos.append('archivado = %s')
            valores.append(archivado)
        if not campos:
            return None
        valores.append(contacto_id)
        return self.bd.ejecutar(f"UPDATE contactos SET {', '.join(campos)} WHERE id = %s RETURNING *", tuple(valores), retornar='one')

    def eliminar(self, contacto_id):
        self.bd.ejecutar('DELETE FROM contactos WHERE id = %s', (contacto_id,), retornar='none')

    def modificar(self, contacto_id, nombre, telefono):
        return self.bd.ejecutar('UPDATE contactos SET nombre = %s, telefono = %s WHERE id = %s RETURNING *', (nombre.strip(), telefono.strip(), contacto_id), retornar='one')

class PerfilRepository:

    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def obtener(self):
        return self.bd.ejecutar('SELECT usuario, nombre_completo, alias, foto_url FROM usuarios LIMIT 1', retornar='one')

    def actualizar(self, nombre_completo, alias):
        return self.bd.ejecutar('UPDATE usuarios SET nombre_completo = %s, alias = %s\n               WHERE id = (SELECT id FROM usuarios LIMIT 1)\n               RETURNING usuario, nombre_completo, alias, foto_url', (nombre_completo, alias), retornar='one')

class ConfiguracionRepository:

    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def obtener(self):
        return self.bd.ejecutar('SELECT correo_notificacion, notificar_por_correo FROM configuracion WHERE id = 1', retornar='one')

    def actualizar(self, correo_notificacion, notificar_por_correo):
        return self.bd.ejecutar('UPDATE configuracion SET correo_notificacion = %s, notificar_por_correo = %s\n               WHERE id = 1 RETURNING correo_notificacion, notificar_por_correo', (correo_notificacion, notificar_por_correo), retornar='one')

class AutomatizacionRepository:

    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def crear(self, nombre, descripcion, tipo_regla, condicion):
        automatizacion = self.bd.ejecutar('INSERT INTO automatizaciones (nombre, descripcion, tipo_regla, condicion)\n               VALUES (%s, %s, %s, %s) RETURNING *', (nombre, descripcion, tipo_regla, condicion), retornar='one')
        self.bd.ejecutar("INSERT INTO historial_automatizacion (automatizacion_id, titulo, estado)\n               VALUES (%s, %s, 'ejecutada')", (automatizacion['id'], 'Tarea Automatizada'), retornar='none')
        return automatizacion

    def historial(self):
        return self.bd.ejecutar('SELECT h.id, h.titulo, h.fecha_ejecucion, h.estado, a.nombre AS automatizacion_nombre\n               FROM historial_automatizacion h\n               JOIN automatizaciones a ON a.id = h.automatizacion_id\n               ORDER BY h.fecha_ejecucion DESC\n               LIMIT 20')

class CategoriaRepository:

    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def listar_con_tareas(self):
        categorias = self.bd.ejecutar('SELECT id, nombre, color FROM categorias ORDER BY nombre ASC')
        for cat in categorias:
            cat['tareas'] = self.bd.ejecutar('SELECT id, titulo, prioridad, estado FROM tareas WHERE categoria_id = %s ORDER BY fecha_creacion DESC', (cat['id'],))
        return categorias

    def crear(self, nombre, color='#00bcd4'):
        return self.bd.ejecutar('INSERT INTO categorias (nombre, color) VALUES (%s, %s) RETURNING id, nombre, color', (nombre.strip().upper(), color), retornar='one')

    def modificar(self, categoria_id, nuevo_nombre):
        return self.bd.ejecutar('UPDATE categorias SET nombre = %s WHERE id = %s RETURNING id, nombre, color', (nuevo_nombre.strip().upper(), categoria_id), retornar='one')

    def eliminar(self, categoria_id):
        self.bd.ejecutar('UPDATE tareas SET categoria_id = NULL WHERE categoria_id = %s', (categoria_id,), retornar='none')
        self.bd.ejecutar('DELETE FROM categorias WHERE id = %s', (categoria_id,), retornar='none')

class TareaRepository:

    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def crear_en_categoria(self, titulo, categoria_id, prioridad='media'):
        return self.bd.ejecutar('INSERT INTO tareas (titulo, categoria_id, prioridad)\n               VALUES (%s, %s, %s) RETURNING id, titulo, categoria_id, prioridad, estado', (titulo.strip(), categoria_id, prioridad), retornar='one')

    def listar(self, estado=None, limite=20):
        base = 'SELECT t.id, t.titulo, t.descripcion, t.estado, t.prioridad,\n                          t.fecha_vencimiento, c.nombre AS categoria, c.color\n                   FROM tareas t\n                   LEFT JOIN categorias c ON t.categoria_id = c.id'
        if estado:
            base += ' WHERE t.estado = %s ORDER BY t.fecha_creacion DESC LIMIT %s'
            return self.bd.ejecutar(base, (estado, limite))
        base += ' ORDER BY t.fecha_creacion DESC LIMIT %s'
        return self.bd.ejecutar(base, (limite,))

    def cambiar_estado(self, tarea_id, nuevo_estado):
        if nuevo_estado not in ('pendiente', 'en_progreso', 'completada'):
            raise ValueError(f'Estado no válido: {nuevo_estado}')
        return self.bd.ejecutar('UPDATE tareas SET estado = %s WHERE id = %s RETURNING id, titulo, estado', (nuevo_estado, tarea_id), retornar='one')

    def crear(self, titulo, descripcion='', prioridad='media', fecha_vencimiento=None, categoria_id=None):
        return self.bd.ejecutar('INSERT INTO tareas (titulo, descripcion, prioridad, fecha_vencimiento, categoria_id)\n               VALUES (%s, %s, %s, %s, %s)\n               RETURNING id, titulo, descripcion, estado, prioridad, fecha_vencimiento', (titulo, descripcion, prioridad, fecha_vencimiento, categoria_id), retornar='one')

    def eliminar(self, tarea_id):
        self.bd.ejecutar('DELETE FROM tareas WHERE id = %s', (tarea_id,), retornar='none')

    def modificar_titulo(self, tarea_id, titulo):
        return self.bd.ejecutar('UPDATE tareas SET titulo = %s WHERE id = %s RETURNING id, titulo, estado', (titulo.strip(), tarea_id), retornar='one')

class EventoRepository:

    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def listar_mes(self, anio, mes):
        return self.bd.ejecutar('SELECT id, titulo, descripcion, ubicacion,\n                      fecha_inicio::date AS fecha, fecha_inicio, fecha_fin\n               FROM eventos\n               WHERE EXTRACT(YEAR FROM fecha_inicio) = %s AND EXTRACT(MONTH FROM fecha_inicio) = %s\n               ORDER BY fecha_inicio ASC', (anio, mes))

    def listar_recientes(self, limite=10):
        return self.bd.ejecutar('SELECT e.id, e.titulo, e.descripcion, e.ubicacion, e.fecha_inicio, e.fecha_fin,\n                      c.nombre AS categoria, c.color\n               FROM eventos e\n               LEFT JOIN categorias c ON e.categoria_id = c.id\n               ORDER BY e.fecha_inicio ASC\n               LIMIT %s', (limite,))

    def guardar(self, evento_id, titulo, descripcion, fecha, ubicacion):
        if evento_id:
            return self.bd.ejecutar('UPDATE eventos\n                   SET titulo = %s, descripcion = %s, ubicacion = %s, fecha_inicio = %s, fecha_fin = %s\n                   WHERE id = %s\n                   RETURNING id, titulo, descripcion, ubicacion, fecha_inicio::date AS fecha', (titulo, descripcion, ubicacion, f'{fecha} 10:00:00', f'{fecha} 12:00:00', evento_id), retornar='one')
        return self.bd.ejecutar('INSERT INTO eventos (titulo, descripcion, ubicacion, fecha_inicio, fecha_fin)\n               VALUES (%s, %s, %s, %s, %s)\n               RETURNING id, titulo, descripcion, ubicacion, fecha_inicio::date AS fecha', (titulo, descripcion, ubicacion, f'{fecha} 10:00:00', f'{fecha} 12:00:00'), retornar='one')

    def crear_detallado(self, titulo, descripcion, ubicacion, fecha_inicio, fecha_fin, categoria_id=None):
        return self.bd.ejecutar('INSERT INTO eventos (titulo, descripcion, ubicacion, fecha_inicio, fecha_fin, categoria_id)\n               VALUES (%s, %s, %s, %s, %s, %s)\n               RETURNING id, titulo, descripcion, ubicacion, fecha_inicio, fecha_fin', (titulo, descripcion, ubicacion, fecha_inicio, fecha_fin, categoria_id), retornar='one')

    def eliminar(self, evento_id):
        self.bd.ejecutar('DELETE FROM eventos WHERE id = %s', (evento_id,), retornar='none')

class RecordatorioPanelRepository:

    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def listar(self, solo_pendientes=False, limite=10, filtro='todos'):
        sql = 'SELECT id, titulo, fecha_hora, enviado, tarea_id, evento_id, oculto, archivado FROM recordatorios'
        condiciones = []
        if filtro == 'ocultos':
            condiciones.append('oculto = TRUE')
        elif filtro == 'archivados':
            condiciones.append('archivado = TRUE')
        else:
            condiciones.append('oculto = FALSE AND archivado = FALSE')
        if solo_pendientes:
            condiciones.append('enviado = FALSE')
        if condiciones:
            sql += ' WHERE ' + ' AND '.join(condiciones)
        sql += ' ORDER BY fecha_hora ASC LIMIT %s'
        filas = self.bd.ejecutar(sql, (limite,))
        for r in filas:
            fecha_hora = r.get('fecha_hora') or ''
            r['hora_formateada'] = fecha_hora[11:16] if len(fecha_hora) >= 16 else ''
            r['subtitulo'] = 'Recordatorio programado'
            r['destacado'] = False
        return filas

    def actualizar_flags(self, recordatorio_id, oculto=None, archivado=None):
        campos, valores = ([], [])
        if oculto is not None:
            campos.append('oculto = %s')
            valores.append(oculto)
        if archivado is not None:
            campos.append('archivado = %s')
            valores.append(archivado)
        if not campos:
            return None
        valores.append(recordatorio_id)
        return self.bd.ejecutar(f"UPDATE recordatorios SET {', '.join(campos)} WHERE id = %s RETURNING id, titulo, oculto, archivado", tuple(valores), retornar='one')

    def crear(self, titulo, fecha_hora, tarea_id=None, evento_id=None):
        return self.bd.ejecutar('INSERT INTO recordatorios (titulo, fecha_hora, tarea_id, evento_id)\n               VALUES (%s, %s, %s, %s) RETURNING id, titulo, fecha_hora, enviado', (titulo, fecha_hora, tarea_id, evento_id), retornar='one')

    def eliminar(self, recordatorio_id):
        self.bd.ejecutar('DELETE FROM recordatorios WHERE id = %s', (recordatorio_id,), retornar='none')

    def modificar_titulo(self, recordatorio_id, titulo):
        return self.bd.ejecutar('UPDATE recordatorios SET titulo = %s WHERE id = %s RETURNING id, titulo, fecha_hora', (titulo.strip(), recordatorio_id), retornar='one')

class OrganizacionRepository:

    def __init__(self, categorias: CategoriaRepository, eventos: EventoRepository):
        self.categorias = categorias
        self.eventos = eventos

    def datos_completos(self, anio, mes):
        categorias = self.categorias.listar_con_tareas()
        eventos = self.eventos.listar_mes(anio, mes)
        total_tareas = sum((len(c.get('tareas', [])) for c in categorias))
        return {'mes': mes, 'anio': anio, 'eventos': eventos, 'categorias': categorias, 'estadisticas': {'total_eventos': len(eventos), 'total_tareas': total_tareas, 'total_categorias': len(categorias)}}

class NotaRepository:

    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def obtener_activa(self):
        existente = self.bd.ejecutar('SELECT id, titulo, contenido FROM notas ORDER BY fecha_creacion ASC LIMIT 1', retornar='one')
        if existente:
            return existente
        return self.bd.ejecutar("INSERT INTO notas (titulo, contenido) VALUES ('Título de la nota', 'contenido de la nota')\n               RETURNING id, titulo, contenido", retornar='one')

    def guardar_activa(self, titulo, contenido):
        activa = self.obtener_activa()
        return self.bd.ejecutar('UPDATE notas SET titulo = %s, contenido = %s WHERE id = %s RETURNING id, titulo, contenido', (titulo, contenido, activa['id']), retornar='one')

    def listar(self):
        return self.bd.ejecutar('SELECT id, titulo, contenido, fecha_actualizacion FROM notas ORDER BY fecha_actualizacion DESC')

class FavoritoHistorialHelper:
    TABLAS = {'tarea': ('tareas', 'titulo'), 'evento': ('eventos', 'titulo'), 'nota': ('notas', 'titulo'), 'archivo': ('archivos', 'nombre'), 'suscripcion': ('suscripciones', 'nombre')}

    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def titulo_de(self, tipo_elemento, elemento_id):
        info = self.TABLAS.get(tipo_elemento)
        if not info or not elemento_id:
            return '(elemento general)'
        tabla, columna = info
        fila = self.bd.ejecutar(f'SELECT {columna} AS titulo FROM {tabla} WHERE id = %s', (elemento_id,), retornar='one')
        return fila['titulo'] if fila else '(elemento eliminado)'

class FavoritoRepository:

    def __init__(self, bd: BaseDeDatos, helper: FavoritoHistorialHelper):
        self.bd = bd
        self.helper = helper

    def listar(self):
        favoritos = self.bd.ejecutar('SELECT id, tipo_elemento, elemento_id, fecha_agregado FROM favoritos ORDER BY fecha_agregado DESC')
        for f in favoritos:
            f['titulo'] = self.helper.titulo_de(f['tipo_elemento'], f['elemento_id'])
        return favoritos

    def crear(self, titulo, tipo_elemento='general', elemento_id=None):
        if tipo_elemento not in FavoritoHistorialHelper.TABLAS:
            nota = self.bd.ejecutar("INSERT INTO notas (titulo, contenido) VALUES (%s, '') RETURNING id", (titulo,), retornar='one')
            tipo_elemento = 'nota'
            elemento_id = nota['id']
        nuevo = self.bd.ejecutar('INSERT INTO favoritos (tipo_elemento, elemento_id)\n               VALUES (%s, %s) RETURNING id, tipo_elemento, elemento_id, fecha_agregado', (tipo_elemento, elemento_id), retornar='one')
        nuevo['titulo'] = titulo
        return nuevo

    def eliminar(self, favorito_id):
        self.bd.ejecutar('DELETE FROM favoritos WHERE id = %s', (favorito_id,), retornar='none')

class HistorialGeneralRepository:

    def __init__(self, bd: BaseDeDatos, helper: FavoritoHistorialHelper):
        self.bd = bd
        self.helper = helper

    def listar(self, limite=30):
        filas = self.bd.ejecutar('SELECT id, tipo_elemento, elemento_id, accion, fecha FROM historial ORDER BY fecha DESC LIMIT %s', (limite,))
        for h in filas:
            titulo = self.helper.titulo_de(h['tipo_elemento'], h['elemento_id'])
            h['descripcion'] = f"{h['accion'].capitalize()}: {titulo}"
            fecha_str = h.get('fecha') or ''
            hora = fecha_str[11:16] if len(fecha_str) >= 16 else ''
            h['hora'] = hora
            if ':' in hora:
                h['hora_linea1'], h['hora_linea2'] = hora.split(':')
            else:
                h['hora_linea1'], h['hora_linea2'] = ('', '')
        return filas

    def registrar(self, tipo_elemento, elemento_id, accion):
        return self.bd.ejecutar('INSERT INTO historial (tipo_elemento, elemento_id, accion)\n               VALUES (%s, %s, %s) RETURNING id', (tipo_elemento, elemento_id, accion), retornar='one')

    def limpiar(self):
        self.bd.ejecutar('DELETE FROM historial', retornar='none')

class SuscripcionRepository:

    def __init__(self, bd: BaseDeDatos, historial: 'HistorialGeneralRepository'=None):
        self.bd = bd
        self.historial = historial

    def listar(self):
        return self.bd.ejecutar('SELECT id, nombre, monto, moneda, activa, categoria, metodo_pago FROM suscripciones ORDER BY nombre ASC')

    def crear(self, nombre, monto=9.99, moneda='USD', categoria='General', metodo_pago=None):
        nueva = self.bd.ejecutar('INSERT INTO suscripciones (nombre, monto, moneda, categoria, metodo_pago)\n               VALUES (%s, %s, %s, %s, %s)\n               RETURNING id, nombre, monto, moneda, activa, categoria, metodo_pago', (nombre, monto, moneda, categoria, metodo_pago), retornar='one')
        if self.historial:
            self.historial.registrar('suscripcion', nueva['id'], 'creado')
        return nueva

    def modificar(self, sub_id, nombre, monto, categoria):
        return self.bd.ejecutar('UPDATE suscripciones SET nombre = %s, monto = %s, categoria = %s\n               WHERE id = %s RETURNING id, nombre, monto, moneda, activa, categoria, metodo_pago', (nombre, monto, categoria, sub_id), retornar='one')

    def toggle(self, sub_id, activa=None):
        if activa is None:
            actual = self.bd.ejecutar('SELECT activa FROM suscripciones WHERE id = %s', (sub_id,), retornar='one')
            activa = not actual['activa'] if actual else True
        resultado = self.bd.ejecutar('UPDATE suscripciones SET activa = %s WHERE id = %s RETURNING id, nombre, activa', (activa, sub_id), retornar='one')
        if self.historial and resultado:
            estado = 'activada' if activa else 'pausada'
            self.historial.registrar('suscripcion', sub_id, 'editado')
        return resultado

    def eliminar(self, sub_id):
        self.bd.ejecutar('DELETE FROM suscripciones WHERE id = %s', (sub_id,), retornar='none')

    def registrar_pago(self, sub_id, monto, fecha):
        if self.historial:
            self.historial.registrar('suscripcion', sub_id, f'pago de ${monto}')
        return {'id': sub_id, 'monto': monto, 'fecha': fecha, 'estado_pago': 'al_dia'}

class CorreoRepository:

    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def listar(self, categoria=None, limite=30):
        try:
            sql = 'SELECT id, remitente, destinatario, asunto, cuerpo, fecha, leido, destacado, categoria FROM correos'
            params = []
            if categoria and categoria != 'todos':
                sql += ' WHERE categoria = %s'
                params.append(categoria)
            sql += ' ORDER BY fecha DESC LIMIT %s'
            params.append(limite)
            return self.bd.ejecutar(sql, tuple(params))
        except Exception:
            return []

    def crear(self, destinatario, asunto, cuerpo='', remitente='Equipos de Gmail', categoria='principal'):
        try:
            return self.bd.ejecutar('INSERT INTO correos (remitente, destinatario, asunto, cuerpo, categoria) VALUES (%s, %s, %s, %s, %s) RETURNING *', (remitente, destinatario, asunto, cuerpo, categoria), retornar='one')
        except Exception:
            return {'id': 'c_' + str(int(datetime.datetime.now().timestamp())), 'remitente': remitente, 'destinatario': destinatario, 'asunto': asunto, 'cuerpo': cuerpo, 'categoria': categoria, 'fecha': datetime.datetime.now().isoformat(), 'destacado': False, 'leido': True}

    def toggle_destacado(self, correo_id, destacado):
        try:
            return self.bd.ejecutar('UPDATE correos SET destacado = %s WHERE id = %s RETURNING *', (destacado, correo_id), retornar='one')
        except Exception:
            return {'id': correo_id, 'destacado': destacado}

    def eliminar(self, correo_id):
        try:
            self.bd.ejecutar('DELETE FROM correos WHERE id = %s', (correo_id,), retornar='none')
        except Exception:
            pass
        return {'eliminado': True}

class ArchivoRepository:

    def __init__(self, bd: BaseDeDatos):
        self.bd = bd

    def listar(self, categoria_id=None):
        try:
            if categoria_id:
                return self.bd.ejecutar('SELECT id, nombre, url, tipo, tamano_bytes, fecha_subida FROM archivos WHERE categoria_id = %s ORDER BY fecha_subida DESC', (categoria_id,))
            return self.bd.ejecutar('SELECT id, nombre, url, tipo, tamano_bytes, fecha_subida FROM archivos ORDER BY fecha_subida DESC')
        except Exception:
            return []

    def crear(self, nombre, categoria_id=None, url='', tipo='txt', tamano_bytes=1024):
        try:
            return self.bd.ejecutar('INSERT INTO archivos (nombre, categoria_id, url, tipo, tamano_bytes) VALUES (%s, %s, %s, %s, %s) RETURNING *', (nombre, categoria_id, url, tipo, tamano_bytes), retornar='one')
        except Exception:
            return {'id': 'doc_' + str(int(datetime.datetime.now().timestamp())), 'nombre': nombre, 'tipo': tipo, 'tamano': '1.2 MB'}

    def eliminar(self, archivo_id):
        try:
            self.bd.ejecutar('DELETE FROM archivos WHERE id = %s', (archivo_id,), retornar='none')
        except Exception:
            pass
        return {'eliminado': True}

class NotificadorCorreo:

    def __init__(self, bd: BaseDeDatos):
        self.bd = bd
        self.remitente = os.getenv('GMAIL_USUARIO')
        self.contrasena_app = os.getenv('GMAIL_APP_PASSWORD')

    def notificar_creacion(self, tipo, titulo, detalle=''):
        if not self.remitente or not self.contrasena_app:
            print('[AVISO] GMAIL_USUARIO/GMAIL_APP_PASSWORD no configurados; no se envía correo.')
            return
        config = self.bd.ejecutar('SELECT correo_notificacion, notificar_por_correo FROM configuracion WHERE id = 1', retornar='one')
        if not config or not config.get('notificar_por_correo') or (not config.get('correo_notificacion')):
            return
        asunto = f'Control One: nuevo/a {tipo} — {titulo}'
        cuerpo = f"Se creó {tipo} '{titulo}' en Control One.\n\n{detalle}"
        try:
            mensaje = MIMEMultipart()
            mensaje['From'] = self.remitente
            mensaje['To'] = config['correo_notificacion']
            mensaje['Subject'] = asunto
            mensaje.attach(MIMEText(cuerpo, 'plain'))
            contexto = ssl.create_default_context()
            with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=contexto) as servidor:
                servidor.login(self.remitente, self.contrasena_app)
                servidor.sendmail(self.remitente, config['correo_notificacion'], mensaje.as_string())
        except Exception as e:
            print(f'[AVISO] No se pudo enviar el correo de notificación: {e}')

class PanelResumenRepository:

    def __init__(self, bd: BaseDeDatos, tareas: TareaRepository, eventos: EventoRepository, recordatorios: RecordatorioPanelRepository):
        self.bd = bd
        self.tareas = tareas
        self.eventos = eventos
        self.recordatorios = recordatorios

    def resumen(self):
        eventos = self.eventos.listar_recientes()
        tareas = self.tareas.listar()
        recordatorios = self.recordatorios.listar()
        pendientes = len([t for t in tareas if t.get('estado') != 'completada'])
        completadas = len([t for t in tareas if t.get('estado') == 'completada'])
        return {'estadisticas': {'tareas_pendientes': pendientes, 'tareas_completadas': completadas, 'total_eventos': len(eventos), 'total_recordatorios': len(recordatorios)}, 'eventos': eventos, 'tareas': tareas, 'recordatorios': recordatorios}

    def buscar(self, q):
        q = (q or '').strip()
        if not q:
            return self.resumen()
        like = f'%{q}%'
        eventos = self.bd.ejecutar("SELECT id, titulo, descripcion, 'evento' AS tipo FROM eventos WHERE titulo ILIKE %s OR descripcion ILIKE %s LIMIT 10", (like, like))
        tareas = self.bd.ejecutar("SELECT id, titulo, descripcion, estado, prioridad, 'tarea' AS tipo FROM tareas WHERE titulo ILIKE %s OR descripcion ILIKE %s LIMIT 10", (like, like))
        recordatorios = self.bd.ejecutar("SELECT id, titulo, fecha_hora, 'recordatorio' AS tipo FROM recordatorios WHERE titulo ILIKE %s LIMIT 10", (like,))
        return {'eventos': eventos, 'tareas': tareas, 'recordatorios': recordatorios, 'total_coincidencias': len(eventos) + len(tareas) + len(recordatorios)}