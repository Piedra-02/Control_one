"""
Control One - Notificador de recordatorios por Gmail
------------------------------------------------------
Revisa la tabla 'recordatorios' en PostgreSQL y envía un
correo por cada recordatorio pendiente, usando Gmail SMTP.

Requisitos:
    pip install psycopg2-binary python-dotenv

Variables de entorno esperadas (crear un archivo .env):
    GMAIL_USUARIO=tu_correo@gmail.com
    GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx   (la de 16 caracteres, sin espacios)
    DB_HOST=localhost
    DB_NAME=control_one
    DB_USER=postgres
    DB_PASSWORD=tu_password_de_postgres
    DB_PORT=5432
"""

import os
import ssl
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()


class EmailNotifier:
    """Se encarga únicamente de enviar correos usando Gmail SMTP."""

    def __init__(self, remitente, contrasena_app, servidor="smtp.gmail.com", puerto=465):
        self.remitente = remitente
        self.contrasena_app = contrasena_app
        self.servidor = servidor
        self.puerto = puerto

    def enviar(self, destinatario, asunto, cuerpo):
        mensaje = MIMEMultipart()
        mensaje["From"] = self.remitente
        mensaje["To"] = destinatario
        mensaje["Subject"] = asunto
        mensaje.attach(MIMEText(cuerpo, "plain"))

        contexto = ssl.create_default_context()
        with smtplib.SMTP_SSL(self.servidor, self.puerto, context=contexto) as servidor:
            servidor.login(self.remitente, self.contrasena_app)
            servidor.sendmail(self.remitente, destinatario, mensaje.as_string())


class BaseDeDatos:
    """Se encarga únicamente de hablar con PostgreSQL."""

    def __init__(self, host, dbname, user, password, port=5432):
        self.conexion = psycopg2.connect(
            host=host, dbname=dbname, user=user, password=password, port=port
        )

    def obtener_recordatorios_pendientes(self):
        with self.conexion.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, titulo, fecha_hora
                FROM recordatorios
                WHERE fecha_hora <= NOW() AND enviado = FALSE
                """
            )
            return cur.fetchall()

    def obtener_configuracion_notificaciones(self):
        with self.conexion.cursor() as cur:
            cur.execute(
                "SELECT correo_notificacion, notificar_por_correo FROM configuracion WHERE id = 1"
            )
            return cur.fetchone()  # (correo, True/False)

    def marcar_como_enviado(self, recordatorio_id):
        with self.conexion.cursor() as cur:
            cur.execute(
                "UPDATE recordatorios SET enviado = TRUE WHERE id = %s", (recordatorio_id,)
            )
        self.conexion.commit()

    def cerrar(self):
        self.conexion.close()


class GestorDeAvisos:
    """Orquesta la revisión de recordatorios y el envío de avisos.
    No sabe de SMTP ni de SQL directamente: delega en las otras clases.
    """

    def __init__(self, base_datos: BaseDeDatos, notificador: EmailNotifier):
        self.base_datos = base_datos
        self.notificador = notificador

    def procesar_pendientes(self):
        config = self.base_datos.obtener_configuracion_notificaciones()
        if not config:
            print("No hay fila de configuración en la base de datos.")
            return

        correo_destino, notificar_activo = config
        if not notificar_activo:
            return

        pendientes = self.base_datos.obtener_recordatorios_pendientes()
        for recordatorio in pendientes:
            asunto = f"Recordatorio: {recordatorio['titulo']}"
            cuerpo = (
                f"Hola,\n\nTu recordatorio '{recordatorio['titulo']}' "
                f"vence el {recordatorio['fecha_hora']}.\n\n- Control One"
            )
            try:
                self.notificador.enviar(correo_destino, asunto, cuerpo)
                self.base_datos.marcar_como_enviado(recordatorio["id"])
                print(f"Correo enviado: {recordatorio['titulo']}")
            except Exception as error:
                print(f"Error enviando '{recordatorio['titulo']}': {error}")


def main():
    base_datos = BaseDeDatos(
        host=os.getenv("DB_HOST", "localhost"),
        dbname=os.getenv("DB_NAME", "control_one"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD"),
        port=int(os.getenv("DB_PORT", 5432)),
    )
    notificador = EmailNotifier(
        remitente=os.getenv("GMAIL_USUARIO"),
        contrasena_app=os.getenv("GMAIL_APP_PASSWORD"),
    )
    gestor = GestorDeAvisos(base_datos, notificador)

    print("Notificador de Control One iniciado. Revisando cada 60 segundos...")
    try:
        while True:
            gestor.procesar_pendientes()
            time.sleep(60)
    except KeyboardInterrupt:
        print("Detenido por el usuario.")
    finally:
        base_datos.cerrar()


if __name__ == "__main__":
    main()