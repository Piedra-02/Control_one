

let estadoInformacion = {
    favoritos: [],
    historial: [],
    suscripciones: []
};

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initNavScroll();
    initSubscriptionToggles();
    initFavoritesInteractions();
    initHistoryInteractions();
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

function initSubscriptionToggles() {
    const listContainer = document.getElementById('subscriptions-list-container');
    if (!listContainer) return;

    listContainer.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.sub-toggle-btn');
        const row = e.target.closest('.subscription-item-row');
        if (!row) return;

        const subId = row.getAttribute('data-sub-id');

        if (toggleBtn) {
            e.stopPropagation();
            const isActive = toggleBtn.classList.toggle('active');
            row.classList.toggle('paused', !isActive);

            fetch('http://127.0.0.1:5000/api/informacion/suscripciones/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: subId, activa: isActive })
            }).catch(() => {});

            const sub = estadoInformacion.suscripciones.find(s => String(s.id) === String(subId));
            if (sub) sub.activa = isActive;
            localStorage.setItem('control_one_suscripciones', JSON.stringify(estadoInformacion.suscripciones));
            return;
        }

        abrirModalSuscripcion(subId);
    });

    const btnAgregarSub = document.getElementById('btn-agregar-suscripcion');
    if (btnAgregarSub) {
        btnAgregarSub.addEventListener('click', (e) => {
            e.stopPropagation();
            abrirModalSuscripcion();
        });
    }

    const headerSuscripciones = document.querySelector('.subscriptions-main-card .card-header-row');
    if (headerSuscripciones) {
        headerSuscripciones.style.cursor = 'pointer';
        headerSuscripciones.addEventListener('dblclick', () => abrirModalSuscripcion());
    }
}

function abrirModalSuscripcion(subId = null) {
    cerrarModales();
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-suscripcion');
    const inputId = document.getElementById('input-sub-id');
    const inputNombre = document.getElementById('input-sub-nombre');
    const inputMonto = document.getElementById('input-sub-monto');
    const inputCat = document.getElementById('input-sub-categoria');
    const btnEliminar = document.getElementById('btn-eliminar-sub');
    const btnPagar = document.getElementById('btn-pagar-sub');
    const btnCancelar = document.getElementById('btn-cancelar-sub');
    const modalTit = document.getElementById('modal-sub-titulo');

    if (subId) {
        const sub = estadoInformacion.suscripciones.find(s => String(s.id) === String(subId)) || {
            nombre: 'Play Station Plus', monto: 9.99, categoria: 'Gaming'
        };
        modalTit.textContent = 'Modificar Suscripción';
        inputId.value = subId;
        inputNombre.value = sub.nombre;
        inputMonto.value = sub.monto || 9.99;
        inputCat.value = sub.categoria || 'General';
        if (btnEliminar) btnEliminar.style.display = 'inline-block';
        if (btnPagar) btnPagar.style.display = 'inline-block';
        if (btnCancelar) btnCancelar.style.display = 'inline-block';
    } else {
        modalTit.textContent = 'Nueva Suscripción';
        inputId.value = '';
        inputNombre.value = '';
        inputMonto.value = '9.99';
        inputCat.value = 'General';
        if (btnEliminar) btnEliminar.style.display = 'none';
        if (btnPagar) btnPagar.style.display = 'none';
        if (btnCancelar) btnCancelar.style.display = 'none';
    }

    overlay.classList.add('active');
    modal.classList.add('active');
    inputNombre.focus();
}

function realizarPagoSuscripcionModal() {
    const id = document.getElementById('input-sub-id').value;
    const nombre = document.getElementById('input-sub-nombre').value.trim();
    const monto = document.getElementById('input-sub-monto').value;
    if (!nombre) return;

    const fecha = new Date().toLocaleDateString('es-EC');
    alert(`Pago exitoso de $${monto} para "${nombre}" realizado el ${fecha}.`);

    let subs = JSON.parse(localStorage.getItem('control_one_suscripciones') || '[]');
    const sub = subs.find(s => String(s.id) === String(id));
    if (sub) {
        sub.ultimo_pago = fecha;
        sub.estado_pago = 'al_dia';
        localStorage.setItem('control_one_suscripciones', JSON.stringify(subs));
    }

    fetch('http://127.0.0.1:5000/api/informacion/suscripciones/pago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, monto, fecha })
    }).catch(() => {});

    cerrarModales();
}

function cancelarSuscripcionModal() {
    const id = document.getElementById('input-sub-id').value;
    const nombre = document.getElementById('input-sub-nombre').value.trim();
    if (!id) return;

    if (confirm(`¿Deseas cancelar la suscripción a "${nombre}"?`)) {
        let subs = JSON.parse(localStorage.getItem('control_one_suscripciones') || '[]');
        const sub = subs.find(s => String(s.id) === String(id));
        if (sub) {
            sub.activa = false;
            localStorage.setItem('control_one_suscripciones', JSON.stringify(subs));
        }

        const row = document.querySelector(`.subscription-item-row[data-sub-id="${id}"]`);
        if (row) {
            row.classList.add('paused');
            const toggle = row.querySelector('.sub-toggle-btn');
            if (toggle) toggle.classList.remove('active');
        }

        fetch('http://127.0.0.1:5000/api/informacion/suscripciones/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, activa: false })
        }).catch(() => {});

        cerrarModales();
    }
}

window.realizarPagoSuscripcionModal = realizarPagoSuscripcionModal;
window.cancelarSuscripcionModal = cancelarSuscripcionModal;

function guardarSuscripcionModal(e) {
    e.preventDefault();
    const id = document.getElementById('input-sub-id').value;
    const nombre = document.getElementById('input-sub-nombre').value.trim();
    const monto = parseFloat(document.getElementById('input-sub-monto').value) || 9.99;
    const cat = document.getElementById('input-sub-categoria').value;

    if (!nombre) return;

    let subs = JSON.parse(localStorage.getItem('control_one_suscripciones') || '[]');
    if (id) {
        const sub = subs.find(s => String(s.id) === String(id));
        if (sub) {
            sub.nombre = nombre;
            sub.monto = monto;
            sub.categoria = cat;
        }
        const row = document.querySelector(`.subscription-item-row[data-sub-id="${id}"]`);
        if (row) {
            const span = row.querySelector('.sub-name-text');
            if (span) span.textContent = nombre;
        }
    } else {
        const nuevaSub = {
            id: 'sub_' + Date.now(),
            nombre,
            monto,
            categoria: cat,
            activa: true
        };
        subs.push(nuevaSub);
        renderizarSuscripcionEnLista(nuevaSub, true);
    }
    localStorage.setItem('control_one_suscripciones', JSON.stringify(subs));

    fetch('http://127.0.0.1:5000/api/informacion/suscripciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id || null, nombre, monto, categoria: cat })
    })
        .then(() => sincronizarConBackendPython())
        .catch(() => {});

    cerrarModales();
}

function renderizarSuscripcionEnLista(sub, prepend = false) {
    const list = document.getElementById('subscriptions-list-container');
    if (!list) return;

    const row = document.createElement('article');
    row.className = `subscription-item-row ${!sub.activa ? 'paused' : ''}`;
    row.setAttribute('data-sub-id', sub.id);

    row.innerHTML = `
        <div class="sub-toggle-btn ${sub.activa ? 'active' : ''}" title="Activar / Pausar">
            <span class="toggle-slider-circle"></span>
        </div>
        <div class="sub-bookmark-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
        </div>
        <span class="sub-name-text">${escapeHTML(sub.nombre)}</span>
        <div class="sub-card-icon">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
            </svg>
        </div>
    `;

    if (prepend) {
        list.insertBefore(row, list.firstChild);
    } else {
        list.appendChild(row);
    }
}

function eliminarSuscripcionModal() {
    const id = document.getElementById('input-sub-id').value;
    if (!id) return;

    if (confirm('¿Deseas eliminar esta suscripción?')) {
        fetch('http://127.0.0.1:5000/api/informacion/suscripciones/eliminar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        })
            .then(() => sincronizarConBackendPython())
            .catch(() => {});

        cerrarModales();
    }
}

function initFavoritesInteractions() {
    const btnEditFavs = document.getElementById('btn-edit-favoritos');
    if (btnEditFavs) {
        btnEditFavs.addEventListener('click', () => {
            abrirModalFavoritos();
        });
    }

    const favsContainer = document.getElementById('favorites-list-container');
    if (favsContainer) {
        favsContainer.addEventListener('click', (e) => {
            const row = e.target.closest('.favorite-item-row');
            if (row) {
                const favId = row.getAttribute('data-fav-id');
                const favTitle = row.querySelector('.fav-item-text')?.textContent || '';
                abrirModalFavoritos(favId, favTitle);
            }
        });
    }
}

function abrirModalFavoritos(favId = null, titulo = '') {
    cerrarModales();
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-favorito');
    const inputId = document.getElementById('input-fav-id');
    const inputTit = document.getElementById('input-fav-titulo');
    const btnEliminar = document.getElementById('btn-eliminar-fav');
    const modalTit = document.getElementById('modal-fav-titulo-header');

    if (favId) {
        modalTit.textContent = 'Modificar Favorito';
        inputId.value = favId;
        inputTit.value = titulo;
        btnEliminar.style.display = 'inline-block';
    } else {
        modalTit.textContent = 'Nuevo Favorito';
        inputId.value = '';
        inputTit.value = '';
        btnEliminar.style.display = 'none';
    }

    overlay.classList.add('active');
    modal.classList.add('active');
    inputTit.focus();
}

function guardarFavoritoModal(e) {
    e.preventDefault();
    const id = document.getElementById('input-fav-id').value;
    const titulo = document.getElementById('input-fav-titulo').value.trim();

    if (!titulo) return;

    if (id) {

        const row = document.querySelector(`.favorite-item-row[data-fav-id="${id}"]`);
        if (row) {
            const span = row.querySelector('.fav-item-text');
            if (span) span.textContent = titulo;
        }
    } else {
        fetch('http://127.0.0.1:5000/api/informacion/favoritos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ titulo, tipo_elemento: 'general' })
        })
            .then(() => sincronizarConBackendPython())
            .catch(() => {});
    }

    cerrarModales();
}

function renderizarFavoritoEnLista(fav, prepend = false) {
    const list = document.getElementById('favorites-list-container');
    if (!list) return;

    const row = document.createElement('article');
    row.className = 'favorite-item-row';
    row.setAttribute('data-fav-id', fav.id);

    row.innerHTML = `
        <div class="fav-star-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#eab308" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
        </div>
        <span class="fav-item-text">${escapeHTML(fav.titulo)}</span>
    `;

    if (prepend) {
        list.insertBefore(row, list.firstChild);
    } else {
        list.appendChild(row);
    }
}

function eliminarFavoritoModal() {
    const id = document.getElementById('input-fav-id').value;
    if (!id) return;

    if (confirm('¿Deseas eliminar este favorito?')) {
        fetch('http://127.0.0.1:5000/api/informacion/favoritos/eliminar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        })
            .then(() => sincronizarConBackendPython())
            .catch(() => {});

        cerrarModales();
    }
}

function initHistoryInteractions() {
    const histItems = document.querySelectorAll('.history-item-row');
    histItems.forEach(item => {
        item.addEventListener('click', () => {
            const time = item.querySelector('.history-time-badge')?.textContent || '';
            const desc = item.querySelector('.history-desc-text')?.textContent || '';
            alert(`Detalle de Actividad:\n\nHora: ${time}\nAcción: ${desc}`);
        });
    });
}

function initLiveSearch() {
    const desktopSearch = document.getElementById('desktop-search-input');
    const mobileSearchBtn = document.getElementById('mobile-search-trigger');

    function ejecutarBusqueda(query) {
        const q = query.toLowerCase().trim();

        document.querySelectorAll('.favorite-item-row').forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = (!q || text.includes(q)) ? 'flex' : 'none';
        });

        document.querySelectorAll('.history-item-row').forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = (!q || text.includes(q)) ? 'flex' : 'none';
        });

        document.querySelectorAll('.subscription-item-row').forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = (!q || text.includes(q)) ? 'flex' : 'none';
        });
    }

    if (desktopSearch) {
        desktopSearch.addEventListener('input', (e) => ejecutarBusqueda(e.target.value));
    }

    if (mobileSearchBtn) {
        mobileSearchBtn.addEventListener('click', () => {
            const q = prompt('Buscar en Favoritos, Historial o Suscripciones:');
            if (q !== null) ejecutarBusqueda(q);
        });
    }
}

function initMobileCollapsibles() {
    const chevrons = document.querySelectorAll('.mobile-chevron, .card-chevron-btn');

    chevrons.forEach(chevron => {
        chevron.addEventListener('click', (e) => {
            e.stopPropagation();
            const card = chevron.closest('.activity-card, .history-main-card, .subscriptions-main-card, .favorites-main-card');
            if (card) {
                const body = card.querySelector('.card-collapsible-body, .history-body-container, .subscriptions-list-wrapper, .favorites-list-container');
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

function cargarDatosLocales() {
    const favsGuardados = JSON.parse(localStorage.getItem('control_one_favoritos') || 'null');
    if (favsGuardados) estadoInformacion.favoritos = favsGuardados;

    const subsGuardadas = JSON.parse(localStorage.getItem('control_one_suscripciones') || 'null');
    if (subsGuardadas) estadoInformacion.suscripciones = subsGuardadas;
}

async function sincronizarConBackendPython() {
    try {
        const res = await fetch('http://127.0.0.1:5000/api/informacion/resumen', {
            signal: AbortSignal.timeout(1500)
        });
        if (!res.ok) return;

        const data = await res.json();
        estadoInformacion.favoritos = data.favoritos || [];
        estadoInformacion.historial = data.historial || [];
        estadoInformacion.suscripciones = data.suscripciones || [];

        renderizarDesdeBackend(data);
        console.log('[Control One - Información] Sincronizado exitosamente con Python Backend');
    } catch (e) {
        console.log('[Control One - Información] Operando en modo local/desconectado');
    }
}

function renderizarDesdeBackend(data) {
    
    const favList = document.getElementById('favorites-list-container');
    if (favList && Array.isArray(data.favoritos)) {
        favList.innerHTML = data.favoritos.map(f => `
            <article class="favorite-item-row" data-fav-id="${f.id}">
                <div class="fav-star-icon">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#eab308" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                </div>
                <span class="fav-item-text">${escapeHTML(f.titulo)}</span>
            </article>
        `).join('') || '<p style="padding:8px;opacity:.7;">Aún no tienes favoritos.</p>';
    }

    const histList = document.getElementById('history-items-container');
    if (histList && Array.isArray(data.historial)) {
        histList.innerHTML = data.historial.map(h => `
            <div class="history-item-row" data-hist-id="${h.id}">
                <div class="history-time-badge">
                    <span class="time-hour">${h.hora_linea1 || ''}</span>
                    <span class="time-min">${h.hora_linea2 || ''}</span>
                </div>
                <div class="history-desc-col">
                    <span class="history-desc-text">${escapeHTML(h.descripcion)}</span>
                </div>
            </div>
        `).join('') || '<p style="padding:8px;opacity:.7;">Aún no hay actividad registrada.</p>';
        initHistoryInteractions();
    }

    const subList = document.getElementById('subscriptions-list-container');
    if (subList && Array.isArray(data.suscripciones)) {
        subList.innerHTML = data.suscripciones.map(s => `
            <article class="subscription-item-row ${!s.activa ? 'paused' : ''}" data-sub-id="${s.id}">
                <div class="sub-toggle-btn ${s.activa ? 'active' : ''}" title="Activar / Pausar">
                    <span class="toggle-slider-circle"></span>
                </div>
                <div class="sub-bookmark-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                    </svg>
                </div>
                <span class="sub-name-text">${escapeHTML(s.nombre)}</span>
                <div class="sub-card-icon">
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                        <line x1="1" y1="10" x2="23" y2="10"></line>
                    </svg>
                </div>
            </article>
        `).join('') || '<p style="padding:8px;opacity:.7;">Aún no tienes suscripciones.</p>';
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
