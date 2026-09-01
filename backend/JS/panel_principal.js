

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

    cargarDatosLocales();
    sincronizarConBackendPython();
});

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

function initTaskCheckboxes() {
    const checkboxes = document.querySelectorAll('.task-item-card input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            const card = e.target.closest('.task-item-card');
            const taskId = card ? card.getAttribute('data-task-id') : null;
            const isChecked = e.target.checked;

            if (card) {
                if (isChecked) {
                    card.classList.remove('completed');
                } else {
                    card.classList.add('completed');
                }
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

function initReminderClickToEdit() {
    const remCards = document.querySelectorAll('.reminder-item-card');
    remCards.forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
            if (e.target.closest('.reminder-star-icon') || e.target.closest('.reminder-flag-btn')) return;
            const id = card.getAttribute('data-reminder-id');
            const tit = card.querySelector('h4') ? card.querySelector('h4').textContent : '';
            const sub = card.querySelector('p') ? card.querySelector('p').textContent : '';
            const hora = card.querySelector('.time-capsule span') ? card.querySelector('.time-capsule span').textContent : '18:00';
            abrirModalRecordatorio(id, { titulo: tit, subtitulo: sub, hora: hora });
        });
    });
}

function cerrarModales() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('active');
    document.querySelectorAll('.modal-card').forEach(m => m.classList.remove('active'));
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModales();
});

const overlayElem = document.getElementById('modal-overlay');
if (overlayElem) {
    overlayElem.addEventListener('click', (e) => {
        if (e.target === overlayElem) cerrarModales();
    });
}

function abrirModalTarea(id = null, texto = '') {
    cerrarModales();
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-tarea');
    const tit = document.getElementById('modal-tarea-titulo');
    const inputId = document.getElementById('input-tarea-id');
    const inputTexto = document.getElementById('input-tarea-texto');
    const btnEliminar = document.getElementById('btn-eliminar-tarea');
    const selectCat = document.getElementById('input-tarea-categoria');

    if (selectCat) {
        selectCat.innerHTML = '<option value="">DESCONOCIDA</option>';
        const cats = JSON.parse(localStorage.getItem('control_one_categorias_list') || '[]');
        cats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nombre;
            selectCat.appendChild(opt);
        });
    }

    if (id) {
        tit.textContent = 'Modificar Tarea';
        inputId.value = id;
        inputTexto.value = texto;
        btnEliminar.style.display = 'inline-block';
        const tareas = JSON.parse(localStorage.getItem('control_one_tareas_list') || '[]');
        const tarea = tareas.find(t => String(t.id) === String(id));
        if (tarea && selectCat) selectCat.value = tarea.categoria_id || '';
    } else {
        tit.textContent = 'Nueva Tarea';
        inputId.value = '';
        inputTexto.value = '';
        btnEliminar.style.display = 'none';
        if (selectCat) selectCat.value = '';
    }

    overlay.classList.add('active');
    modal.classList.add('active');
    inputTexto.focus();
}

function guardarTareaModal(e) {
    e.preventDefault();
    const id = document.getElementById('input-tarea-id').value;
    const texto = document.getElementById('input-tarea-texto').value.trim();
    const categoriaId = document.getElementById('input-tarea-categoria')?.value || '';

    if (!texto) return;

    let tareas = JSON.parse(localStorage.getItem('control_one_tareas_list') || '[]');

    if (id) {
        const tarea = tareas.find(t => String(t.id) === String(id));
        if (tarea) {
            tarea.titulo = texto;
            tarea.categoria_id = categoriaId || null;
        }

        const card = document.querySelector(`.task-item-card[data-task-id="${id}"]`);
        if (card) {
            const textElem = card.querySelector('.task-item-text');
            if (textElem) textElem.textContent = texto;
        }

        fetch(`http://127.0.0.1:5000/api/panel/tareas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titulo: texto, categoria_id: categoriaId })
        }).catch(() => {});
    } else {
        let nueva = {
            id: 'tp_' + Date.now(),
            titulo: texto,
            categoria_id: categoriaId || null,
            prioridad: document.getElementById('input-tarea-prioridad')?.value || 'media',
            estado: 'pendiente'
        };

        if (typeof evaluarAutomatizaciones === 'function') {
            nueva = evaluarAutomatizaciones('Tareas', nueva);
        }

        tareas.push(nueva);

        fetch('http://127.0.0.1:5000/api/panel/tareas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nueva)
        })
            .then(() => sincronizarConBackendPython())
            .catch(() => {});
    }

    localStorage.setItem('control_one_tareas_list', JSON.stringify(tareas));
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

    guardarEventoEnStorage(eventoAGuardar);

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
        
        let eventos = JSON.parse(localStorage.getItem('control_one_eventos') || '[]');
        eventos = eventos.filter(e => String(e.id) !== String(id));
        localStorage.setItem('control_one_eventos', JSON.stringify(eventos));

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
        const hoy = new Date().toISOString().split('T')[0];
        let eventoMostrar = eventos.find(e => e.fecha === hoy);
        if (!eventoMostrar) {
            const futuros = eventos.filter(e => e.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
            eventoMostrar = futuros[0] || eventos[eventos.length - 1];
        }
        const eventCard = document.querySelector('.event-main-card');
        if (eventCard && eventoMostrar) {
            eventCard.setAttribute('data-event-id', eventoMostrar.id);
            const tit = eventCard.querySelector('.event-card-header h3');
            if (tit) tit.textContent = eventoMostrar.titulo;
            const desc = eventCard.querySelector('.event-card-text');
            if (desc) desc.textContent = eventoMostrar.descripcion || '';
            const fecha = eventCard.querySelector('.event-card-date');
            if (fecha) fecha.textContent = eventoMostrar.fecha || '';
            let imgElem = eventCard.querySelector('.event-card-img');
            if (eventoMostrar.imagen) {
                if (!imgElem) {
                    imgElem = document.createElement('img');
                    imgElem.className = 'event-card-img';
                    imgElem.style.cssText = 'max-height:80px; border-radius:8px; object-fit:cover; margin-top:8px;';
                    eventCard.appendChild(imgElem);
                }
                imgElem.src = eventoMostrar.imagen;
                imgElem.alt = eventoMostrar.titulo;
            } else if (imgElem) {
                imgElem.remove();
            }
        }
    }
}

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

function initReminderStars() {
    const starButtons = document.querySelectorAll('.reminder-star-icon');

    starButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            btn.classList.toggle('active');
            const svg = btn.querySelector('svg polygon');
            if (svg) {
                if (btn.classList.contains('active')) {
                    svg.setAttribute('fill', '#eab308');
                    svg.setAttribute('stroke', '#ca8a04');
                } else {
                    svg.setAttribute('fill', 'none');
                    svg.setAttribute('stroke', 'currentColor');
                }
            }
        });
    });
}

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
    if (!str) return '';
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

function renderizarDesdeBackend(data) {
    
    const tasksGrid = document.querySelector('.tasks-grid');
    if (tasksGrid) {
        if (Array.isArray(data.tareas) && data.tareas.length > 0) {
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
        } else {
            tasksGrid.innerHTML = `<div class="empty-state-card" style="padding: 15px; opacity: 0.7;"><p>Sin tareas pendientes</p></div>`;
        }
    }

    const remindersGrid = document.querySelector('.reminders-grid');
    if (remindersGrid) {
        if (Array.isArray(data.recordatorios) && data.recordatorios.length > 0) {
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
                        <button class="reminder-flag-btn" data-reminder-flag-id="${r.id}" data-flag="oculto" title="Ocultar">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                <line x1="1" y1="1" x2="23" y2="23"></line>
                            </svg>
                        </button>
                        <button class="reminder-flag-btn" data-reminder-flag-id="${r.id}" data-flag="archivado" title="Archivar">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="21 8 21 21 3 21 3 8"></polyline>
                                <rect x="1" y="3" width="22" height="5"></rect>
                                <line x1="10" y1="12" x2="14" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                </article>
            `).join('');
        } else {
            remindersGrid.innerHTML = `<div class="empty-state-card" style="padding: 15px; opacity: 0.7;"><p>Sin recordatorios por hoy</p></div>`;
        }
    }

    const eventsGrid = document.querySelector('.events-grid');
    if (eventsGrid) {
        const addBox = document.getElementById('btn-add-event-box');
        eventsGrid.innerHTML = '';
        if (addBox) eventsGrid.appendChild(addBox);

        if (Array.isArray(data.eventos) && data.eventos.length > 0) {
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
        } else {
            eventsGrid.insertAdjacentHTML('beforeend', `
                <article class="event-main-card empty-event-card" style="display:flex; align-items:center; justify-center:center; min-height:100px; opacity:0.8;">
                    <p style="margin:auto; font-weight:500;">Sin eventos por hoy</p>
                </article>
            `);
        }
    }

    initTaskCheckboxes();
    initTaskClickToEdit();
    initEventClickToEdit();
    initReminderClickToEdit();
    initReminderStars();
    initReminderFlagButtons();
}

function initReminderFlagButtons() {
    document.querySelectorAll('.reminder-flag-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.getAttribute('data-reminder-flag-id');
            const campo = btn.getAttribute('data-flag'); 
            try {
                await fetch(`http://127.0.0.1:5000/api/panel/recordatorios/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ [campo]: true })
                });
                sincronizarConBackendPython();
            } catch (err) {}
        });
    });
}

function evaluarAutomatizaciones(area, entidad) {
    const reglas = JSON.parse(localStorage.getItem('control_one_historial_auto') || '[]').filter(r => r.activa !== false && (r.area === area || r.area === 'General'));
    if (reglas.length === 0) return entidad;

    let resultado = { ...entidad };
    reglas.forEach(regla => {
        const condicion = (regla.condicion || '').toLowerCase().trim();
        const textoEntidad = `${entidad.titulo || ''} ${entidad.descripcion || ''}`.toLowerCase();

        let cumple = false;
        if (!condicion) {
            cumple = true;
        } else if (regla.tipo_regla === 'solo_si_no_se_cumple_condicion') {
            cumple = !textoEntidad.includes(condicion);
        } else {
            cumple = textoEntidad.includes(condicion);
        }

        if (cumple) {
            if (area === 'Tareas') {
                const descUpper = (regla.descripcion || '').toUpperCase();
                const cats = JSON.parse(localStorage.getItem('control_one_categorias_list') || '[]');
                const catMatch = cats.find(c => descUpper.includes(c.nombre.toUpperCase()));
                if (catMatch) {
                    resultado.categoria_id = catMatch.id;
                }
                if (descUpper.includes('ALTA') || descUpper.includes('URGENTE')) {
                    resultado.prioridad = 'alta';
                }
            }

            let historial = JSON.parse(localStorage.getItem('control_one_historial_auto') || '[]');
            historial.unshift({
                id: 'exec_' + Date.now(),
                automatizacion_nombre: regla.automatizacion_nombre || regla.nombre || 'Automatización',
                area: area,
                descripcion: `Auto-ejecutado: "${regla.descripcion || regla.nombre}" sobre "${entidad.titulo || 'Tarea'}"`,
                fecha_ejecucion: new Date().toISOString(),
                activa: true,
                estado: 'ejecutada'
            });
            localStorage.setItem('control_one_historial_auto', JSON.stringify(historial.slice(0, 50)));
        }
    });

    return resultado;
}