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
    alert('No se pudo conectar con el servidor. ¿Está corriendo "python app.py" en la carpeta /api?\n\n' + err.message);
    throw err;
  }
}

// ---------- Modal genérico ----------
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');

function abrirModal(html) {
  modalContent.innerHTML = html;
  modalOverlay.classList.remove('hidden');
  lucide.createIcons();
}
function cerrarModal() {
  modalOverlay.classList.add('hidden');
  modalContent.innerHTML = '';
}
document.getElementById('modalClose').addEventListener('click', cerrarModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) cerrarModal(); });

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
    if (!confirm('¿Eliminar este contacto?')) return;
    await apiFetch(`/contactos/${id}`, { method: 'DELETE' });
    renderContactosSidebar();
  } else if (btn.dataset.action === 'llamar') {
    const telefono = btn.closest('.contacto-item').querySelector('.contacto-telefono').textContent;
    alert(`Llamando a ${telefono}... (demo, sin integración telefónica real)`);
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
      alert('Ingresa nombre y teléfono.');
      return;
    }
    await apiFetch('/contactos', { method: 'POST', body: JSON.stringify({ nombre, telefono }) });
    cerrarModal();
    renderContactosSidebar();
  });
}

// ---------- Modal: Ocultos / Archivados ----------
async function abrirModalLista(filtro, titulo, icono, accionInversa) {
  const contactos = await apiFetch(`/contactos?filtro=${filtro}`);
  const items = (contactos || []).map(c => `
    <li class="contacto-item">
      <i data-lucide="meh" width="16" height="16" class="contacto-icono"></i>
      <span class="contacto-telefono">${c.telefono}</span>
      <button data-id="${c.id}" title="Restaurar"><i data-lucide="undo-2" width="14" height="14"></i></button>
    </li>
  `).join('');

  abrirModal(`
    <h3><i data-lucide="${icono}" width="20" height="20"></i> ${titulo}</h3>
    <ul class="modal-list">
      ${items || '<li class="text-secondary">No hay contactos aquí.</li>'}
    </ul>
  `);

  modalContent.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await apiFetch(`/contactos/${btn.dataset.id}`, {
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
    if (!nombre_completo) { alert('El nombre completo es obligatorio.'); return; }
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
    if (!correo_notificacion) { alert('Ingresa un correo.'); return; }
    await apiFetch('/configuracion', { method: 'PUT', body: JSON.stringify({ correo_notificacion, notificar_por_correo }) });
    cerrarModal();
  });
});

// ---------- Botón "Guardar" general y "Cerrar sesión" ----------
document.getElementById('btnGuardarGeneral').addEventListener('click', () => {
  alert('Todo se guarda al confirmar dentro de cada ventana (Editar perfil, Configuración de correos, etc).');
});

document.getElementById('btnCerrarSesion').addEventListener('click', () => {
  if (confirm('¿Cerrar sesión?')) {
    window.location.href = 'login.html'; // ajusta a la ruta real del login de tu equipo
  }
});

// ---------- Inicializar ----------
renderContactosSidebar();
cargarPerfilSidebar();