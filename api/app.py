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
    CategoriaRepository,
    TareaRepository,
    EventoRepository,
    RecordatorioPanelRepository,
    OrganizacionRepository,
    PanelResumenRepository,
    NotaRepository,
    FavoritoHistorialHelper,
    FavoritoRepository,
    HistorialGeneralRepository,
    SuscripcionRepository,
    NotificadorCorreo,
)

app = Flask(__name__)
CORS(app)  # permite que perfil.html / automatizacion.html (abiertos por separado) llamen a esta API

bd = BaseDeDatos()
notificador = NotificadorCorreo(bd)
contactos_repo = ContactoRepository(bd)
perfil_repo = PerfilRepository(bd)
config_repo = ConfiguracionRepository(bd)
automatizacion_repo = AutomatizacionRepository(bd)

categorias_repo = CategoriaRepository(bd)
tareas_repo = TareaRepository(bd)
eventos_repo = EventoRepository(bd)
recordatorios_panel_repo = RecordatorioPanelRepository(bd)
organizacion_repo = OrganizacionRepository(categorias_repo, eventos_repo)
panel_repo = PanelResumenRepository(bd, tareas_repo, eventos_repo, recordatorios_panel_repo)

notas_repo = NotaRepository(bd)
fav_hist_helper = FavoritoHistorialHelper(bd)
favoritos_repo = FavoritoRepository(bd, fav_hist_helper)
historial_repo = HistorialGeneralRepository(bd, fav_hist_helper)
suscripciones_repo = SuscripcionRepository(bd, historial_repo)


def error(mensaje, codigo=400):
    return jsonify({"error": mensaje}), codigo


# ---------------------------------------------------------
# LOGIN
# ---------------------------------------------------------
@app.post("/api/login")
def login():
    datos = request.get_json(force=True)
    usuario = (datos.get("usuario") or "").strip()
    contrasena = datos.get("contrasena") or ""
    if not usuario or not contrasena:
        return error("Usuario y contraseña son obligatorios.")

    resultado = bd.ejecutar(
        """SELECT usuario, nombre_completo, alias FROM usuarios
           WHERE usuario = %s AND contrasena_hash = crypt(%s, contrasena_hash)""",
        (usuario, contrasena),
        retornar="one",
    )
    if not resultado:
        return error("Usuario o contraseña incorrectos.", 401)
    return jsonify(resultado)


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


@app.delete("/api/automatizaciones/historial/<historial_id>")
def eliminar_historial_automatizacion(historial_id):
    automatizacion_repo.eliminar_historial(historial_id)
    return jsonify({"eliminado": True})


@app.post("/api/automatizaciones/<automatizacion_id>/toggle")
def toggle_automatizacion(automatizacion_id):
    return jsonify(automatizacion_repo.toggle_activa(automatizacion_id))


# ---------------------------------------------------------
# ORGANIZACIÓN (Calendario + Categorías + Tareas por categoría)
# Mismas rutas que antes exponía backend/Python/organizacion.py
# en el puerto 8001, ahora unificadas en esta misma API.
# ---------------------------------------------------------
@app.get("/api/organizacion/datos")
def organizacion_datos():
    anio = request.args.get("anio", 2026, type=int)
    mes = request.args.get("mes", 8, type=int)
    return jsonify(organizacion_repo.datos_completos(anio, mes))


@app.get("/api/organizacion/categorias")
def organizacion_listar_categorias():
    return jsonify(categorias_repo.listar_con_tareas())


@app.post("/api/organizacion/categorias")
def organizacion_guardar_categoria():
    datos = request.get_json(force=True)
    cat_id = datos.get("id")
    nombre = (datos.get("nombre") or "").strip()
    if not nombre:
        return error("El nombre de la categoría es obligatorio.")
    if cat_id:
        return jsonify(categorias_repo.modificar(cat_id, nombre))
    return jsonify(categorias_repo.crear(nombre)), 201


@app.post("/api/organizacion/categorias/eliminar")
def organizacion_eliminar_categoria():
    datos = request.get_json(force=True)
    cat_id = datos.get("id")
    if not cat_id:
        return error("Falta el id de la categoría.")
    categorias_repo.eliminar(cat_id)
    return jsonify({"success": True})


@app.post("/api/organizacion/tareas")
def organizacion_crear_tarea():
    datos = request.get_json(force=True)
    titulo = (datos.get("titulo") or "").strip()
    categoria_id = datos.get("categoria_id")
    if not titulo or not categoria_id:
        return error("Título y categoría son obligatorios.")
    nueva = tareas_repo.crear_en_categoria(titulo, categoria_id)
    notificador.notificar_creacion("tarea", titulo)
    return jsonify(nueva), 201


@app.post("/api/organizacion/eventos")
def organizacion_guardar_evento():
    datos = request.get_json(force=True)
    titulo = (datos.get("titulo") or "").strip()
    if not titulo:
        return error("El título del evento es obligatorio.")
    es_nuevo = not datos.get("id")
    evento = eventos_repo.guardar(
        evento_id=datos.get("id") or None,
        titulo=titulo,
        descripcion=datos.get("descripcion", ""),
        fecha=datos.get("fecha"),
        ubicacion=datos.get("ubicacion", ""),
    )
    if es_nuevo:
        notificador.notificar_creacion("evento", titulo, f"Fecha: {datos.get('fecha', '')}")
    return jsonify(evento), 201


@app.post("/api/organizacion/eventos/eliminar")
def organizacion_eliminar_evento():
    datos = request.get_json(force=True)
    evento_id = datos.get("id")
    if not evento_id:
        return error("Falta el id del evento.")
    eventos_repo.eliminar(evento_id)
    return jsonify({"success": True})


# ---------------------------------------------------------
# PANEL PRINCIPAL (Resumen del dashboard + búsqueda global)
# Mismas rutas que antes exponía backend/Python/panel_principal.py
# en el puerto 8000, ahora unificadas en esta misma API.
# ---------------------------------------------------------
@app.get("/api/panel/resumen")
def panel_resumen():
    return jsonify(panel_repo.resumen())


@app.get("/api/panel/eventos")
def panel_eventos():
    return jsonify(eventos_repo.listar_recientes())


@app.post("/api/panel/eventos")
def panel_crear_evento():
    datos = request.get_json(force=True)
    titulo = (datos.get("titulo") or "").strip()
    fecha_inicio = datos.get("fecha_inicio")
    fecha_fin = datos.get("fecha_fin")
    if not titulo or not fecha_inicio or not fecha_fin:
        return error("Título, fecha_inicio y fecha_fin son obligatorios.")
    nuevo = eventos_repo.crear_detallado(
        titulo=titulo,
        descripcion=datos.get("descripcion", ""),
        ubicacion=datos.get("ubicacion", ""),
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
    )
    notificador.notificar_creacion("evento", titulo, f"Desde: {fecha_inicio} hasta {fecha_fin}")
    return jsonify(nuevo), 201


@app.get("/api/panel/tareas")
def panel_listar_tareas():
    estado = request.args.get("estado")
    return jsonify(tareas_repo.listar(estado=estado))


@app.post("/api/panel/tareas")
def panel_crear_tarea():
    datos = request.get_json(force=True)
    titulo = (datos.get("titulo") or "").strip()
    if not titulo:
        return error("El título de la tarea es obligatorio.")
    nueva = tareas_repo.crear(
        titulo=titulo,
        descripcion=datos.get("descripcion", ""),
        prioridad=datos.get("prioridad", "media"),
        fecha_vencimiento=datos.get("fecha_vencimiento"),
    )
    notificador.notificar_creacion("tarea", titulo, datos.get("descripcion", ""))
    return jsonify(nueva), 201


@app.put("/api/panel/tareas/<tarea_id>")
def panel_modificar_tarea(tarea_id):
    datos = request.get_json(force=True)
    titulo = (datos.get("titulo") or "").strip()
    if not titulo:
        return error("El título es obligatorio.")
    return jsonify(tareas_repo.modificar_titulo(tarea_id, titulo))


@app.delete("/api/panel/tareas/<tarea_id>")
def panel_eliminar_tarea(tarea_id):
    tareas_repo.eliminar(tarea_id)
    return jsonify({"eliminado": True})


@app.post("/api/panel/tareas/estado")
def panel_cambiar_estado_tarea():
    datos = request.get_json(force=True)
    tarea_id = datos.get("id")
    nuevo_estado = datos.get("estado")
    if not tarea_id or not nuevo_estado:
        return error("Faltan datos (id, estado).")
    try:
        return jsonify(tareas_repo.cambiar_estado(tarea_id, nuevo_estado))
    except ValueError as e:
        return error(str(e))


@app.get("/api/panel/recordatorios")
def panel_listar_recordatorios():
    solo_pendientes = request.args.get("pendientes") == "true"
    filtro = request.args.get("filtro", "todos")
    return jsonify(recordatorios_panel_repo.listar(solo_pendientes=solo_pendientes, filtro=filtro))


@app.patch("/api/panel/recordatorios/<recordatorio_id>")
def panel_actualizar_flags_recordatorio(recordatorio_id):
    datos = request.get_json(force=True)
    resultado = recordatorios_panel_repo.actualizar_flags(
        recordatorio_id,
        oculto=datos.get("oculto"),
        archivado=datos.get("archivado"),
    )
    if resultado is None:
        return error("No se envió ningún campo para actualizar (oculto/archivado).")
    return jsonify(resultado)


@app.post("/api/panel/recordatorios")
def panel_crear_recordatorio():
    datos = request.get_json(force=True)
    titulo = (datos.get("titulo") or "").strip()
    fecha_hora = datos.get("fecha_hora")
    if not titulo or not fecha_hora:
        return error("Título y fecha_hora son obligatorios.")
    nuevo = recordatorios_panel_repo.crear(titulo, fecha_hora)
    notificador.notificar_creacion("recordatorio", titulo, f"Programado para: {fecha_hora}")
    return jsonify(nuevo), 201


@app.put("/api/panel/recordatorios/<recordatorio_id>")
def panel_modificar_recordatorio(recordatorio_id):
    datos = request.get_json(force=True)
    titulo = (datos.get("titulo") or "").strip()
    if not titulo:
        return error("El título es obligatorio.")
    return jsonify(recordatorios_panel_repo.modificar_titulo(recordatorio_id, titulo))


@app.delete("/api/panel/recordatorios/<recordatorio_id>")
def panel_eliminar_recordatorio(recordatorio_id):
    recordatorios_panel_repo.eliminar(recordatorio_id)
    return jsonify({"eliminado": True})


@app.get("/api/panel/buscar")
def panel_buscar():
    q = request.args.get("q", "")
    return jsonify(panel_repo.buscar(q))


# ---------------------------------------------------------
# ACTIVIDADES (solo Notas — Correos y Carpetas quedan como
# demo local, no están conectados a la base de datos)
# ---------------------------------------------------------
@app.get("/api/actividades/notas")
def actividades_obtener_nota():
    return jsonify(notas_repo.obtener_activa())


@app.post("/api/actividades/notas")
def actividades_guardar_nota():
    datos = request.get_json(force=True)
    titulo = (datos.get("titulo") or "Título de la nota").strip()
    contenido = (datos.get("contenido") or "").strip()
    return jsonify(notas_repo.guardar_activa(titulo, contenido))


@app.get("/api/actividades/resumen")
def actividades_resumen():
    return jsonify({
        "nota_actual": notas_repo.obtener_activa(),
        "todas_las_notas": notas_repo.listar(),
    })


# ---------------------------------------------------------
# INFORMACIÓN (Favoritos, Historial, Suscripciones)
# ---------------------------------------------------------
@app.get("/api/informacion/favoritos")
def informacion_listar_favoritos():
    return jsonify(favoritos_repo.listar())


@app.post("/api/informacion/favoritos")
def informacion_crear_favorito():
    datos = request.get_json(force=True)
    titulo = (datos.get("titulo") or "").strip()
    if not titulo:
        return error("El título del favorito es obligatorio.")
    nuevo = favoritos_repo.crear(
        titulo,
        tipo_elemento=datos.get("tipo_elemento", "general"),
        elemento_id=datos.get("elemento_id"),
    )
    return jsonify(nuevo), 201


@app.post("/api/informacion/favoritos/eliminar")
def informacion_eliminar_favorito():
    datos = request.get_json(force=True)
    fav_id = datos.get("id")
    if not fav_id:
        return error("Falta el id del favorito.")
    favoritos_repo.eliminar(fav_id)
    return jsonify({"success": True})


@app.get("/api/informacion/historial")
def informacion_listar_historial():
    limite = request.args.get("limite", 30, type=int)
    return jsonify(historial_repo.listar(limite=limite))


@app.post("/api/informacion/historial/limpiar")
def informacion_limpiar_historial():
    historial_repo.limpiar()
    return jsonify({"success": True})


@app.get("/api/informacion/suscripciones")
def informacion_listar_suscripciones():
    return jsonify(suscripciones_repo.listar())


@app.post("/api/informacion/suscripciones")
def informacion_guardar_suscripcion():
    datos = request.get_json(force=True)
    sub_id = datos.get("id")
    nombre = (datos.get("nombre") or "").strip()
    if not nombre:
        return error("El nombre de la suscripción es obligatorio.")
    monto = datos.get("monto", 9.99)
    categoria = datos.get("categoria", "General")

    if sub_id:
        return jsonify(suscripciones_repo.modificar(sub_id, nombre, monto, categoria))
    nueva = suscripciones_repo.crear(nombre, monto=monto, categoria=categoria)
    notificador.notificar_creacion("suscripción", nombre, f"Monto: {monto} — Categoría: {categoria}")
    return jsonify(nueva), 201


@app.post("/api/informacion/suscripciones/toggle")
def informacion_toggle_suscripcion():
    datos = request.get_json(force=True)
    sub_id = datos.get("id")
    if not sub_id:
        return error("Falta el id de la suscripción.")
    return jsonify(suscripciones_repo.toggle(sub_id, activa=datos.get("activa")))


@app.post("/api/informacion/suscripciones/eliminar")
def informacion_eliminar_suscripcion():
    datos = request.get_json(force=True)
    sub_id = datos.get("id")
    if not sub_id:
        return error("Falta el id de la suscripción.")
    suscripciones_repo.eliminar(sub_id)
    return jsonify({"success": True})


@app.get("/api/informacion/resumen")
def informacion_resumen():
    favoritos = favoritos_repo.listar()
    historial = historial_repo.listar()
    suscripciones = suscripciones_repo.listar()
    return jsonify({
        "favoritos": favoritos,
        "historial": historial,
        "suscripciones": suscripciones,
        "estadisticas": {
            "total_favoritos": len(favoritos),
            "total_historial": len(historial),
            "total_suscripciones": len(suscripciones),
            "suscripciones_activas": len([s for s in suscripciones if s.get("activa")]),
        },
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)