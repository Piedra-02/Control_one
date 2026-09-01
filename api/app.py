"""
Control One - API
--------------------
Servidor Flask que expone los datos de PostgreSQL al frontend
(perfil.html y automatizacion.html) vía JSON.

Instalar dependencias:
    pip install flask flask-cors psycopg2-binary python-dotenv

Correr el servidor:
    python app.py
    (queda escuchando en http://127.0.0.1:5000)
"""

from flask import Flask, request, jsonify
from flask_cors import CORS

from db import (
    BaseDeDatos,
    ContactoRepository,
    PerfilRepository,
    ConfiguracionRepository,
    AutomatizacionRepository,
)

app = Flask(__name__)
CORS(app)  # permite que perfil.html / automatizacion.html (abiertos por separado) llamen a esta API

bd = BaseDeDatos()
contactos_repo = ContactoRepository(bd)
perfil_repo = PerfilRepository(bd)
config_repo = ConfiguracionRepository(bd)
automatizacion_repo = AutomatizacionRepository(bd)


def error(mensaje, codigo=400):
    return jsonify({"error": mensaje}), codigo


# ---------------------------------------------------------
# PERFIL
# ---------------------------------------------------------
@app.get("/api/perfil")
def obtener_perfil():
    return jsonify(perfil_repo.obtener())


@app.put("/api/perfil")
def actualizar_perfil():
    datos = request.get_json(force=True)
    nombre_completo = (datos.get("nombre_completo") or "").strip()
    alias = (datos.get("alias") or "").strip()
    if not nombre_completo:
        return error("El nombre completo es obligatorio.")
    return jsonify(perfil_repo.actualizar(nombre_completo, alias))


# ---------------------------------------------------------
# CONTACTOS
# ---------------------------------------------------------
@app.get("/api/contactos")
def listar_contactos():
    filtro = request.args.get("filtro", "todos")
    return jsonify(contactos_repo.listar(filtro))


@app.post("/api/contactos")
def crear_contacto():
    datos = request.get_json(force=True)
    nombre = (datos.get("nombre") or "").strip()
    telefono = (datos.get("telefono") or "").strip()
    if not nombre or not telefono:
        return error("Nombre y teléfono son obligatorios.")
    return jsonify(contactos_repo.crear(nombre, telefono)), 201


@app.patch("/api/contactos/<contacto_id>")
def actualizar_contacto(contacto_id):
    datos = request.get_json(force=True)
    resultado = contactos_repo.actualizar_flags(
        contacto_id,
        oculto=datos.get("oculto"),
        archivado=datos.get("archivado"),
    )
    if resultado is None:
        return error("No se envió ningún campo para actualizar (oculto/archivado).")
    return jsonify(resultado)


@app.delete("/api/contactos/<contacto_id>")
def eliminar_contacto(contacto_id):
    contactos_repo.eliminar(contacto_id)
    return jsonify({"eliminado": True})


# ---------------------------------------------------------
# CONFIGURACIÓN (correo de notificaciones)
# ---------------------------------------------------------
@app.get("/api/configuracion")
def obtener_configuracion():
    return jsonify(config_repo.obtener())


@app.put("/api/configuracion")
def actualizar_configuracion():
    datos = request.get_json(force=True)
    correo = (datos.get("correo_notificacion") or "").strip()
    notificar = bool(datos.get("notificar_por_correo", True))
    if not correo:
        return error("El correo de notificación es obligatorio.")
    return jsonify(config_repo.actualizar(correo, notificar))


# ---------------------------------------------------------
# AUTOMATIZACIÓN
# ---------------------------------------------------------
TIPOS_REGLA_VALIDOS = {
    "bidireccional",
    "direccional",
    "solo_si_se_cumple_condicion",
    "depurador_detallado",
    "solo_si_no_se_cumple_condicion",
}


@app.post("/api/automatizaciones")
def crear_automatizacion():
    datos = request.get_json(force=True)
    nombre = (datos.get("nombre") or "").strip()
    descripcion = (datos.get("descripcion") or "").strip()
    tipo_regla = datos.get("tipo_regla")
    condicion = (datos.get("condicion") or "").strip()

    if not nombre:
        return error("El nombre es obligatorio.")
    if tipo_regla not in TIPOS_REGLA_VALIDOS:
        return error("Selecciona una regla válida.")

    return jsonify(automatizacion_repo.crear(nombre, descripcion, tipo_regla, condicion)), 201


@app.get("/api/automatizaciones/historial")
def obtener_historial():
    return jsonify(automatizacion_repo.historial())


if __name__ == "__main__":
    app.run(debug=True, port=5000)
