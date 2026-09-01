

let anioActual = 2026;
let mesActual = 7; 
let fechaSeleccionada = '2026-08-27';

const NOMBRES_MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

let categoriasList = [
    { id: 'cat1', nombre: 'IMPORTANTE', color: '#00bcd4' },
    { id: 'cat2', nombre: 'OBLIGATORIO', color: '#00bcd4' },
    { id: 'cat3', nombre: 'UNIVERSIDAD', color: '#00bcd4' },
    { id: 'cat4', nombre: 'PROYECTO INTEGRADOR', color: '#00bcd4' },
    { id: 'cat5', nombre: 'NO IMPORTANTE', color: '#00bcd4' }
];

let tareasList = [
    { id: 't1', titulo: 'Hacer las compras del mes', categoria_id: 'cat1', prioridad: 'alta' },
    { id: 't2', titulo: 'Hablar al licenciado de Filosofía', categoria_id: 'cat1', prioridad: 'media' },
    { id: 't3', titulo: 'Acabar el proyecto integrador', categoria_id: 'cat1', prioridad: 'alta' },
    { id: 't4', titulo: 'Limpiar la casa', categoria_id: 'cat2', prioridad: 'media' },
    { id: 't5', titulo: 'Ir a entregar el pedido', categoria_id: 'cat2', prioridad: 'baja' },
    { id: 't6', titulo: 'Terminar de Decorar la Habitacion', categoria_id: 'cat2', prioridad: 'baja' },
    { id: 't7', titulo: 'Estudiar para el examen de cálculo', categoria_id: 'cat3', prioridad: 'alta' },
    { id: 't8', titulo: 'Diseñar mockups de interfaz', categoria_id: 'cat4', prioridad: 'media' }
];

let visibleCard1CatId = 'cat1';
let visibleCard2CatId = 'cat2';

let tiempoInicioSesion = null;
let totalMovimientos = 0;
let historialAcciones = [];

const CHART_SAMPLES = 7;
let activityBuffer = new Array(CHART_SAMPLES).fill(0); 
let currentIntervalMoves = 0;                          

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    cargarDatosStorage();
    initEstadisticasTracker();
    initCalendario();
    initMonthNavigation();
    initNavScrollOrg();
    initMobileSearchOrg();
    renderizarTarjetasPrincipales();

    cargarDatosBackend();
});

function initEstadisticasTracker() {
    
    const savedStart = sessionStorage.getItem('control_one_inicio_sesion');
    if (savedStart) {
        tiempoInicioSesion = parseInt(savedStart, 10);
    } else {
        tiempoInicioSesion = Date.now();
        sessionStorage.setItem('control_one_inicio_sesion', tiempoInicioSesion.toString());
    }

    const savedMovs = localStorage.getItem('control_one_movimientos');
    if (savedMovs) {
        totalMovimientos = parseInt(savedMovs, 10) || 0;
    }

    const savedHist = localStorage.getItem('control_one_historial_acciones');
    if (savedHist) {
        try { historialAcciones = JSON.parse(savedHist); } catch (e) {}
    }

    actualizarTimerSesion();
    setInterval(actualizarTimerSesion, 1000);

    setInterval(() => {
        activityBuffer.push(currentIntervalMoves);
        if (activityBuffer.length > CHART_SAMPLES) activityBuffer.shift();
        currentIntervalMoves = 0;
        redrawActivityChart();
    }, 30000);

    redrawActivityChart();

    document.addEventListener('click', (e) => {
        registrarMovimiento('Clic / Interacción');
    }, true);

    document.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
            registrarMovimiento('Escritura de texto', false);
        }
    });

    registrarAccion('Ingresó a la pantalla de Organización');
}

function actualizarTimerSesion() {
    if (!tiempoInicioSesion) return;

    const ahora = Date.now();
    const difSegundos = Math.floor((ahora - tiempoInicioSesion) / 1000);

    const horas = Math.floor(difSegundos / 3600);
    const minutos = Math.floor((difSegundos % 3600) / 60);
    const segundos = difSegundos % 60;

    const formato = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;

    const elem = document.getElementById('stat-tiempo-activo');
    if (elem) elem.textContent = formato;

    const elemModal = document.getElementById('modal-stat-tiempo');
    if (elemModal) elemModal.textContent = formato;

    const elemInicio = document.getElementById('modal-stat-inicio');
    if (elemInicio) {
        const fecha = new Date(tiempoInicioSesion);
        elemInicio.textContent = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
    }

    const minTranscurridos = Math.max(difSegundos / 60, 0.1);
    const velocidad = (totalMovimientos / minTranscurridos).toFixed(1);
    const elemVel = document.getElementById('modal-stat-velocidad');
    if (elemVel) elemVel.textContent = `${velocidad} act/min`;
}

function registrarMovimiento(tipo = 'Acción', registrarEnHistorial = true) {
    totalMovimientos++;
    currentIntervalMoves++;                       
    localStorage.setItem('control_one_movimientos', totalMovimientos.toString());

    const elem = document.getElementById('stat-movimientos-count');
    if (elem) elem.textContent = totalMovimientos.toString();

    const elemModal = document.getElementById('modal-stat-movimientos');
    if (elemModal) elemModal.textContent = totalMovimientos.toString();

    redrawActivityChart();
}

function redrawActivityChart() {
    const lineElem  = document.getElementById('stats-chart-line');
    const areaElem  = document.getElementById('stats-chart-area');
    const ptsGroup  = document.getElementById('stats-chart-points-group');

    if (!lineElem || !areaElem || !ptsGroup) return;

    const samples = [...activityBuffer];
    
    if (samples.length > 0) {
        samples[samples.length - 1] = activityBuffer[activityBuffer.length - 1];
    }
    
    const displaySamples = [...activityBuffer.slice(0, CHART_SAMPLES - 1), currentIntervalMoves];

    const maxVal = Math.max(...displaySamples, 1); 

    const X_START = 25;
    const X_END   = 355;
    const Y_BASE  = 105;   
    const Y_PEAK  = 25;    
    const step    = (X_END - X_START) / (CHART_SAMPLES - 1);

    const points = displaySamples.map((v, i) => {
        const x = X_START + i * step;
        const y = Y_BASE - ((v / maxVal) * (Y_BASE - Y_PEAK));
        return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    });

    function buildSmoothPath(pts) {
        if (pts.length === 0) return '';
        let d = `M ${pts[0].x},${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[Math.max(i - 1, 0)];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[Math.min(i + 2, pts.length - 1)];

            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;

            d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2.x},${p2.y}`;
        }
        return d;
    }

    const linePath = buildSmoothPath(points);

    const areaPath = linePath
        + ` L ${points[points.length - 1].x},${Y_BASE}`
        + ` L ${points[0].x},${Y_BASE} Z`;

    lineElem.setAttribute('d', linePath);
    areaElem.setAttribute('d', areaPath);

    ptsGroup.innerHTML = '';
    points.forEach((pt, i) => {
        const isLast = i === points.length - 1;
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', pt.x);
        circle.setAttribute('cy', pt.y);
        circle.setAttribute('r', isLast ? '5' : '3.5');
        circle.setAttribute('fill', isLast ? '#8b5cf6' : '#fff');
        circle.setAttribute('stroke', '#8b5cf6');
        circle.setAttribute('stroke-width', '2');

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${displaySamples[i]} movs`;
        circle.appendChild(title);

        ptsGroup.appendChild(circle);
    });
}

function registrarAccion(descripcion) {
    const ahora = new Date();
    const horaStr = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}:${String(ahora.getSeconds()).padStart(2, '0')}`;

    historialAcciones.unshift({
        descripcion: descripcion,
        hora: horaStr
    });

    if (historialAcciones.length > 15) {
        historialAcciones = historialAcciones.slice(0, 15);
    }
    localStorage.setItem('control_one_historial_acciones', JSON.stringify(historialAcciones));
}

function abrirModalEstadisticasDetalle() {
    cerrarModalesOrg();
    const overlay = document.getElementById('modal-overlay-org');
    const modal = document.getElementById('modal-estadisticas-detalle');
    const lista = document.getElementById('modal-stat-acciones-list');

    if (lista) {
        lista.innerHTML = '';
        if (historialAcciones.length === 0) {
            lista.innerHTML = '<li style="color:#64748b; font-style:italic;">No hay acciones registradas en esta sesión</li>';
        } else {
            historialAcciones.forEach(acc => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${escapeHTML(acc.descripcion)}</span> <span class="action-time">${acc.hora}</span>`;
                lista.appendChild(li);
            });
        }
    }

    actualizarTimerSesion();
    redrawActivityChart();
    overlay.classList.add('active');
    modal.classList.add('active');
}

function reiniciarEstadisticas() {
    if (confirm('¿Deseas reiniciar el contador de tiempo y movimientos de la sesión?')) {
        tiempoInicioSesion = Date.now();
        sessionStorage.setItem('control_one_inicio_sesion', tiempoInicioSesion.toString());
        totalMovimientos = 0;
        localStorage.setItem('control_one_movimientos', '0');
        historialAcciones = [];
        localStorage.setItem('control_one_historial_acciones', JSON.stringify([]));

        activityBuffer = new Array(CHART_SAMPLES).fill(0);
        currentIntervalMoves = 0;

        registrarAccion('Métricas reiniciadas por el usuario');
        actualizarTimerSesion();
        redrawActivityChart();
        abrirModalEstadisticasDetalle();
    }
}

function renderizarTarjetasPrincipales() {
    if (!categoriasList.find(c => c.id === visibleCard1CatId)) {
        visibleCard1CatId = categoriasList[0] ? categoriasList[0].id : null;
    }
    if (!categoriasList.find(c => c.id === visibleCard2CatId)) {
        visibleCard2CatId = categoriasList[1] ? categoriasList[1].id : (categoriasList[0] ? categoriasList[0].id : null);
    }

    renderizarTarjetaIndividual('1', visibleCard1CatId);
    renderizarTarjetaIndividual('2', visibleCard2CatId);
}

function renderizarTarjetaIndividual(cardNum, catId) {
    const cardElem = document.getElementById(`card-cat-${cardNum}`);
    const titleElem = document.getElementById(`cat-title-${cardNum}`);
    const listElem = document.getElementById(`list-cat-${cardNum}`);

    if (!cardElem || !titleElem || !listElem) return;

    if (!catId) {
        titleElem.textContent = 'SIN CATEGORÍA';
        listElem.innerHTML = '<li style="color:#333; font-style:italic;">No hay categorías creadas</li>';
        return;
    }

    const cat = categoriasList.find(c => c.id === catId);
    if (!cat) return;

    titleElem.textContent = cat.nombre;

    const tareasCat = tareasList.filter(t => t.categoria_id === cat.id);

    listElem.innerHTML = '';
    if (tareasCat.length === 0) {
        listElem.innerHTML = '<li style="color:#222; opacity:0.8; font-style:italic; font-size:11.5px;">Sin tareas en esta categoría</li>';
    } else {
        tareasCat.forEach(tarea => {
            const li = document.createElement('li');
            li.style.cursor = 'pointer';
            li.innerHTML = `<span class="cat-arrow">&gt;&gt;</span> <span class="item-text">${escapeHTML(tarea.titulo)}</span>`;
            
            li.addEventListener('click', (e) => {
                e.stopPropagation();
                registrarAccion(`Abrió tarea "${tarea.titulo}"`);
                abrirModalTarea(tarea.id);
            });

            listElem.appendChild(li);
        });
    }

    const btnEdit = cardElem.querySelector('.cat-btn-edit');
    if (btnEdit) {
        btnEdit.onclick = (e) => {
            e.stopPropagation();
            abrirModalEditarCategoria(cat.id);
        };
    }

    const btnBack = cardElem.querySelector('.cat-btn-back');
    if (btnBack) {
        btnBack.onclick = (e) => {
            e.stopPropagation();
            alternarCategoriaTarjeta(cardNum);
        };
    }
}

function alternarCategoriaTarjeta(cardNum) {
    if (categoriasList.length <= 1) return;

    if (cardNum === '1') {
        const actualIdx = categoriasList.findIndex(c => c.id === visibleCard1CatId);
        const siguienteIdx = (actualIdx + 1) % categoriasList.length;
        visibleCard1CatId = categoriasList[siguienteIdx].id;
        registrarAccion(`Alternó tarjeta 1 a categoría ${categoriasList[siguienteIdx].nombre}`);
    } else {
        const actualIdx = categoriasList.findIndex(c => c.id === visibleCard2CatId);
        const siguienteIdx = (actualIdx + 1) % categoriasList.length;
        visibleCard2CatId = categoriasList[siguienteIdx].id;
        registrarAccion(`Alternó tarjeta 2 a categoría ${categoriasList[siguienteIdx].nombre}`);
    }

    guardarDatosStorage();
    renderizarTarjetasPrincipales();
}

function abrirModalTodasCategorias() {
    cerrarModalesOrg();
    registrarAccion('Abrió vista ampliada de categorías');
    const overlay = document.getElementById('modal-overlay-org');
    const modal = document.getElementById('modal-todas-categorias');
    const container = document.getElementById('all-categories-container');

    if (!container) return;
    container.innerHTML = '';

    if (categoriasList.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 20px;">No tienes categorías creadas. ¡Crea la primera con el botón de arriba!</p>';
    }

    categoriasList.forEach(cat => {
        const catBox = document.createElement('div');
        catBox.className = 'expanded-category-box';

        const tareasCat = tareasList.filter(t => t.categoria_id === cat.id);

        const itemsHTML = tareasCat.map(t => `
            <li onclick="abrirModalTarea('${t.id}')" title="Clic para editar tarea">
                <strong>&gt;&gt;</strong> ${escapeHTML(t.titulo)}
            </li>
        `).join('');

        catBox.innerHTML = `
            <div>
                <div class="expanded-cat-header">
                    <h4>${escapeHTML(cat.nombre)} (${tareasCat.length})</h4>
                    <div class="expanded-cat-actions">
                        <button onclick="abrirModalEditarCategoria('${cat.id}')" title="Modificar o Eliminar Categoría">✏️</button>
                    </div>
                </div>
                <ul class="expanded-cat-list">
                    ${itemsHTML || '<li style="color: #64748b; font-style: italic;">Sin tareas</li>'}
                </ul>
            </div>
            <button class="btn-add-task-to-cat" onclick="abrirModalNuevaTareaParaCat('${cat.id}')">+ Agregar Tarea</button>
        `;

        container.appendChild(catBox);
    });

    const tareasDesconocidas = tareasList.filter(t => !t.categoria_id || t.categoria_id === 'cat_desconocida' || !categoriasList.some(c => c.id === t.categoria_id));
    if (tareasDesconocidas.length > 0) {
        const descBox = document.createElement('div');
        descBox.className = 'expanded-category-box';
        const itemsHTML = tareasDesconocidas.map(t => `
            <li onclick="abrirModalTarea('${t.id}')" title="Clic para editar tarea">
                <strong>&gt;&gt;</strong> ${escapeHTML(t.titulo)}
            </li>
        `).join('');
        descBox.innerHTML = `
            <div>
                <div class="expanded-cat-header">
                    <h4>DESCONOCIDA (${tareasDesconocidas.length})</h4>
                    <small style="color:#64748b; font-size:11px;">Tareas sin categoría asignada</small>
                </div>
                <ul class="expanded-cat-list">
                    ${itemsHTML}
                </ul>
            </div>
            <button class="btn-add-task-to-cat" onclick="abrirModalNuevaTareaParaCat('cat_desconocida')">+ Agregar Tarea</button>
        `;
        container.appendChild(descBox);
    }

    overlay.classList.add('active');
    modal.classList.add('active');
}

function crearNuevaCategoriaPrompt() {
    abrirModalCrearCategoria();
}

function abrirModalCrearCategoria() {
    cerrarModalesOrg();
    const overlay = document.getElementById('modal-overlay-org');
    const modal = document.getElementById('modal-categoria-org');
    const titulo = document.getElementById('modal-cat-org-titulo');
    const inputId = document.getElementById('input-org-cat-id');
    const inputNombre = document.getElementById('input-org-cat-nombre');
    const inputItem = document.getElementById('input-org-cat-item');
    const btnEliminar = document.getElementById('btn-org-eliminar-cat');
    const groupTask = document.getElementById('group-add-task-to-cat');

    titulo.textContent = 'Crear Nueva Categoría';
    inputId.value = '';
    inputNombre.value = '';
    inputItem.value = '';
    btnEliminar.style.display = 'none';
    if (groupTask) groupTask.style.display = 'flex';

    overlay.classList.add('active');
    modal.classList.add('active');
    inputNombre.focus();
}

function abrirModalEditarCategoria(catId) {
    cerrarModalesOrg();
    const cat = categoriasList.find(c => c.id === catId);
    if (!cat) return;

    const overlay = document.getElementById('modal-overlay-org');
    const modal = document.getElementById('modal-categoria-org');
    const titulo = document.getElementById('modal-cat-org-titulo');
    const inputId = document.getElementById('input-org-cat-id');
    const inputNombre = document.getElementById('input-org-cat-nombre');
    const inputItem = document.getElementById('input-org-cat-item');
    const btnEliminar = document.getElementById('btn-org-eliminar-cat');
    const groupTask = document.getElementById('group-add-task-to-cat');

    titulo.textContent = `Modificar Categoría: ${cat.nombre}`;
    inputId.value = cat.id;
    inputNombre.value = cat.nombre;
    inputItem.value = '';
    btnEliminar.style.display = 'inline-block';
    if (groupTask) groupTask.style.display = 'flex';

    overlay.classList.add('active');
    modal.classList.add('active');
    inputNombre.focus();
}

function guardarCategoriaOrg(e) {
    e.preventDefault();
    const id = document.getElementById('input-org-cat-id').value;
    const nombre = document.getElementById('input-org-cat-nombre').value.trim().toUpperCase();
    const itemTexto = document.getElementById('input-org-cat-item').value.trim();

    if (!nombre) return;

    if (id) {
        const cat = categoriasList.find(c => c.id === id);
        if (cat) cat.nombre = nombre;

        if (itemTexto) {
            tareasList.push({
                id: 't_' + Date.now(),
                titulo: itemTexto,
                categoria_id: id,
                prioridad: 'media'
            });
            registrarAccion(`Agregó tarea "${itemTexto}" a categoría "${nombre}"`);
        } else {
            registrarAccion(`Modificó categoría a "${nombre}"`);
        }

        fetch('http://127.0.0.1:5000/api/organizacion/categorias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, nombre: nombre })
        }).catch(() => {});

    } else {
        const nuevoId = 'cat_' + Date.now();
        const nuevaCat = { id: nuevoId, nombre: nombre, color: '#00bcd4' };
        categoriasList.push(nuevaCat);

        if (itemTexto) {
            tareasList.push({
                id: 't_' + Date.now(),
                titulo: itemTexto,
                categoria_id: nuevoId,
                prioridad: 'media'
            });
        }

        registrarAccion(`Creó nueva categoría "${nombre}"`);

        fetch('http://127.0.0.1:5000/api/organizacion/categorias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nombre })
        }).catch(() => {});
    }

    guardarDatosStorage();
    renderizarTarjetasPrincipales();
    cerrarModalesOrg();
}

function eliminarCategoriaOrg() {
    const id = document.getElementById('input-org-cat-id').value;
    if (!id) return;

    const cat = categoriasList.find(c => c.id === id);
    const nombre = cat ? cat.nombre : 'esta categoría';

    if (confirm(`¿Estás seguro de que deseas eliminar la categoría "${nombre}"?\n(Sus tareas no se borrarán, quedarán desasignadas)`)) {
        categoriasList = categoriasList.filter(c => c.id !== id);

        tareasList.forEach(t => {
            if (t.categoria_id === id) {
                t.categoria_id = null;
            }
        });

        registrarAccion(`Eliminó categoría "${nombre}"`);

        fetch('http://127.0.0.1:5000/api/organizacion/categorias/eliminar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        }).catch(() => {});

        guardarDatosStorage();
        renderizarTarjetasPrincipales();
        cerrarModalesOrg();
    }
}

function abrirModalNuevaTareaParaCat(catId) {
    cerrarModalesOrg();
    const overlay = document.getElementById('modal-overlay-org');
    const modal = document.getElementById('modal-tarea-org');
    const titulo = document.getElementById('modal-tarea-org-titulo');
    const inputId = document.getElementById('input-org-tarea-id');
    const inputTexto = document.getElementById('input-org-tarea-texto');
    const selectCat = document.getElementById('input-org-tarea-cat-select');
    const btnEliminar = document.getElementById('btn-org-eliminar-tarea');

    titulo.textContent = 'Nueva Tarea / Proyecto';
    inputId.value = '';
    inputTexto.value = '';
    btnEliminar.style.display = 'none';

    poblarSelectCategorias(selectCat, catId);

    overlay.classList.add('active');
    modal.classList.add('active');
    inputTexto.focus();
}

function abrirModalTarea(tareaId) {
    cerrarModalesOrg();
    const tarea = tareasList.find(t => t.id === tareaId);
    if (!tarea) return;

    const overlay = document.getElementById('modal-overlay-org');
    const modal = document.getElementById('modal-tarea-org');
    const titulo = document.getElementById('modal-tarea-org-titulo');
    const inputId = document.getElementById('input-org-tarea-id');
    const inputTexto = document.getElementById('input-org-tarea-texto');
    const selectCat = document.getElementById('input-org-tarea-cat-select');
    const btnEliminar = document.getElementById('btn-org-eliminar-tarea');

    titulo.textContent = 'Modificar Tarea / Proyecto';
    inputId.value = tarea.id;
    inputTexto.value = tarea.titulo;
    btnEliminar.style.display = 'inline-block';

    poblarSelectCategorias(selectCat, tarea.categoria_id);

    overlay.classList.add('active');
    modal.classList.add('active');
    inputTexto.focus();
}

function poblarSelectCategorias(selectElem, catIdSeleccionada) {
    selectElem.innerHTML = '';
    categoriasList.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nombre;
        if (c.id === catIdSeleccionada) opt.selected = true;
        selectElem.appendChild(opt);
    });
}

function guardarTareaDesdeOrg(e) {
    e.preventDefault();
    const id = document.getElementById('input-org-tarea-id').value;
    const texto = document.getElementById('input-org-tarea-texto').value.trim();
    const nuevaCatId = document.getElementById('input-org-tarea-cat-select').value;

    if (!texto) return;

    if (id) {
        const tarea = tareasList.find(t => t.id === id);
        if (tarea) {
            tarea.titulo = texto;
            tarea.categoria_id = nuevaCatId;
            registrarAccion(`Modificó tarea "${texto}"`);
        }
    } else {
        let nueva = {
            id: 't_' + Date.now(),
            titulo: texto,
            categoria_id: nuevaCatId,
            prioridad: 'media',
            estado: 'pendiente'
        };

        if (typeof evaluarAutomatizaciones === 'function') {
            nueva = evaluarAutomatizaciones('Tareas', nueva);
        }

        tareasList.push(nueva);
        registrarAccion(`Creó tarea "${texto}"`);

        fetch('http://127.0.0.1:5000/api/organizacion/tareas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nueva)
        }).catch(() => {});
    }

    guardarDatosStorage();
    renderizarTarjetasPrincipales();
    cerrarModalesOrg();
}

function eliminarTareaDesdeOrg() {
    const id = document.getElementById('input-org-tarea-id').value;
    if (!id) return;

    if (confirm('¿Deseas eliminar esta tarea?')) {
        const t = tareasList.find(item => item.id === id);
        if (t) registrarAccion(`Eliminó tarea "${t.titulo}"`);

        tareasList = tareasList.filter(item => item.id !== id);
        guardarDatosStorage();
        renderizarTarjetasPrincipales();
        cerrarModalesOrg();
    }
}

function initCalendario() {
    renderizarCalendario(anioActual, mesActual);

    const addEventBtn = document.getElementById('btn-add-calendar-event');
    if (addEventBtn) {
        addEventBtn.addEventListener('click', () => {
            abrirModalEventoOrg(null, { fecha: fechaSeleccionada });
        });
    }
}

function renderizarCalendario(anio, mes) {
    const monthLabel = document.getElementById('calendar-month-label');
    if (monthLabel) {
        monthLabel.textContent = `${NOMBRES_MESES[mes]} de ${anio}`;
    }

    const container = document.getElementById('calendar-days-container');
    if (!container) return;
    container.innerHTML = '';

    const eventosGuardados = obtenerEventosStorage();

    const primerDiaMes = new Date(anio, mes, 1);
    const ultimoDiaMes = new Date(anio, mes + 1, 0);
    const totalDias = ultimoDiaMes.getDate();

    const diaInicioSemana = primerDiaMes.getDay();

    const ultimoDiaMesAnterior = new Date(anio, mes, 0).getDate();
    for (let i = diaInicioSemana - 1; i >= 0; i--) {
        const numDia = ultimoDiaMesAnterior - i;
        const cell = document.createElement('div');
        cell.className = 'cal-day-cell other-month';
        cell.textContent = numDia;
        container.appendChild(cell);
    }

    for (let dia = 1; dia <= totalDias; dia++) {
        const cell = document.createElement('div');
        cell.className = 'cal-day-cell';
        cell.textContent = dia;

        const fechaStr = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

        if (fechaStr === fechaSeleccionada) {
            cell.classList.add('selected');
        }

        const tieneEvento = eventosGuardados.some(e => e.fecha === fechaStr || (e.fecha_inicio && e.fecha_inicio.startsWith(fechaStr)));
        if (tieneEvento) {
            cell.classList.add('has-event');
        }

        cell.addEventListener('click', () => {
            document.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('selected'));
            cell.classList.add('selected');
            fechaSeleccionada = fechaStr;
            registrarAccion(`Seleccionó día ${fechaStr} en calendario`);

            const eventoEncontrado = eventosGuardados.find(e => e.fecha === fechaStr || (e.fecha_inicio && e.fecha_inicio.startsWith(fechaStr)));
            if (eventoEncontrado) {
                abrirModalEventoOrg(eventoEncontrado.id, eventoEncontrado);
            } else {
                abrirModalEventoOrg(null, { fecha: fechaStr });
            }
        });

        container.appendChild(cell);
    }
}

function initMonthNavigation() {
    const prevBtn = document.getElementById('prev-month-btn');
    const nextBtn = document.getElementById('next-month-btn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            mesActual--;
            if (mesActual < 0) {
                mesActual = 11;
                anioActual--;
            }
            registrarAccion(`Navegó a ${NOMBRES_MESES[mesActual]} ${anioActual}`);
            renderizarCalendario(anioActual, mesActual);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            mesActual++;
            if (mesActual > 11) {
                mesActual = 0;
                anioActual++;
            }
            registrarAccion(`Navegó a ${NOMBRES_MESES[mesActual]} ${anioActual}`);
            renderizarCalendario(anioActual, mesActual);
        });
    }
}

function initNavScrollOrg() {
    const navLinks = document.querySelectorAll('.subnav-btn, .nav-pill');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('href');
            if (targetId === '#seccion-categorias') {
                e.preventDefault();
                abrirModalTodasCategorias();
                return;
            }
            if (targetId === '#seccion-estadisticas') {
                e.preventDefault();
                abrirModalEstadisticasDetalle();
                return;
            }
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

function initMobileSearchOrg() {
    const searchBtn = document.getElementById('mobile-search-trigger-org');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const q = prompt('Buscar en Organización:');
            if (q) {
                registrarAccion(`Búsqueda: "${q}"`);
                const terms = q.toLowerCase();
                document.querySelectorAll('.cat-items-list li').forEach(li => {
                    li.style.display = li.textContent.toLowerCase().includes(terms) ? '' : 'none';
                });
            }
        });
    }
}

function cerrarModalesOrg() {
    const overlay = document.getElementById('modal-overlay-org');
    if (overlay) overlay.classList.remove('active');
    document.querySelectorAll('.modal-card').forEach(m => m.classList.remove('active'));
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModalesOrg();
});

const overlayElemOrg = document.getElementById('modal-overlay-org');
if (overlayElemOrg) {
    overlayElemOrg.addEventListener('click', (e) => {
        if (e.target === overlayElemOrg) cerrarModalesOrg();
    });
}

function abrirModalEventoOrg(id = null, datos = {}) {
    cerrarModalesOrg();
    const overlay = document.getElementById('modal-overlay-org');
    const modal = document.getElementById('modal-evento-org');
    const tit = document.getElementById('modal-evento-org-titulo');
    const inputId = document.getElementById('input-org-evento-id');
    const inputNom = document.getElementById('input-org-evento-nombre');
    const inputDesc = document.getElementById('input-org-evento-desc');
    const inputFecha = document.getElementById('input-org-evento-fecha');
    const inputCat = document.getElementById('input-org-evento-cat');
    const btnEliminar = document.getElementById('btn-org-eliminar-evento');
    const inputImgData = document.getElementById('input-org-evento-imagen-data');
    const inputImgFile = document.getElementById('input-org-evento-imagen');
    const previewDiv = document.getElementById('preview-org-evento-imagen');
    const previewImg = document.getElementById('img-org-evento-preview');

    if (inputImgFile) {
        inputImgFile.value = '';
        inputImgFile.onchange = function () {
            const file = this.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (ev) {
                if (inputImgData) inputImgData.value = ev.target.result;
                if (previewImg) previewImg.src = ev.target.result;
                if (previewDiv) previewDiv.style.display = 'block';
            };
            reader.readAsDataURL(file);
        };
    }

    if (id) {
        tit.textContent = 'Modificar Evento';
        inputId.value = id;
        inputNom.value = datos.titulo || '';
        inputDesc.value = datos.descripcion || '';
        inputFecha.value = datos.fecha || fechaSeleccionada;
        inputCat.value = datos.categoria || 'General';
        btnEliminar.style.display = 'inline-block';
        if (datos.imagen && previewImg && previewDiv) {
            inputImgData.value = datos.imagen;
            previewImg.src = datos.imagen;
            previewDiv.style.display = 'block';
        } else {
            if (inputImgData) inputImgData.value = '';
            if (previewDiv) previewDiv.style.display = 'none';
        }
    } else {
        tit.textContent = 'Nuevo Evento en Calendario';
        inputId.value = '';
        inputNom.value = '';
        inputDesc.value = '';
        inputFecha.value = datos.fecha || fechaSeleccionada;
        inputCat.value = 'General';
        btnEliminar.style.display = 'none';
        if (inputImgData) inputImgData.value = '';
        if (previewDiv) previewDiv.style.display = 'none';
    }

    overlay.classList.add('active');
    modal.classList.add('active');
    inputNom.focus();
}

function guardarEventoOrg(e) {
    e.preventDefault();
    const id = document.getElementById('input-org-evento-id').value;
    const nombre = document.getElementById('input-org-evento-nombre').value.trim();
    const desc = document.getElementById('input-org-evento-desc').value.trim();
    const fecha = document.getElementById('input-org-evento-fecha').value;
    const cat = document.getElementById('input-org-evento-cat').value;
    const imagen = document.getElementById('input-org-evento-imagen-data')?.value || '';

    if (!nombre) return;

    const nuevoEvento = {
        id: id || 'e_' + Date.now(),
        titulo: nombre,
        descripcion: desc,
        fecha: fecha,
        categoria: cat,
        imagen: imagen
    };

    let eventos = obtenerEventosStorage();
    const idx = eventos.findIndex(ev => ev.id === nuevoEvento.id);
    if (idx >= 0) {
        eventos[idx] = nuevoEvento;
        registrarAccion(`Modificó evento "${nombre}"`);
    } else {
        eventos.push(nuevoEvento);
        registrarAccion(`Creó evento "${nombre}"`);
    }
    localStorage.setItem('control_one_eventos', JSON.stringify(eventos));

    fetch('http://127.0.0.1:5000/api/organizacion/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevoEvento)
    }).catch(() => {});

    renderizarCalendario(anioActual, mesActual);
    cerrarModalesOrg();
}

function eliminarEventoOrg() {
    const id = document.getElementById('input-org-evento-id').value;
    if (!id) return;

    if (confirm('¿Deseas eliminar este evento?')) {
        let eventos = obtenerEventosStorage();
        const ev = eventos.find(e => e.id === id);
        if (ev) registrarAccion(`Eliminó evento "${ev.titulo}"`);

        eventos = eventos.filter(e => e.id !== id);
        localStorage.setItem('control_one_eventos', JSON.stringify(eventos));

        fetch('http://127.0.0.1:5000/api/organizacion/eventos/eliminar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        }).catch(() => {});

        renderizarCalendario(anioActual, mesActual);
        cerrarModalesOrg();
    }
}

function guardarDatosStorage() {
    localStorage.setItem('control_one_categorias_list', JSON.stringify(categoriasList));
    localStorage.setItem('control_one_tareas_list', JSON.stringify(tareasList));
    localStorage.setItem('control_one_vis_cat1', visibleCard1CatId);
    localStorage.setItem('control_one_vis_cat2', visibleCard2CatId);
}

function cargarDatosStorage() {
    const savedCats = localStorage.getItem('control_one_categorias_list');
    if (savedCats) {
        try { categoriasList = JSON.parse(savedCats); } catch (e) {}
    }

    const savedTareas = localStorage.getItem('control_one_tareas_list');
    if (savedTareas) {
        try { tareasList = JSON.parse(savedTareas); } catch (e) {}
    }

    const v1 = localStorage.getItem('control_one_vis_cat1');
    if (v1) visibleCard1CatId = v1;
    const v2 = localStorage.getItem('control_one_vis_cat2');
    if (v2) visibleCard2CatId = v2;
}

function obtenerEventosStorage() {
    const guardados = localStorage.getItem('control_one_eventos');
    if (guardados) {
        try { return JSON.parse(guardados); } catch (e) {}
    }
    return [
        { id: 'e1', titulo: 'Cumpleaños Mama', descripcion: 'hoy es el cumpleaños de tu Mama', fecha: '2026-08-30' },
        { id: 'e2', titulo: 'Entrega de Proyecto', descripcion: 'Revisión final de Control One', fecha: '2026-08-27' },
        { id: 'e3', titulo: 'Reunión de Planificación', descripcion: 'Planificar tareas', fecha: '2026-08-31' }
    ];
}

async function cargarDatosBackend() {
    try {
        const res = await fetch('http://127.0.0.1:5000/api/organizacion/datos');
        if (res.ok) {
            const data = await res.json();
            if (data.categorias && data.categorias.length > 0) {
                const cats = [];
                const tasks = [];
                data.categorias.forEach(c => {
                    cats.push({ id: c.id, nombre: c.nombre, color: c.color });
                    if (Array.isArray(c.tareas)) {
                        c.tareas.forEach(t => {
                            tasks.push({
                                id: t.id,
                                titulo: t.titulo,
                                categoria_id: c.id,
                                prioridad: t.prioridad || 'media'
                            });
                        });
                    }
                });
                if (cats.length > 0) categoriasList = cats;
                if (tasks.length > 0) tareasList = tasks;
                guardarDatosStorage();
                renderizarTarjetasPrincipales();
            }
            if (Array.isArray(data.eventos)) {
                localStorage.setItem('control_one_eventos', JSON.stringify(data.eventos));
                renderizarCalendario(anioActual, mesActual);
            }
        }
    } catch (e) {}
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