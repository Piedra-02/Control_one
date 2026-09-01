/**
 * Control One - Interacción Frontend para Panel Principal
 * Incluye gestión de Tarjetas Modales para Crear, Modificar y Eliminar
 * Tareas, Eventos y Recordatorios en la misma pantalla.
 */

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initNavScroll();
    initTaskCheckboxes();
    initTaskClickToEdit();
    initEventClickToEdit();
    initReminderClickToEdit();
    initLiveSearch();
    initReminderStars();
    initMobileCollapsibles();

    // Cargar datos sincronizados de LocalStorage / Backend
    cargarDatosLocales();
    sincronizarConBackendPython();
});

/**
 * Desplazamiento suave para los botones de navegación
 */
function initNavScroll() {
    const navLinks = document.querySelectorAll('.subnav-btn, .nav-pill');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('href');
            if (targetId && targetId.startsWith('#')) {
                e.preventDefault();
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                const targetElem = document.querySelector(targetId);
                if (targetElem) {
                    targetElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    });
}

/**
 * Checkbox interactivo en las tarjetas de tareas
 */
function initTaskCheckboxes() {
    const checkboxes = document.querySelectorAll('.task-item-card input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            const card = e.target.closest('.task-item-card');
            const taskId = card.getAttribute('data-task-id');
            const isChecked = e.target.checked;

            if (isChecked) {
                card.classList.remove('completed');
            } else {
                card.classList.add('completed');
            }

            if (taskId) {
                fetch('http://127.0.0.1:5000/api/panel/tareas/estado', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: taskId,
                        estado: isChecked ? 'pendiente' : 'completada'
                    })
                }).catch(() => {});
            }
        });
    });
}

/**
 * Al hacer clic en una tarea se abre el modal para modificar o eliminar
 */
function initTaskClickToEdit() {
    const taskCards = document.querySelectorAll('.task-item-card');
    taskCards.forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
            if (e.target.closest('.task-check-wrapper')) return;
            const taskId = card.getAttribute('data-task-id');
            const textElem = card.querySelector('.task-item-text');
            const taskText = textElem ? textElem.textContent.trim() : '';
            abrirModalTarea(taskId, taskText);
        });
    });

    const tasksHeader = document.querySelector('.section-tareas .section-heading');
    if (tasksHeader) {
        tasksHeader.style.cursor = 'pointer';
        tasksHeader.addEventListener('click', () => abrirModalTarea());
    }
}

/**
 * Al hacer clic en eventos se abre modal de eventos
 */
function initEventClickToEdit() {
    const addBox = document.getElementById('btn-add-event-box');
    if (addBox) {
        addBox.addEventListener('click', () => abrirModalEvento());
    }

    const eventCards = document.querySelectorAll('.event-main-card');
    eventCards.forEach(eventCard => {
        eventCard.style.cursor = 'pointer';
        eventCard.addEventListener('click', () => {
            const id = eventCard.getAttribute('data-event-id');
            const titulo = eventCard.querySelector('.event-card-header h3')?.textContent || '';
            const descripcion = eventCard.getAttribute('data-descripcion') || '';
            const fecha = eventCard.getAttribute('data-fecha-iso') || '';
            abrirModalEvento(id, { titulo, descripcion, fecha });
        });
    });
}

/**
 * Al hacer clic en recordatorios se abre modal de recordatorios
 */
function initReminderClickToEdit() {
    const remCards = document.querySelectorAll('.reminder-item-card');
    remCards.forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
            if (e.target.closest('.reminder-star-icon')) return;
            const id = card.getAttribute('data-reminder-id');
            const tit = card.querySelector('h4') ? card.querySelector('h4').textContent : '';
            const sub = card.querySelector('p') ? card.querySelector('p').textContent : '';
            const hora = card.querySelector('.time-capsule span') ? card.querySelector('.time-capsule span').textContent : '18:00';
            abrirModalRecordatorio(id, { titulo: tit, subtitulo: sub, hora: hora });
        });
    });
}

/* =========================================================
   FUNCIONES DE TARJETAS MODALES (UI POPUP EN LA MISMA PANTALLA)
   ========================================================= */

function cerrarModales() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('active');
    document.querySelectorAll('.modal-card').forEach(m => m.classList.remove('active'));
}

// Cerrar con Escape o clic fuera
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModales();
});

const overlayElem = document.getElementById('modal-overlay');
if (overlayElem) {
    overlayElem.addEventListener('click', (e) => {
        if (e.target === overlayElem) cerrarModales();
    });
}

// 1. MODAL TAREA
function abrirModalTarea(id = null, texto = '') {
    cerrarModales();
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-tarea');
    const tit = document.getElementById('modal-tarea-titulo');
    const inputId = document.getElementById('input-tarea-id');
    const inputTexto = document.getElementById('input-tarea-texto');
    const btnEliminar = document.getElementById('btn-eliminar-tarea');

    if (id) {
        tit.textContent = 'Modificar Tarea';
        inputId.value = id;
        inputTexto.value = texto;
        btnEliminar.style.display = 'inline-block';
    } else {
        tit.textContent = 'Nueva Tarea';
        inputId.value = '';
        inputTexto.value = '';
        btnEliminar.style.display = 'none';
    }

    overlay.classList.add('active');
    modal.classList.add('active');
    inputTexto.focus();
}

function guardarTareaModal(e) {
    e.preventDefault();
    const id = document.getElementById('input-tarea-id').value;
    const texto = document.getElementById('input-tarea-texto').value.trim();

    if (!texto) return;

    if (id) {
        // Modificar existente: actualizar visualmente y guardar en la BD
        const card = document.querySelector(`.task-item-card[data-task-id="${id}"]`);
        if (card) {
            const textElem = card.querySelector('.task-item-text');
            if (textElem) textElem.textContent = texto;
        }

        fetch(`http://127.0.0.1:5000/api/panel/tareas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titulo: texto })
        }).catch(() => {});
    } else {
        // Crear nueva en la base de datos, luego refrescar con el id real
        fetch('http://127.0.0.1:5000/api/panel/tareas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titulo: texto })
        })
            .then(() => sincronizarConBackendPython())
            .catch(() => {});
    }

    cerrarModales();
}

function eliminarTareaModal() {
    const id = document.getElementById('input-tarea-id').value;
    if (!id) return;

    if (confirm('¿Deseas eliminar esta tarea?')) {
        fetch(`http://127.0.0.1:5000/api/panel/tareas/${id}`, { method: 'DELETE' })
            .then(() => sincronizarConBackendPython())
            .catch(() => {});
        cerrarModales();
    }
}

// 2. MODAL EVENTO
function abrirModalEvento(id = null, datos = {}) {
    cerrarModales();
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-evento');
    const tit = document.getElementById('modal-evento-titulo');
    const inputId = document.getElementById('input-evento-id');
    const inputNom = document.getElementById('input-evento-nombre');
    const inputDesc = document.getElementById('input-evento-desc');
    const inputFecha = document.getElementById('input-evento-fecha');
    const inputCat = document.getElementById('input-evento-categoria');
    const btnEliminar = document.getElementById('btn-eliminar-evento');

    if (id) {
        tit.textContent = 'Modificar Evento';
        inputId.value = id;
        inputNom.value = datos.titulo || '';
        inputDesc.value = datos.descripcion || '';
        inputFecha.value = datos.fecha || '2026-08-30';
        inputCat.value = datos.categoria || 'Familia';
        btnEliminar.style.display = 'inline-block';
    } else {
        tit.textContent = 'Nuevo Evento';
        inputId.value = '';
        inputNom.value = '';
        inputDesc.value = '';
        inputFecha.value = new Date().toISOString().split('T')[0];
        inputCat.value = 'General';
        btnEliminar.style.display = 'none';
    }

    overlay.classList.add('active');
    modal.classList.add('active');
    inputNom.focus();
}

function guardarEventoModal(e) {
    e.preventDefault();
    const id = document.getElementById('input-evento-id').value;
    const nombre = document.getElementById('input-evento-nombre').value.trim();
    const desc = document.getElementById('input-evento-desc').value.trim();
    const fecha = document.getElementById('input-evento-fecha').value;

    if (!nombre) return;

    const eventoAGuardar = { id: id || null, titulo: nombre, descripcion: desc, fecha: fecha };

    // Persistir en LocalStorage para sincronizar con Organización
    guardarEventoEnStorage(eventoAGuardar);

    // Se usa el endpoint de Organización porque acepta fecha simple
    // (YYYY-MM-DD) y ya sabe crear o modificar según si mandamos id.
    fetch('http://127.0.0.1:5000/api/organizacion/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventoAGuardar)
    })
        .then(() => sincronizarConBackendPython())
        .catch(() => {});

    cerrarModales();
}

function eliminarEventoModal() {
    const id = document.getElementById('input-evento-id').value;
    if (!id) return;

    if (confirm('¿Eliminar este evento?')) {
        fetch('http://127.0.0.1:5000/api/organizacion/eventos/eliminar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        })
            .then(() => sincronizarConBackendPython())
            .catch(() => {});

        cerrarModales();
    }
}

// 3. MODAL RECORDATORIO
function abrirModalRecordatorio(id = null, datos = {}) {
    cerrarModales();
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-recordatorio');
    const tit = document.getElementById('modal-recordatorio-titulo');
    const inputId = document.getElementById('input-recordatorio-id');
    const inputNom = document.getElementById('input-recordatorio-nombre');
    const inputSub = document.getElementById('input-recordatorio-sub');
    const inputHora = document.getElementById('input-recordatorio-hora');
    const btnEliminar = document.getElementById('btn-eliminar-recordatorio');

    if (id) {
        tit.textContent = 'Modificar Recordatorio';
        inputId.value = id;
        inputNom.value = datos.titulo || '';
        inputSub.value = datos.subtitulo || '';
        inputHora.value = datos.hora || '18:00';
        btnEliminar.style.display = 'inline-block';
    } else {
        tit.textContent = 'Nuevo Recordatorio';
        inputId.value = '';
        inputNom.value = '';
        inputSub.value = '';
        inputHora.value = '18:00';
        btnEliminar.style.display = 'none';
    }

    overlay.classList.add('active');
    modal.classList.add('active');
    inputNom.focus();
}

function guardarRecordatorioModal(e) {
    e.preventDefault();
    const id = document.getElementById('input-recordatorio-id').value;
    const nombre = document.getElementById('input-recordatorio-nombre').value.trim();
    const sub = document.getElementById('input-recordatorio-sub').value.trim();
    const hora = document.getElementById('input-recordatorio-hora').value;

    if (!nombre) return;

    if (id) {
        const card = document.querySelector(`.reminder-item-card[data-reminder-id="${id}"]`);
        if (card) {
            const h4 = card.querySelector('h4');
            const p = card.querySelector('p');
            const timeSpan = card.querySelector('.time-capsule span');
            if (h4) h4.textContent = nombre;
            if (p) p.textContent = sub;
            if (timeSpan) timeSpan.textContent = hora;
        }

        // Nota: solo el título se guarda en la base de datos (la tabla
        // 'recordatorios' no tiene columna de subtítulo, y cambiar solo
        // la hora sin la fecha completa podría desordenar el envío por
        // Gmail, así que esos dos campos quedan únicamente visuales).
        fetch(`http://127.0.0.1:5000/api/panel/recordatorios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titulo: nombre })
        }).catch(() => {});
    }

    cerrarModales();
}

function eliminarRecordatorioModal() {
    const id = document.getElementById('input-recordatorio-id').value;
    if (!id) return;

    if (confirm('¿Eliminar este recordatorio?')) {
        fetch(`http://127.0.0.1:5000/api/panel/recordatorios/${id}`, { method: 'DELETE' })
            .then(() => sincronizarConBackendPython())
            .catch(() => {});
        cerrarModales();
    }
}

/**
 * Sincronización LocalStorage entre Panel Principal y Organización
 */
function guardarEventoEnStorage(evento) {
    let eventos = JSON.parse(localStorage.getItem('control_one_eventos') || '[]');
    const idx = eventos.findIndex(e => e.id === evento.id);
    if (idx >= 0) {
        eventos[idx] = evento;
    } else {
        eventos.push(evento);
    }
    localStorage.setItem('control_one_eventos', JSON.stringify(eventos));
}

function cargarDatosLocales() {
    const eventos = JSON.parse(localStorage.getItem('control_one_eventos') || '[]');
    if (eventos.length > 0) {
        const ultimo = eventos[eventos.length - 1];
        const eventCard = document.querySelector('.event-main-card');
        if (eventCard && ultimo) {
            const tit = eventCard.querySelector('.event-card-header h3');
            if (tit) tit.textContent = ultimo.titulo;
        }
    }
}

/**
 * Búsqueda en vivo
 */
function initLiveSearch() {
    const desktopSearch = document.getElementById('desktop-search-input');
    const mobileSearchBtn = document.getElementById('mobile-search-trigger');

    function ejecutarBusqueda(query) {
        const q = query.toLowerCase().trim();
        const cards = document.querySelectorAll('.task-item-card, .reminder-item-card, .event-main-card');

        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            if (!q || text.includes(q)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    }

    if (desktopSearch) {
        desktopSearch.addEventListener('input', (e) => {
            ejecutarBusqueda(e.target.value);
        });
    }

    if (mobileSearchBtn) {
        mobileSearchBtn.addEventListener('click', () => {
            const q = prompt('Buscar tareas, eventos o recordatorios:');
            if (q !== null) {
                ejecutarBusqueda(q);
            }
        });
    }
}

/**
 * Alternar estrella en los recordatorios
 */
function initReminderStars() {
    const starButtons = document.querySelectorAll('.reminder-star-icon');

    starButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            btn.classList.toggle('active');
            const svg = btn.querySelector('svg polygon');
            if (btn.classList.contains('active')) {
                svg.setAttribute('fill', '#eab308');
                svg.setAttribute('stroke', '#ca8a04');
            } else {
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', 'currentColor');
            }
        });
    });
}

/**
 * Colapsables opcionales en móvil
 */
function initMobileCollapsibles() {
    const chevrons = document.querySelectorAll('.mobile-chevron');

    chevrons.forEach(chevron => {
        chevron.addEventListener('click', () => {
            const section = chevron.closest('.section-container');
            const content = section.querySelector('.events-content-box, .tasks-orange-box, .reminders-green-box');
            if (content) {
                const isHidden = content.style.display === 'none';
                content.style.display = isHidden ? '' : 'none';
                chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
                chevron.style.transition = 'transform 0.2s ease';
            }
        });
    });
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

async function sincronizarConBackendPython() {
    try {
        const respuesta = await fetch('http://127.0.0.1:5000/api/panel/resumen', {
            signal: AbortSignal.timeout(1500)
        });
        if (!respuesta.ok) return;
        const data = await respuesta.json();
        console.log('[Control One] Sincronizado con Python:', data);
        renderizarDesdeBackend(data);
    } catch (e) {}
}

/**
 * Reemplaza las tarjetas de ejemplo (tareas, recordatorios, eventos)
 * por las que realmente existen en la base de datos, usando la misma
 * estructura y clases CSS que ya tenía el diseño original.
 */
function renderizarDesdeBackend(data) {
    // --- TAREAS ---
    const tasksGrid = document.querySelector('.tasks-grid');
    if (tasksGrid && Array.isArray(data.tareas) && data.tareas.length > 0) {
        tasksGrid.innerHTML = data.tareas.map(t => `
            <article class="task-item-card${t.estado === 'completada' ? ' completed' : ''}" data-task-id="${t.id}">
                <label class="task-check-wrapper">
                    <input type="checkbox" ${t.estado === 'completada' ? 'checked' : ''}>
                    <span class="custom-checkmark">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </span>
                </label>
                <span class="task-item-text">${escapeHTML(t.titulo)}</span>
            </article>
        `).join('');
    }

    // --- RECORDATORIOS ---
    const remindersGrid = document.querySelector('.reminders-grid');
    if (remindersGrid && Array.isArray(data.recordatorios) && data.recordatorios.length > 0) {
        remindersGrid.innerHTML = data.recordatorios.map(r => `
            <article class="reminder-item-card" data-reminder-id="${r.id}">
                <div class="reminder-top-row">
                    <div class="reminder-tag-icon">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                            <line x1="7" y1="7" x2="7.01" y2="7"></line>
                        </svg>
                    </div>
                    <button class="reminder-star-icon" title="Destacar">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                    </button>
                </div>
                <div class="reminder-center-content">
                    <h4>${escapeHTML(r.titulo)}</h4>
                    <p>${escapeHTML(r.subtitulo || 'Recordatorio programado')}</p>
                </div>
                <div class="reminder-bottom-time">
                    <div class="time-capsule">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>${r.hora_formateada || ''}</span>
                    </div>
                </div>
            </article>
        `).join('');
    }

    // --- EVENTOS (se conserva el cuadro "+" para agregar uno nuevo) ---
    const eventsGrid = document.querySelector('.events-grid');
    if (eventsGrid && Array.isArray(data.eventos) && data.eventos.length > 0) {
        const addBox = document.getElementById('btn-add-event-box');
        eventsGrid.innerHTML = '';
        if (addBox) eventsGrid.appendChild(addBox);

        data.eventos.forEach(ev => {
            const fecha = ev.fecha_inicio ? new Date(ev.fecha_inicio) : null;
            const fechaTexto = fecha ? fecha.toLocaleDateString('es-EC') : '';
            const fechaIso = ev.fecha || (ev.fecha_inicio ? ev.fecha_inicio.split('T')[0] : '');
            eventsGrid.insertAdjacentHTML('beforeend', `
                <article class="event-main-card" data-event-id="${ev.id}" data-fecha-iso="${fechaIso}" data-descripcion="${escapeHTML(ev.descripcion || '')}">
                    <div class="event-card-header">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <h3>${escapeHTML(ev.titulo)}</h3>
                    </div>
                    <div class="event-card-body">
                        <div class="event-desc-col"><p>${escapeHTML(ev.descripcion || '')}</p></div>
                        <div class="event-separator"></div>
                        <div class="event-info-col">
                            <p class="event-status-text">Tienes un evento</p>
                            <p class="event-status-text">pendiente el</p>
                            <p class="event-date-text">${fechaTexto}</p>
                        </div>
                    </div>
                </article>
            `);
        });
    }

    // Volver a activar los clics/checkboxes sobre las tarjetas nuevas
    initTaskCheckboxes();
    initTaskClickToEdit();
    initEventClickToEdit();
    initReminderClickToEdit();
    initReminderStars();
}