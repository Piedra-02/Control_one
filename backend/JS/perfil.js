// =========================================================
// Control One — Perfil / Preferencias
// La pantalla base es fija (igual al Figma). Ocultos,
// Archivados, Editar perfil, Configuración de correos y
// Agregar contacto se abren como tarjetas flotantes (modal),
// nunca como páginas o paneles separados.
// Conectado a la API real (ver carpeta /api, archivo app.py).
// =========================================================

const API_BASE = 'http://127.0.0.1:5000/api';

lucide.createIcons();

async function apiFetch(path, opciones = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opciones,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || `Error ${res.status}`);
    return data;
  } catch (err) {
    notificarModal('No se pudo conectar con el servidor. ¿Está corriendo "python app.py" en la carpeta /api?\n\n' + err.message);
    throw err;
  }
}

// ---------- Utilidad ----------
function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g,
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// ---------- Modal genérico ----------
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');

function abrirModal(html, extraClass) {
  modalContent.innerHTML = html;
  const card = modalOverlay.querySelector('.modal-card');
  card.className = 'modal-card' + (extraClass ? ' ' + extraClass : '');
  modalOverlay.classList.remove('hidden');
  lucide.createIcons();
}
function cerrarModal() {
  modalOverlay.classList.add('hidden');
  modalContent.innerHTML = '';
  const card = modalOverlay.querySelector('.modal-card');
  if (card) card.className = 'modal-card';
}
document.getElementById('modalClose').addEventListener('click', cerrarModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) cerrarModal(); });

// ---------- Confirmación / aviso con estilo propio (reemplaza confirm()/alert()) ----------
const confirmOverlay = document.getElementById('confirmOverlay');
const confirmMensaje = document.getElementById('confirmMensaje');
const confirmCancelar = document.getElementById('confirmCancelar');
const confirmAceptar = document.getElementById('confirmAceptar');

function mostrarDialogo(mensaje, conCancelar) {
  return new Promise((resolve) => {
    confirmMensaje.textContent = mensaje;
    confirmCancelar.style.display = conCancelar ? 'inline-flex' : 'none';
    confirmAceptar.textContent = conCancelar ? 'Aceptar' : 'Entendido';
    confirmOverlay.classList.remove('hidden');

    function limpiar() {
      confirmOverlay.classList.add('hidden');
      confirmAceptar.removeEventListener('click', onAceptar);
      confirmCancelar.removeEventListener('click', onCancelar);
    }
    function onAceptar() { limpiar(); resolve(true); }
    function onCancelar() { limpiar(); resolve(false); }
    confirmAceptar.addEventListener('click', onAceptar);
    confirmCancelar.addEventListener('click', onCancelar);
  });
}
function confirmarModal(mensaje) { return mostrarDialogo(mensaje, true); }
function notificarModal(mensaje) { return mostrarDialogo(mensaje, false); }

// ---------- Tabs (solo visuales / atajos) ----------
document.querySelectorAll('.tab-pill').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    if (tab.dataset.tab === 'contactos') abrirModalAgregarContacto();
  });
});

// ---------- Sidebar: lista de contactos (siempre visible) ----------
const contactosList = document.getElementById('contactosList');

async function renderContactosSidebar() {
  const contactos = await apiFetch('/contactos?filtro=todos');
  if (!contactos) return;

  contactosList.innerHTML = '';
  if (contactos.length === 0) {
    contactosList.innerHTML = '<li class="text-secondary">Aún no tienes contactos.</li>';
    return;
  }

  contactos.forEach(c => {
    const li = document.createElement('li');
    li.className = 'contacto-item';
    li.innerHTML = `
      <i data-lucide="meh" width="16" height="16" class="contacto-icono"></i>
      <span class="contacto-telefono">${c.telefono}</span>
      <button data-id="${c.id}" data-action="ocultar" title="Ocultar"><i data-lucide="eye-off" width="14" height="14"></i></button>
      <button data-id="${c.id}" data-action="archivar" title="Archivar"><i data-lucide="archive" width="14" height="14"></i></button>
      <button data-id="${c.id}" data-action="eliminar" title="Eliminar"><i data-lucide="trash-2" width="14" height="14"></i></button>
      <button data-id="${c.id}" data-action="llamar" title="Llamar"><i data-lucide="phone" width="14" height="14"></i></button>
    `;
    contactosList.appendChild(li);
  });
  lucide.createIcons();
}

contactosList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.dataset.action === 'eliminar') {
    if (!(await confirmarModal('¿Eliminar este contacto?'))) return;
    await apiFetch(`/contactos/${id}`, { method: 'DELETE' });
    renderContactosSidebar();
  } else if (btn.dataset.action === 'ocultar') {
    await apiFetch(`/contactos/${id}`, { method: 'PATCH', body: JSON.stringify({ oculto: true }) });
    renderContactosSidebar();
  } else if (btn.dataset.action === 'archivar') {
    await apiFetch(`/contactos/${id}`, { method: 'PATCH', body: JSON.stringify({ archivado: true }) });
    renderContactosSidebar();
  } else if (btn.dataset.action === 'llamar') {
    const telefono = btn.closest('.contacto-item').querySelector('.contacto-telefono').textContent;
    notificarModal(`Llamando a ${telefono}... (demo, sin integración telefónica real)`);
  }
});

// ---------- Modal: Agregar contacto ----------
function abrirModalAgregarContacto() {
  abrirModal(`
    <h3><i data-lucide="user-plus" width="20" height="20"></i> Nuevo contacto</h3>
    <label for="mNombre">Nombre</label>
    <input type="text" id="mNombre" placeholder="Ingresa el nombre">
    <label for="mTelefono">Teléfono</label>
    <input type="tel" id="mTelefono" placeholder="+593 9XX XXX XXX">
    <button class="btn btn-success" id="mGuardarContacto" style="margin-top:18px;">
      <i data-lucide="check" width="16" height="16"></i> Agregar contacto
    </button>
  `);

  document.getElementById('mGuardarContacto').addEventListener('click', async () => {
    const nombre = document.getElementById('mNombre').value.trim();
    const telefono = document.getElementById('mTelefono').value.trim();
    if (!nombre || !telefono) {
      notificarModal('Ingresa nombre y teléfono.');
      return;
    }
    await apiFetch('/contactos', { method: 'POST', body: JSON.stringify({ nombre, telefono }) });
    cerrarModal();
    renderContactosSidebar();
  });
}

// ---------- Modal: Ocultos / Archivados ----------
async function abrirModalLista(filtro, titulo, icono, accionInversa) {
  const [contactos, recordatorios] = await Promise.all([
    apiFetch(`/contactos?filtro=${filtro}`),
    apiFetch(`/panel/recordatorios?filtro=${filtro}`),
  ]);

  const itemsContactos = (contactos || []).map(c => `
    <li class="contacto-item">
      <i data-lucide="meh" width="16" height="16" class="contacto-icono"></i>
      <span class="contacto-telefono">${c.telefono}</span>
      <button data-tipo="contacto" data-id="${c.id}" title="Restaurar"><i data-lucide="undo-2" width="14" height="14"></i></button>
    </li>
  `).join('');

  const itemsRecordatorios = (recordatorios || []).map(r => `
    <li class="contacto-item">
      <i data-lucide="bell" width="16" height="16" class="contacto-icono"></i>
      <span class="contacto-telefono">${escapeHTML(r.titulo)}</span>
      <button data-tipo="recordatorio" data-id="${r.id}" title="Restaurar"><i data-lucide="undo-2" width="14" height="14"></i></button>
    </li>
  `).join('');

  abrirModal(`
    <h3><i data-lucide="${icono}" width="20" height="20"></i> ${titulo}</h3>
    <p class="text-secondary" style="margin:12px 0 6px;">Contactos</p>
    <ul class="modal-list">
      ${itemsContactos || '<li class="text-secondary">No hay contactos aquí.</li>'}
    </ul>
    <p class="text-secondary" style="margin:16px 0 6px;">Recordatorios</p>
    <ul class="modal-list">
      ${itemsRecordatorios || '<li class="text-secondary">No hay recordatorios aquí.</li>'}
    </ul>
  `);

  modalContent.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const endpoint = btn.dataset.tipo === 'contacto'
        ? `/contactos/${btn.dataset.id}`
        : `/panel/recordatorios/${btn.dataset.id}`;
      await apiFetch(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ [accionInversa]: false }),
      });
      abrirModalLista(filtro, titulo, icono, accionInversa);
      renderContactosSidebar();
    });
  });
}

document.querySelector('[data-action="ver-ocultos"]').addEventListener('click', () => {
  abrirModalLista('ocultos', 'Ocultos', 'eye', 'oculto');
});
document.querySelector('[data-action="ver-archivados"]').addEventListener('click', () => {
  abrirModalLista('archivados', 'Archivados', 'archive', 'archivado');
});

// ---------- Modal: Editar perfil ----------
const perfilNombreEl = document.getElementById('perfilNombre');
const perfilAliasEl = document.getElementById('perfilAlias');

async function cargarPerfilSidebar() {
  const perfil = await apiFetch('/perfil');
  if (!perfil) return;
  perfilNombreEl.textContent = perfil.nombre_completo ? perfil.nombre_completo.toUpperCase() : perfil.usuario.toUpperCase();
  perfilAliasEl.textContent = perfil.alias || `@${perfil.usuario}`;
  return perfil;
}

document.querySelector('[data-action="editar-perfil"]').addEventListener('click', async () => {
  const perfil = await apiFetch('/perfil');
  abrirModal(`
    <h3><i data-lucide="at-sign" width="20" height="20"></i> Editar perfil</h3>
    <label for="mNombreCompleto">Nombre completo</label>
    <input type="text" id="mNombreCompleto" value="${perfil?.nombre_completo || ''}" placeholder="Ingresa tu nombre completo">
    <label for="mAlias">Alias</label>
    <input type="text" id="mAlias" value="${perfil?.alias || ''}" placeholder="Ingresa tu alias (ej. @usuario)">
    <button class="btn btn-success" id="mGuardarPerfil" style="margin-top:18px;">
      <i data-lucide="check" width="16" height="16"></i> Guardar
    </button>
  `);

  document.getElementById('mGuardarPerfil').addEventListener('click', async () => {
    const nombre_completo = document.getElementById('mNombreCompleto').value.trim();
    const alias = document.getElementById('mAlias').value.trim();
    if (!nombre_completo) { notificarModal('El nombre completo es obligatorio.'); return; }
    await apiFetch('/perfil', { method: 'PUT', body: JSON.stringify({ nombre_completo, alias }) });
    cerrarModal();
    cargarPerfilSidebar();
  });
});

// ---------- Modal: Configuración de correos ----------
document.querySelector('[data-action="config-correo"]').addEventListener('click', async () => {
  const config = await apiFetch('/configuracion');
  abrirModal(`
    <h3><i data-lucide="sliders-horizontal" width="20" height="20"></i> Configuración de correos</h3>
    <label for="mCorreo">Correo para notificaciones</label>
    <input type="email" id="mCorreo" value="${config?.correo_notificacion || ''}" placeholder="tu_correo@gmail.com">
    <label class="checkbox-label">
      <input type="checkbox" id="mNotificar" ${config?.notificar_por_correo ? 'checked' : ''}>
      Recibir avisos y recordatorios por correo
    </label>
    <button class="btn btn-success" id="mGuardarCorreo" style="margin-top:18px;">
      <i data-lucide="check" width="16" height="16"></i> Guardar
    </button>
  `);

  document.getElementById('mGuardarCorreo').addEventListener('click', async () => {
    const correo_notificacion = document.getElementById('mCorreo').value.trim();
    const notificar_por_correo = document.getElementById('mNotificar').checked;
    if (!correo_notificacion) { notificarModal('Ingresa un correo.'); return; }
    await apiFetch('/configuracion', { method: 'PUT', body: JSON.stringify({ correo_notificacion, notificar_por_correo }) });
    cerrarModal();
  });
});

// ---------- Botón "Guardar" general ----------
document.getElementById('btnGuardarGeneral').addEventListener('click', () => {
  notificarModal('Todo se guarda al confirmar dentro de cada ventana (Editar perfil, Configuración de correos, etc).');
});

// ---------- Iniciar sesión / Cerrar sesión ----------
let sesionActiva = false;
const btnSesion = document.getElementById('btnCerrarSesion');

function marcarSesionActiva() {
  sesionActiva = true;
  btnSesion.classList.remove('btn-success');
  btnSesion.classList.add('btn-danger');
  btnSesion.innerHTML = '<i data-lucide="log-out" width="16" height="16"></i> Cerrar sesión';
  lucide.createIcons();
}
function marcarSesionInactiva() {
  sesionActiva = false;
  btnSesion.classList.remove('btn-danger');
  btnSesion.classList.add('btn-success');
  btnSesion.innerHTML = '<i data-lucide="log-in" width="16" height="16"></i> Iniciar sesión';
  lucide.createIcons();
}

btnSesion.addEventListener('click', () => {
  if (sesionActiva) {
    marcarSesionInactiva();
  } else {
    abrirModalLogin();
  }
});

function abrirModalLogin() {
  abrirModal(`
    <div class="login-card-body">
      <div class="login-logo">
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round"/>
          <path d="M12 3v6l4-2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <label class="login-label" for="mUsuario">Nombre de usuario</label>
      <input class="login-input" type="text" id="mUsuario" placeholder="Ingresa tu usuario" autocomplete="username">
      <label class="login-label" for="mContrasena">Contraseña</label>
      <input class="login-input" type="password" id="mContrasena" placeholder="Ingresa tu contraseña" autocomplete="current-password">
      <p class="login-error hidden" id="loginError"></p>
      <button class="login-submit-btn estado-normal" id="mBtnLogin">Iniciar sesión</button>
      <div class="login-footer">
        <i data-lucide="info" width="14" height="14"></i>
        <span>@Copyright - 2026</span>
      </div>
    </div>
  `, 'login-modal');

  const inputUsuario = document.getElementById('mUsuario');
  const inputContrasena = document.getElementById('mContrasena');
  const btnLogin = document.getElementById('mBtnLogin');
  const errorBox = document.getElementById('loginError');

  function mostrarError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
    btnLogin.classList.remove('estado-normal');
    btnLogin.classList.add('estado-error');
  }
  function limpiarError() {
    errorBox.classList.add('hidden');
    btnLogin.classList.remove('estado-error');
    btnLogin.classList.add('estado-normal');
  }
  inputUsuario.addEventListener('input', limpiarError);
  inputContrasena.addEventListener('input', limpiarError);

  btnLogin.addEventListener('click', async () => {
    const usuario = inputUsuario.value.trim();
    const contrasena = inputContrasena.value.trim();

    if (!usuario) { mostrarError('Ingresa tu nombre de usuario.'); inputUsuario.focus(); return; }
    if (!contrasena) { mostrarError('Ingresa tu contraseña.'); inputContrasena.focus(); return; }

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, contrasena }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        mostrarError((data && data.error) || 'Usuario o contraseña incorrectos. Verifica los datos e inténtalo de nuevo.');
        return;
      }
      cerrarModal();
      marcarSesionActiva();
    } catch (err) {
      mostrarError('No se pudo conectar con el servidor. Verifica que la API esté corriendo.');
    }
  });
}

// ---------- Inicializar ----------
renderContactosSidebar();
cargarPerfilSidebar();