

let estadoActividades = {
    correos: [],
    carpetas: [],
    notaActual: { id: 'n1', titulo: 'Título de la nota', contenido: 'contenido de la nota' },
    filtroCorreo: 'todos',
    carpetaSeleccionada: null
};

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initNavScroll();
    initEmailInteractions();
    initFolderInteractions();
    initNotesEditor();
    initLiveSearch();
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

                document.querySelectorAll(`.subnav-btn[href="${targetId}"], .nav-pill[href="${targetId}"]`)
                    .forEach(el => el.classList.add('active'));

                const targetElem = document.querySelector(targetId);
                if (targetElem) {
                    targetElem.scrollIntoView({ behavior: 'smooth', block: 'start' });

                    targetElem.classList.add('card-highlight');
                    setTimeout(() => targetElem.classList.remove('card-highlight'), 1200);
                }
            }
        });
    });
}

function initEmailInteractions() {
    
    const btnRedactar = document.getElementById('btn-redactar-correo');
    if (btnRedactar) {
        btnRedactar.addEventListener('click', (e) => {
            e.stopPropagation();
            abrirModalRedactar();
        });
    }

    const filterBtns = document.querySelectorAll('.email-filter-icon-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const cat = btn.getAttribute('data-cat') || 'todos';
            filtrarCorreosPorCategoria(cat);
        });
    });

    const emailList = document.getElementById('email-items-container');
    if (emailList) {
        emailList.addEventListener('click', (e) => {
            const row = e.target.closest('.email-item-row');
            if (!row) return;

            const correoId = row.getAttribute('data-email-id');

            if (e.target.closest('.email-check-wrapper')) {
                e.stopPropagation();
                const chk = row.querySelector('.email-check-wrapper input');
                if (chk) {
                    row.classList.toggle('selected', chk.checked);
                }
                return;
            }

            if (e.target.closest('.email-star-btn')) {
                e.stopPropagation();
                toggleEstrellaCorreo(correoId, row);
                return;
            }

            abrirModalDetalleCorreo(correoId);
        });
    }
}

function toggleEstrellaCorreo(correoId, rowElem) {
    const starBtn = rowElem.querySelector('.email-star-btn');
    const isDestacado = starBtn.classList.toggle('active');

    const svg = starBtn.querySelector('svg polygon');
    if (isDestacado) {
        svg.setAttribute('fill', '#f59e0b');
        svg.setAttribute('stroke', '#d97706');
    } else {
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
    }

    fetch('http://127.0.0.1:5000/api/actividades/correos/destacado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: correoId, destacado: isDestacado })
    }).catch(() => {});
}

function filtrarCorreosPorCategoria(categoria) {
    estadoActividades.filtroCorreo = categoria;
    const rows = document.querySelectorAll('.email-item-row');
    rows.forEach(row => {
        const rowCat = row.getAttribute('data-cat') || 'principal';
        if (categoria === 'todos' || rowCat === categoria) {
            row.style.display = 'flex';
        } else {
            row.style.display = 'none';
        }
    });
}

function abrirModalRedactar() {
    cerrarModales();
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-redactar-correo');
    document.getElementById('form-redactar-correo').reset();
    overlay.classList.add('active');
    modal.classList.add('active');
    document.getElementById('input-correo-destinatario').focus();
}

function guardarCorreoNuevo(e) {
    e.preventDefault();
    const dest = document.getElementById('input-correo-destinatario').value.trim();
    const asunto = document.getElementById('input-correo-asunto').value.trim();
    const cuerpo = document.getElementById('input-correo-cuerpo').value.trim();
    const cat = document.getElementById('input-correo-categoria').value;

    if (!dest || !asunto) return;

    const newId = 'c_' + Date.now();
    let nuevoCorreo = {
        id: newId,
        remitente: 'Equipos de Gmail',
        email_remitente: 'usuario@controlone.app',
        destinatario: dest,
        asunto: asunto,
        cuerpo: cuerpo,
        fecha: new Date().toISOString(),
        leido: true,
        destacado: false,
        categoria: cat
    };

    if (typeof evaluarAutomatizaciones === 'function') {
        nuevoCorreo = evaluarAutomatizaciones('Correo electrónico', nuevoCorreo);
    }

    renderizarCorreoEnLista(nuevoCorreo, true);

    guardarCorreoEnStorage(nuevoCorreo);
    fetch('http://127.0.0.1:5000/api/actividades/correos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoCorreo)
    }).catch(() => {});

    cerrarModales();
}

function renderizarCorreoEnLista(correo, prepend = false) {
    const list = document.getElementById('email-items-container');
    if (!list) return;

    const row = document.createElement('article');
    row.className = 'email-item-row';
    row.setAttribute('data-email-id', correo.id);
    row.setAttribute('data-cat', correo.categoria || 'principal');

    const starFill = correo.destacado ? '#f59e0b' : 'none';
    const starStroke = correo.destacado ? '#d97706' : 'currentColor';
    const starActiveClass = correo.destacado ? 'active' : '';

    row.innerHTML = `
        <label class="email-check-wrapper" title="Seleccionar">
            <input type="checkbox">
            <span class="custom-checkmark">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </span>
        </label>
        <button class="email-star-btn ${starActiveClass}" title="Destacar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="${starFill}" stroke="${starStroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
        </button>
        <div class="email-sender-col">
            <span class="email-sender-name">${escapeHTML(correo.remitente || 'Equipos de Gmail')}</span>
        </div>
        <div class="email-subject-col">
            <span class="email-subject-text">${escapeHTML(correo.asunto || '(Sin Asunto)')}</span>
        </div>
    `;

    if (prepend) {
        list.insertBefore(row, list.firstChild);
    } else {
        list.appendChild(row);
    }
}

function abrirModalDetalleCorreo(correoId) {
    const correo = estadoActividades.correos.find(c => String(c.id) === String(correoId)) || {
        id: correoId,
        remitente: 'Equipos de Gmail',
        email_remitente: 'mail-noreply@google.com',
        destinatario: 'usuario@controlone.app',
        asunto: 'Consejos para usar el correo',
        cuerpo: 'Aprovecha al máximo el espacio de almacenamiento y la sincronización en todos tus dispositivos.',
        fecha: '2026-08-31 10:00'
    };

    cerrarModales();
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-detalle-correo');

    document.getElementById('detalle-correo-id').value = correo.id;
    document.getElementById('detalle-correo-asunto').textContent = correo.asunto;
    document.getElementById('detalle-correo-remitente').textContent = correo.remitente;
    document.getElementById('detalle-correo-email').textContent = `<${correo.email_remitente || 'mail-noreply@google.com'}>`;
    document.getElementById('detalle-correo-cuerpo').textContent = correo.cuerpo || 'Sin contenido adicional.';

    overlay.classList.add('active');
    modal.classList.add('active');
}

function eliminarCorreoDetalle() {
    const id = document.getElementById('detalle-correo-id').value;
    if (!id) return;

    if (confirm('¿Deseas eliminar este correo?')) {
        const row = document.querySelector(`.email-item-row[data-email-id="${id}"]`);
        if (row) row.remove();

        estadoActividades.correos = estadoActividades.correos.filter(c => String(c.id) !== String(id));
        localStorage.setItem('control_one_correos', JSON.stringify(estadoActividades.correos));

        fetch('http://127.0.0.1:5000/api/actividades/correos/eliminar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        }).catch(() => {});

        cerrarModales();
    }
}

function initFolderInteractions() {
    const folderItems = document.querySelectorAll('.folder-item');
    folderItems.forEach(item => {
        item.addEventListener('click', () => {
            const folderId = item.getAttribute('data-folder-id');
            const folderName = item.querySelector('.folder-label') ? item.querySelector('.folder-label').textContent.trim() : 'Documentos';
            abrirModalCarpeta(folderId, folderName);
        });
    });
}

function abrirModalCarpeta(folderId, folderName) {
    estadoActividades.carpetaSeleccionada = folderId;
    cerrarModales();
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-carpeta');

    document.getElementById('modal-carpeta-titulo').textContent = `Carpeta: ${folderName}`;
    document.getElementById('modal-carpeta-id').value = folderId;

    const carpeta = estadoActividades.carpetas.find(c => c.id === folderId || c.nombre.toLowerCase() === folderName.toLowerCase());
    const filesList = document.getElementById('carpeta-archivos-lista');
    filesList.innerHTML = '';

    let archivos = (carpeta && carpeta.archivos) ? [...carpeta.archivos] : [
        { id: 'a1', nombre: `${folderName}_Reporte.pdf`, tamano: '1.8 MB', tipo: 'pdf', fecha: '2026-08-31' },
        { id: 'a2', nombre: `Respaldo_${folderName}.zip`, tamano: '4.2 MB', tipo: 'zip', fecha: '2026-08-30' }
    ];

    if (folderId === 'f_documentos' || folderName.toLowerCase() === 'documentos') {
        const notas = JSON.parse(localStorage.getItem('control_one_notas') || '[]');
        const notaActiva = JSON.parse(localStorage.getItem('control_one_nota_activa') || 'null');
        const todasNotas = [...notas];
        if (notaActiva && !todasNotas.find(n => n.id === notaActiva.id)) {
            todasNotas.unshift(notaActiva);
        }
        todasNotas.forEach(nota => {
            archivos.unshift({
                id: 'nota_' + nota.id,
                nombre: (nota.titulo || 'Sin título') + '.txt',
                tamano: ((nota.contenido || '').length / 1024).toFixed(1) + ' KB',
                tipo: 'nota',
                fecha: nota.fecha || new Date().toISOString().split('T')[0]
            });
        });
    }

    archivos.forEach(arch => {
        const item = document.createElement('div');
        item.className = 'archivo-item-row';
        item.innerHTML = `
            <div class="archivo-info-left">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                <div>
                    <strong>${escapeHTML(arch.nombre)}</strong>
                    <small>${arch.tamano || '1 MB'} • ${arch.fecha || '2026-08-31'}</small>
                </div>
            </div>
            <div class="archivo-actions-right">
                <button class="btn-icon-action" title="Descargar" onclick="alert('Descargando: ${escapeHTML(arch.nombre)}')">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </button>
                <button class="btn-icon-action btn-delete" title="Eliminar" onclick="eliminarArchivoUI('${arch.id}', '${folderId}')">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        filesList.appendChild(item);
    });

    overlay.classList.add('active');
    modal.classList.add('active');
}

function agregarArchivoCarpetaPrompt() {
    const nombre = prompt('Ingresa el nombre del nuevo archivo (ej. Documento_Nuevo.pdf):');
    if (!nombre || !nombre.trim()) return;

    const folderId = document.getElementById('modal-carpeta-id').value;
    const nuevo = {
        id: 'doc_' + Date.now(),
        nombre: nombre.trim(),
        tamano: '1.2 MB',
        tipo: nombre.includes('.') ? nombre.split('.').pop() : 'txt',
        fecha: new Date().toISOString().split('T')[0]
    };

    let carp = estadoActividades.carpetas.find(c => c.id === folderId);
    if (carp) {
        if (!carp.archivos) carp.archivos = [];
        carp.archivos.unshift(nuevo);
    }

    abrirModalCarpeta(folderId, document.getElementById('modal-carpeta-titulo').textContent.replace('Carpeta: ', ''));

    fetch('http://127.0.0.1:5000/api/actividades/archivos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carpeta_id: folderId, nombre: nombre.trim() })
    }).catch(() => {});
}

function eliminarArchivoUI(archivoId, folderId) {
    if (confirm('¿Eliminar este archivo?')) {
        let carp = estadoActividades.carpetas.find(c => c.id === folderId);
        if (carp && carp.archivos) {
            carp.archivos = carp.archivos.filter(a => String(a.id) !== String(archivoId));
        }
        abrirModalCarpeta(folderId, document.getElementById('modal-carpeta-titulo').textContent.replace('Carpeta: ', ''));

        fetch('http://127.0.0.1:5000/api/actividades/archivos/eliminar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ carpeta_id: folderId, archivo_id: archivoId })
        }).catch(() => {});
    }
}

function initNotesEditor() {
    const titleInput = document.getElementById('nota-titulo-input');
    const contentTextarea = document.getElementById('nota-contenido-textarea');
    const btnEditTitle = document.getElementById('btn-edit-title-icon');
    const btnEditContent = document.getElementById('btn-edit-content-icon');

    if (btnEditTitle && titleInput) {
        btnEditTitle.addEventListener('click', () => {
            titleInput.focus();
            titleInput.select();
        });
    }

    if (btnEditContent && contentTextarea) {
        btnEditContent.addEventListener('click', () => {
            contentTextarea.focus();
        });
    }

    let timeoutGuardado = null;
    function autoGuardarNota() {
        clearTimeout(timeoutGuardado);
        timeoutGuardado = setTimeout(() => {
            const tit = titleInput ? titleInput.value.trim() : 'Título de la nota';
            const cont = contentTextarea ? contentTextarea.value.trim() : 'contenido de la nota';
            
            estadoActividades.notaActual.titulo = tit;
            estadoActividades.notaActual.contenido = cont;

            if (typeof evaluarAutomatizaciones === 'function') {
                evaluarAutomatizaciones('Notas', { titulo: tit, contenido: cont });
            }

            localStorage.setItem('control_one_nota_activa', JSON.stringify(estadoActividades.notaActual));

            fetch('http://127.0.0.1:5000/api/actividades/notas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: 'n1', titulo: tit, contenido: cont })
            }).catch(() => {});
        }, 600);
    }

    if (titleInput) titleInput.addEventListener('input', autoGuardarNota);
    if (contentTextarea) contentTextarea.addEventListener('input', autoGuardarNota);
}

function initLiveSearch() {
    const desktopSearch = document.getElementById('desktop-search-input');
    const mobileSearchBtn = document.getElementById('mobile-search-trigger');

    function ejecutarBusqueda(query) {
        const q = query.toLowerCase().trim();

        const emailRows = document.querySelectorAll('.email-item-row');
        emailRows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = (!q || text.includes(q)) ? 'flex' : 'none';
        });

        const folders = document.querySelectorAll('.folder-item');
        folders.forEach(f => {
            const text = f.textContent.toLowerCase();
            f.style.opacity = (!q || text.includes(q)) ? '1' : '0.25';
        });

        const noteCard = document.querySelector('.notes-main-card');
        if (noteCard) {
            const tit = document.getElementById('nota-titulo-input')?.value.toLowerCase() || '';
            const cont = document.getElementById('nota-contenido-textarea')?.value.toLowerCase() || '';
            if (q && (tit.includes(q) || cont.includes(q))) {
                noteCard.style.outline = '3px solid #00cba9';
            } else {
                noteCard.style.outline = 'none';
            }
        }
    }

    if (desktopSearch) {
        desktopSearch.addEventListener('input', (e) => ejecutarBusqueda(e.target.value));
    }

    if (mobileSearchBtn) {
        mobileSearchBtn.addEventListener('click', () => {
            const q = prompt('Buscar en Correos, Documentos o Notas:');
            if (q !== null) ejecutarBusqueda(q);
        });
    }
}

function initMobileCollapsibles() {
    const chevrons = document.querySelectorAll('.mobile-chevron, .card-chevron-btn');

    chevrons.forEach(chevron => {
        chevron.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = chevron.closest('.activity-card, .notes-main-card, .documents-main-card, .emails-main-card');
            if (card) {
                const body = card.querySelector('.card-collapsible-body, .notes-body, .documents-grid-container, .emails-body-content');
                if (body) {
                    const isHidden = body.style.display === 'none';
                    body.style.display = isHidden ? '' : 'none';
                    chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
                    chevron.style.transition = 'transform 0.25s ease';
                }
            }
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

function guardarCorreoEnStorage(correo) {
    let correos = JSON.parse(localStorage.getItem('control_one_correos') || '[]');
    correos.unshift(correo);
    localStorage.setItem('control_one_correos', JSON.stringify(correos));
}

function cargarDatosLocales() {
    
    const notaGuardada = JSON.parse(localStorage.getItem('control_one_nota_activa') || 'null');
    if (notaGuardada) {
        estadoActividades.notaActual = notaGuardada;
        const tit = document.getElementById('nota-titulo-input');
        const cont = document.getElementById('nota-contenido-textarea');
        if (tit && notaGuardada.titulo) tit.value = notaGuardada.titulo;
        if (cont && notaGuardada.contenido) cont.value = notaGuardada.contenido;
    }
}

async function sincronizarConBackendPython() {
    try {
        const res = await fetch('http://127.0.0.1:5000/api/actividades/resumen', {
            signal: AbortSignal.timeout(1500)
        });
        if (!res.ok) return;

        const data = await res.json();
        estadoActividades.correos = data.correos || [];
        estadoActividades.carpetas = data.carpetas || [];

        if (data.nota_actual) {
            estadoActividades.notaActual = data.nota_actual;
            const tit = document.getElementById('nota-titulo-input');
            const cont = document.getElementById('nota-contenido-textarea');
            if (tit && !tit.value) tit.value = data.nota_actual.titulo || 'Título de la nota';
            if (cont && !cont.value) cont.value = data.nota_actual.contenido || 'contenido de la nota';
        }
        console.log('[Control One - Actividades] Sincronizado exitosamente con Python Backend');
    } catch (e) {
        console.log('[Control One - Actividades] Operando en modo local/desconectado');
    }
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

function evaluarAutomatizaciones(area, entidad) {
    const reglas = JSON.parse(localStorage.getItem('control_one_historial_auto') || '[]').filter(r => r.activa !== false && (r.area === area || r.area === 'General'));
    if (reglas.length === 0) return entidad;

    let resultado = { ...entidad };
    reglas.forEach(regla => {
        const condicion = (regla.condicion || '').toLowerCase().trim();
        const textoEntidad = `${entidad.titulo || ''} ${entidad.descripcion || ''} ${entidad.contenido || ''} ${entidad.asunto || ''}`.toLowerCase();

        let cumple = false;
        if (!condicion) {
            cumple = true;
        } else if (regla.tipo_regla === 'solo_si_no_se_cumple_condicion') {
            cumple = !textoEntidad.includes(condicion);
        } else {
            cumple = textoEntidad.includes(condicion);
        }

        if (cumple) {
            if (area === 'Correo electrónico') {
                const descLower = (regla.descripcion || '').toLowerCase();
                if (descLower.includes('social')) resultado.categoria = 'social';
                else if (descLower.includes('promocion')) resultado.categoria = 'promociones';
                else if (descLower.includes('suscripcion')) resultado.categoria = 'suscripciones';
            }

            let historial = JSON.parse(localStorage.getItem('control_one_historial_auto') || '[]');
            historial.unshift({
                id: 'exec_' + Date.now(),
                automatizacion_nombre: regla.automatizacion_nombre || regla.nombre || 'Automatización',
                area: area,
                descripcion: `Auto-ejecutado: "${regla.descripcion || regla.nombre}" sobre "${entidad.titulo || entidad.asunto || 'Elemento'}"`,
                fecha_ejecucion: new Date().toISOString(),
                activa: true,
                estado: 'ejecutada'
            });
            localStorage.setItem('control_one_historial_auto', JSON.stringify(historial.slice(0, 50)));
        }
    });

    return resultado;
}
