// =========================================================
// Control One — Perfil / Preferencias
// Gestión de Perfil, Contactos, Ocultos, Archivados y Configuración
// =========================================================

const API_BASE = 'http://127.0.0.1:5000/api';

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initTabs();
    initAccionesPrincipales();
    cargarPerfilSidebar();
    renderContactosSidebar();
});

/**
 * Función auxiliar para sanitizar cadenas HTML y prevenir XSS
 */
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

/**
 * Helper genérico para peticiones Fetch a la API de Python
 */
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
        console.error(`[API Error] en ${path}:`, err);
        return null;
    }
}

/* =========================================================
   GESTIÓN DE MODALES
   ========================================================= */

const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');
const modalCloseBtn = document.getElementById('modalClose');

function abrirModal(html) {
    if (!modalOverlay || !modalContent) return;
    modalContent.innerHTML = html;
    modalOverlay.classList.remove('hidden');
    lucide.createIcons();
}

function cerrarModal() {
    if (!modalOverlay || !modalContent) return;
    modalOverlay.classList.add('hidden');
    modalContent.innerHTML = '';
}

if (modalCloseBtn) modalCloseBtn.addEventListener('click', cerrarModal);

if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) cerrarModal();
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModal();
});

/* =========================================================
   NAVEGACIÓN POR TABS
   ========================================================= */

function initTabs() {
    document.querySelectorAll('.tab-pill').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-pill').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            if (tab.dataset.tab === 'contactos') {
                abrirModalAgregarContacto();
            }
        });
    });
}

/* =========================================================
   SIDEBAR: LISTA DE CONTACTOS Y PERFIL
   ========================================================= */

async function cargarPerfilSidebar() {
    const perfilNombreEl = document.getElementById('perfilNombre');
    const perfilAliasEl = document.getElementById('perfilAlias');
    
    const perfil = await apiFetch('/perfil');
    if (!perfil) return;

    if (perfilNombreEl) {
        perfilNombreEl.textContent = perfil.nombre_completo 
            ? perfil.nombre_completo.toUpperCase() 
            : (perfil.usuario ? perfil.usuario.toUpperCase() : 'USUARIO');
    }
    if (perfilAliasEl) {
        perfilAliasEl.textContent = perfil.alias || `@${perfil.usuario || 'alias'}`;
    }
}

async function renderContactosSidebar() {
    const contactosList = document.getElementById('contactosList');
    if (!contactosList) return;

    const contactos = await apiFetch('/contactos?filtro=todos');
    contactosList.innerHTML = '';

    if (!contactos || contactos.length === 0) {
        contactosList.innerHTML = '<li class="text-secondary" style="padding: 10px; opacity:0.7;">Aún no tienes contactos.</li>';
        return;
    }

    contactos.forEach(c => {
        const li = document.createElement('li');
        li.className = 'contacto-item';
        li.innerHTML = `
            <div class="contacto-info" style="display:flex; align-items:center; gap:8px; flex:1; overflow:hidden;">
                <i data-lucide="user" width="16" height="16" class="contacto-icono" style="flex-shrink:0;"></i>
                <div style="display:flex; flex-direction:column; overflow:hidden;">
                    <span class="contacto-nombre" style="font-weight:600; font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(c.nombre || 'Sin nombre')}</span>
                    <span class="contacto-telefono" style="font-size:0.8rem; opacity:0.8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(c.telefono)}</span>
                </div>
            </div>
            <div class="contacto-acciones" style="display:flex; gap:4px; flex-shrink:0;">
                <button data-id="${c.id}" data-action="ocultar" title="Ocultar"><i data-lucide="eye-off" width="14" height="14"></i></button>
                <button data-id="${c.id}" data-action="archivar" title="Archivar"><i data-lucide="archive" width="14" height="14"></i></button>
                <button data-id="${c.id}" data-action="eliminar" title="Eliminar"><i data-lucide="trash-2" width="14" height="14"></i></button>
                <button data-id="${c.id}" data-action="llamar" data-tel="${escapeHTML(c.telefono)}" title="Llamar"><i data-lucide="phone" width="14" height="14"></i></button>
            </div>
        `;
        contactosList.appendChild(li);
    });

    lucide.createIcons();
}

const contactosList = document.getElementById('contactosList');
if (contactosList) {
    contactosList.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-id]');
        if (!btn) return;

        const id = btn.dataset.id;
        const accion = btn.dataset.action;

        if (accion === 'eliminar') {
            if (!confirm('¿Deseas eliminar este contacto?')) return;
            await apiFetch(`/contactos/${id}`, { method: 'DELETE' });
            renderContactosSidebar();
        } else if (accion === 'ocultar') {
            await apiFetch(`/contactos/${id}`, { method: 'PATCH', body: JSON.stringify({ oculto: true }) });
            renderContactosSidebar();
        } else if (accion === 'archivar') {
            await apiFetch(`/contactos/${id}`, { method: 'PATCH', body: JSON.stringify({ archivado: true }) });
            renderContactosSidebar();
        } else if (accion === 'llamar') {
            const tel = btn.dataset.tel || 'este número';
            alert(`Llamando a ${tel}... (Simulación de llamada)`);
        }
    });
}

/* =========================================================
   ACCIONES PRINCIPALES Y MODALES FLOTANTES
   ========================================================= */

function initAccionesPrincipales() {
    const btnOcultos = document.querySelector('[data-action="ver-ocultos"]');
    const btnArchivados = document.querySelector('[data-action="ver-archivados"]');
    const btnEditarPerfil = document.querySelector('[data-action="editar-perfil"]');
    const btnConfigCorreo = document.querySelector('[data-action="config-correo"]');
    const btnGuardarGen = document.getElementById('btnGuardarGeneral');
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');

    if (btnOcultos) {
        btnOcultos.addEventListener('click', () => abrirModalLista('ocultos', 'Ocultos', 'eye', 'oculto'));
    }
    if (btnArchivados) {
        btnArchivados.addEventListener('click', () => abrirModalLista('archivados', 'Archivados', 'archive', 'archivado'));
    }
    if (btnEditarPerfil) {
        btnEditarPerfil.addEventListener('click', abrirModalEditarPerfil);
    }
    if (btnConfigCorreo) {
        btnConfigCorreo.addEventListener('click', abrirModalConfigCorreo);
    }
    if (btnGuardarGen) {
        btnGuardarGen.addEventListener('click', () => {
            alert('Los cambios se guardan automáticamente al confirmar en cada modal.');
        });
    }
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', abrirModalLogin);
    }
}

// 1. Modal: Agregar Contacto
function abrirModalAgregarContacto() {
    abrirModal(`
        <h3><i data-lucide="user-plus" width="20" height="20"></i> Nuevo contacto</h3>
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">
            <label for="mNombre">Nombre completo</label>
            <input type="text" id="mNombre" placeholder="Ej. Carlos Pérez" style="padding:8px; border-radius:6px; border:1px solid #ccc;">
            
            <label for="mTelefono">Teléfono</label>
            <input type="tel" id="mTelefono" placeholder="+593 9XX XXX XXX" style="padding:8px; border-radius:6px; border:1px solid #ccc;">
            
            <button class="btn btn-success" id="mGuardarContacto" style="margin-top:10px; padding:10px; cursor:pointer;">
                <i data-lucide="check" width="16" height="16"></i> Agregar contacto
            </button>
        </div>
    `);

    document.getElementById('mGuardarContacto').addEventListener('click', async () => {
        const nombre = document.getElementById('mNombre').value.trim();
        const telefono = document.getElementById('mTelefono').value.trim();
        if (!nombre || !telefono) {
            alert('Por favor ingresa un nombre y un número de teléfono.');
            return;
        }
        await apiFetch('/contactos', { method: 'POST', body: JSON.stringify({ nombre, telefono }) });
        cerrarModal();
        renderContactosSidebar();
    });
}

// 2. Modal: Ocultos y Archivados
async function abrirModalLista(filtro, titulo, icono, campoEstado) {
    const contactos = await apiFetch(`/contactos?filtro=${filtro}`) || [];
    const recordatorios = await apiFetch(`/panel/recordatorios?filtro=${filtro}`) || [];

    let itemsHTML = '';

    // Renderizar Contactos
    if (contactos.length > 0) {
        itemsHTML += `<p style="font-weight:bold; margin-top:10px; margin-bottom:8px; font-size:0.8rem; color:#6b7280; letter-spacing:0.05em; text-transform:uppercase;">CONTACTOS</p>`;
        itemsHTML += contactos.map(c => `
            <li class="modal-item-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(0, 0, 0, 0.03); border: 1px solid rgba(0, 0, 0, 0.08); border-radius: 14px; margin-bottom: 8px; box-sizing: border-box; width: 100%;">
                <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden; padding-right: 12px; flex: 1;">
                    <strong style="font-size: 0.9rem; color: #1e1b4b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(c.nombre || 'Contacto')}</strong>
                    <span style="font-size: 0.8rem; opacity: 0.75; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(c.telefono)}</span>
                </div>
                <button data-id="${c.id}" data-tipo="contacto" title="Restaurar" style="background: none; border: none; cursor: pointer; color: #10b981; padding: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.15s;">
                    <i data-lucide="undo-2" width="18" height="18"></i>
                </button>
            </li>
        `).join('');
    }

    // Renderizar Recordatorios/Eventos
    if (recordatorios.length > 0) {
        itemsHTML += `<p style="font-weight:bold; margin-top:14px; margin-bottom:8px; font-size:0.8rem; color:#6b7280; letter-spacing:0.05em; text-transform:uppercase;">RECORDATORIOS / EVENTOS</p>`;
        itemsHTML += recordatorios.map(r => `
            <li class="modal-item-card" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(0, 0, 0, 0.03); border: 1px solid rgba(0, 0, 0, 0.08); border-radius: 14px; margin-bottom: 8px; box-sizing: border-box; width: 100%;">
                <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden; padding-right: 12px; flex: 1;">
                    <strong style="font-size: 0.9rem; color: #1e1b4b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(r.titulo)}</strong>
                    <span style="font-size: 0.8rem; opacity: 0.75; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(r.subtitulo || 'Recordatorio programado')}</span>
                </div>
                <button data-id="${r.id}" data-tipo="recordatorio" title="Restaurar" style="background: none; border: none; cursor: pointer; color: #10b981; padding: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.15s;">
                    <i data-lucide="undo-2" width="18" height="18"></i>
                </button>
            </li>
        `).join('');
    }

    if (!itemsHTML) {
        itemsHTML = `<div style="padding: 24px; text-align: center; opacity: 0.7; font-size: 0.9rem;">No hay elementos en ${titulo.toLowerCase()}.</div>`;
    }

    abrirModal(`
        <h3 style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;"><i data-lucide="${icono}" width="20" height="20"></i> Elementos ${titulo}</h3>
        <ul class="modal-list" style="list-style: none; padding: 4px; margin: 0; max-height: 320px; overflow-y: auto; box-sizing: border-box;">
            ${itemsHTML}
        </ul>
    `);

    modalContent.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const tipo = btn.dataset.tipo;

            if (tipo === 'contacto') {
                await apiFetch(`/contactos/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ [campoEstado]: false }),
                });
            } else if (tipo === 'recordatorio') {
                await apiFetch(`/panel/recordatorios/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ [campoEstado]: false }),
                });
            }

            abrirModalLista(filtro, titulo, icono, campoEstado);
            renderContactosSidebar();
        });
    });
}

// 3. Modal: Editar Perfil
async function abrirModalEditarPerfil() {
    const perfil = await apiFetch('/perfil');
    abrirModal(`
        <h3><i data-lucide="at-sign" width="20" height="20"></i> Editar perfil</h3>
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">
            <label for="mNombreCompleto">Nombre completo</label>
            <input type="text" id="mNombreCompleto" value="${escapeHTML(perfil?.nombre_completo || '')}" placeholder="Ej. Pedro Sánchez" style="padding:8px; border-radius:6px; border:1px solid #ccc;">
            
            <label for="mAlias">Alias</label>
            <input type="text" id="mAlias" value="${escapeHTML(perfil?.alias || '')}" placeholder="@Alias_guacho" style="padding:8px; border-radius:6px; border:1px solid #ccc;">
            
            <button class="btn btn-success" id="mGuardarPerfil" style="margin-top:10px; padding:10px; cursor:pointer;">
                <i data-lucide="check" width="16" height="16"></i> Guardar cambios
            </button>
        </div>
    `);

    document.getElementById('mGuardarPerfil').addEventListener('click', async () => {
        const nombre_completo = document.getElementById('mNombreCompleto').value.trim();
        const alias = document.getElementById('mAlias').value.trim();

        if (!nombre_completo) {
            alert('El nombre completo es obligatorio.');
            return;
        }

        await apiFetch('/perfil', { method: 'PUT', body: JSON.stringify({ nombre_completo, alias }) });
        cerrarModal();
        cargarPerfilSidebar();
    });
}

// 4. Modal: Configuración de Correos
async function abrirModalConfigCorreo() {
    const config = await apiFetch('/configuracion');
    abrirModal(`
        <h3><i data-lucide="sliders-horizontal" width="20" height="20"></i> Configuración de correos</h3>
        <div style="display:flex; flex-direction:column; gap:12px; margin-top:12px;">
            <label for="mCorreo">Correo para notificaciones</label>
            <input type="email" id="mCorreo" value="${escapeHTML(config?.correo_notificacion || '')}" placeholder="tu_correo@gmail.com" style="padding:8px; border-radius:6px; border:1px solid #ccc;">
            
            <label class="checkbox-label" style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.9rem;">
                <input type="checkbox" id="mNotificar" ${config?.notificar_por_correo ? 'checked' : ''}>
                Recibir avisos y recordatorios por correo
            </label>
            
            <button class="btn btn-success" id="mGuardarCorreo" style="margin-top:10px; padding:10px; cursor:pointer;">
                <i data-lucide="check" width="16" height="16"></i> Guardar configuración
            </button>
        </div>
    `);

    document.getElementById('mGuardarCorreo').addEventListener('click', async () => {
        const correo_notificacion = document.getElementById('mCorreo').value.trim();
        const notificar_por_correo = document.getElementById('mNotificar').checked;

        if (!correo_notificacion) {
            alert('Por favor ingresa un correo electrónico válido.');
            return;
        }

        await apiFetch('/configuracion', { method: 'PUT', body: JSON.stringify({ correo_notificacion, notificar_por_correo }) });
        cerrarModal();
    });
}

// 5. Modal: Inicio de Sesión
function abrirModalLogin() {
    abrirModal(`
        <h3><i data-lucide="log-in" width="20" height="20"></i> Iniciar sesión</h3>
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;">
            <label for="mUsuario">Nombre de usuario</label>
            <input type="text" id="mUsuario" placeholder="Ej. pedro123" autocomplete="username" style="padding:8px; border-radius:6px; border:1px solid #ccc;">
            
            <label for="mContrasena">Contraseña</label>
            <input type="password" id="mContrasena" placeholder="••••••••" autocomplete="current-password" style="padding:8px; border-radius:6px; border:1px solid #ccc;">
            
            <button class="btn btn-success" id="mBtnLogin" style="margin-top:10px; padding:10px; cursor:pointer;" disabled>
                <i data-lucide="check" width="16" height="16"></i> Iniciar sesión
            </button>
        </div>
    `);

    const inputUsuario = document.getElementById('mUsuario');
    const inputContrasena = document.getElementById('mContrasena');
    const btnLogin = document.getElementById('mBtnLogin');

    function revisarCampos() {
        btnLogin.disabled = !(inputUsuario.value.trim() && inputContrasena.value.trim());
    }

    inputUsuario.addEventListener('input', revisarCampos);
    inputContrasena.addEventListener('input', revisarCampos);

    btnLogin.addEventListener('click', async () => {
        const usuario = inputUsuario.value.trim();
        const contrasena = inputContrasena.value.trim();

        try {
            const data = await apiFetch('/login', {
                method: 'POST',
                body: JSON.stringify({ usuario, contrasena })
            });

            if (data && data.usuario) {
                alert(`Sesión iniciada correctamente como ${data.usuario}.`);
                cerrarModal();
                cargarPerfilSidebar();
            } else {
                alert('Credenciales incorrectas o error al iniciar sesión.');
            }
        } catch (err) {
            alert('No se pudo conectar con el servidor.');
        }
    });
}