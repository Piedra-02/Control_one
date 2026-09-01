const API_BASE = 'http://127.0.0.1:5000/api';

lucide.createIcons();

async function apiFetch(path, opciones = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(1500),
      ...opciones,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return null;
    return data;
  } catch (err) {
    return null;
  }
}

const tabs = document.querySelectorAll('.tab-pill');
const panels = document.querySelectorAll('.panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById(tab.dataset.target);
    if (target) target.classList.add('active');
  });
});

let reglaSeleccionada = null;
const reglaOptions = document.querySelectorAll('.regla-option');

reglaOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    reglaOptions.forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    reglaSeleccionada = opt.dataset.value;
    actualizarVistaPrevia();
  });
});

const nombreInput = document.getElementById('nombre');
const areaSelect = document.getElementById('area');
const descripcionInput = document.getElementById('descripcion');
const condicionInput = document.getElementById('condicion');
const previewBox = document.getElementById('previewBox');

const ETIQUETAS_REGLA = {
  bidireccional: 'Bidireccional',
  direccional: 'Direccional',
  solo_si_se_cumple_condicion: 'Solo cuando se cumpla condición',
  depurador_detallado: 'Depurador detallado',
  solo_si_no_se_cumple_condicion: 'Solo cuando no se cumpla la condición',
};

function actualizarVistaPrevia() {
  const nombre = nombreInput ? nombreInput.value.trim() : '';
  const area = areaSelect ? areaSelect.value : 'Tareas';
  const descripcion = descripcionInput ? descripcionInput.value.trim() : '';
  const condicion = condicionInput ? condicionInput.value.trim() : '';

  if (!nombre && !descripcion && !reglaSeleccionada && !condicion) {
    if (previewBox) {
      previewBox.innerHTML = '<p class="text-secondary">Completa "Acciones" y "Reglas" para ver aquí el resumen.</p>';
    }
    return;
  }

  if (previewBox) {
    previewBox.innerHTML = `
      <dl>
        <dt>Nombre</dt><dd>${escapeHTML(nombre) || '—'}</dd>
        <dt>Área</dt><dd>${escapeHTML(area) || '—'}</dd>
        <dt>Acción</dt><dd>${escapeHTML(descripcion) || '—'}</dd>
        <dt>Regla</dt><dd>${reglaSeleccionada ? ETIQUETAS_REGLA[reglaSeleccionada] : '—'}</dd>
        <dt>Condición</dt><dd>${escapeHTML(condicion) || '—'}</dd>
      </dl>
    `;
  }
}

[nombreInput, areaSelect, descripcionInput, condicionInput].forEach(el => {
  if (el) el.addEventListener('input', actualizarVistaPrevia);
});

const historialList = document.getElementById('historialList');

function obtenerHistorialLocal() {
  return JSON.parse(localStorage.getItem('control_one_historial_auto') || '[]');
}

function guardarHistorialLocal(lista) {
  localStorage.setItem('control_one_historial_auto', JSON.stringify(lista));
}

async function cargarHistorial() {
  if (!historialList) return;

  let historial = await apiFetch('/automatizaciones/historial');
  if (!historial) {
    historial = obtenerHistorialLocal();
  } else {
    guardarHistorialLocal(historial);
  }

  historialList.innerHTML = '';
  if (!historial || historial.length === 0) {
    historialList.innerHTML = '<li class="historial-empty text-secondary" style="padding:12px; text-align:center;">Aún no hay automatizaciones guardadas.</li>';
    return;
  }

  historial.forEach((item, index) => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.justifyContent = 'space-between';
    li.style.padding = '10px 12px';
    li.style.borderBottom = '1px solid rgba(0,0,0,0.06)';
    li.style.gap = '8px';

    const fechaObj = new Date(item.fecha_ejecucion || item.fecha || Date.now());
    const hora = fechaObj.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    const fecha = fechaObj.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
    const activa = item.activa !== false;

    li.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
        <i data-lucide="${activa ? 'check-circle-2' : 'pause-circle'}" width="18" height="18" style="color: ${activa ? '#10b981' : '#94a3b8'}; flex-shrink:0;"></i>
        <div style="display:flex; flex-direction:column; min-width:0;">
          <strong style="font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(item.automatizacion_nombre || item.nombre || 'Automatización')}</strong>
          <small style="color:#64748b; font-size:11px;">${escapeHTML(item.area || 'General')} • ${escapeHTML(item.descripcion || item.condicion || 'Regla activa')}</small>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
        <button class="btn-toggle-auto" onclick="alternarEstadoAutomatizacion('${item.automatizacion_id || item.id || index}')" style="background:${activa ? '#e0f2fe' : '#f1f5f9'}; color:${activa ? '#0284c7' : '#64748b'}; border:none; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer; font-weight:600;">
          ${activa ? 'Activa' : 'Pausada'}
        </button>
        <span class="text-secondary" style="font-size:11px;">${fecha} ${hora}</span>
        <button onclick="eliminarAutomatizacion('${item.id || index}')" style="background:none; border:none; color:#ef4444; cursor:pointer; padding:4px;" title="Eliminar regla">
          <i data-lucide="trash-2" width="14" height="14"></i>
        </button>
      </div>
    `;
    historialList.appendChild(li);
  });
  lucide.createIcons();
}

async function alternarEstadoAutomatizacion(idOrIndex) {
  // Intenta actualizar en la base de datos real primero (solo si es un id
  // real de la BD, no uno generado localmente como "auto_..." o "exec_...")
  const esIdReal = idOrIndex && !String(idOrIndex).startsWith('auto_') && !String(idOrIndex).startsWith('exec_');
  if (esIdReal) {
    await apiFetch(`/automatizaciones/${idOrIndex}/toggle`, { method: 'POST' });
  }

  let historial = obtenerHistorialLocal();
  const item = historial.find(h => String(h.id) === String(idOrIndex) || String(h.automatizacion_id) === String(idOrIndex)) || historial[idOrIndex];
  if (item) {
    item.activa = item.activa === false ? true : false;
    guardarHistorialLocal(historial);
  }
  await cargarHistorial();
}

async function eliminarAutomatizacion(idOrIndex) {
  if (!confirm('¿Eliminar esta automatización del historial?')) return;

  // Intenta eliminar en la base de datos real primero (solo si es un id
  // real de la BD, no uno generado localmente como "auto_..." o "exec_...")
  const esIdReal = idOrIndex && !String(idOrIndex).startsWith('auto_') && !String(idOrIndex).startsWith('exec_');
  if (esIdReal) {
    await apiFetch(`/automatizaciones/historial/${idOrIndex}`, { method: 'DELETE' });
  }

  let historial = obtenerHistorialLocal();
  historial = historial.filter((h, idx) => String(h.id) !== String(idOrIndex) && String(idx) !== String(idOrIndex));
  guardarHistorialLocal(historial);

  await cargarHistorial();
}

window.alternarEstadoAutomatizacion = alternarEstadoAutomatizacion;
window.eliminarAutomatizacion = eliminarAutomatizacion;

const btnGuardar = document.getElementById('btnGuardar');
if (btnGuardar) {
  btnGuardar.addEventListener('click', async () => {
    const nombre = nombreInput ? nombreInput.value.trim() : '';
    const area = areaSelect ? areaSelect.value : 'Tareas';
    const descripcion = descripcionInput ? descripcionInput.value.trim() : '';
    const condicion = condicionInput ? condicionInput.value.trim() : '';

    if (!nombre) {
      alert('Ingresa un nombre para la automatización antes de guardar.');
      if (nombreInput) nombreInput.focus();
      return;
    }
    if (!reglaSeleccionada) {
      alert('Selecciona una regla en la pestaña "Reglas" antes de guardar.');
      return;
    }

    const nuevaAuto = {
      id: 'auto_' + Date.now(),
      nombre,
      automatizacion_nombre: nombre,
      area,
      descripcion,
      tipo_regla: reglaSeleccionada,
      condicion,
      activa: true,
      fecha_ejecucion: new Date().toISOString()
    };

    let historial = obtenerHistorialLocal();
    historial.unshift(nuevaAuto);
    guardarHistorialLocal(historial);

    apiFetch('/automatizaciones', {
      method: 'POST',
      body: JSON.stringify(nuevaAuto),
    }).catch(() => {});

    if (nombreInput) nombreInput.value = '';
    if (descripcionInput) descripcionInput.value = '';
    if (condicionInput) condicionInput.value = '';
    reglaOptions.forEach(o => o.classList.remove('selected'));
    reglaSeleccionada = null;
    actualizarVistaPrevia();

    await cargarHistorial();

    const primerItem = historialList ? historialList.querySelector('li') : null;
    if (primerItem) primerItem.classList.add('historial-item-nuevo');
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

window.evaluarAutomatizaciones = evaluarAutomatizaciones;

cargarHistorial();