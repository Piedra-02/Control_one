// =========================================================
// Control One — Automatización
// Conectado a la API real (ver carpeta /api, archivo app.py).
// Asegúrate de tener el servidor Flask corriendo en
// http://127.0.0.1:5000 antes de usar esta pantalla.
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
    if (!res.ok) {
      throw new Error((data && data.error) || `Error ${res.status}`);
    }
    return data;
  } catch (err) {
    alert('No se pudo conectar con el servidor. ¿Está corriendo "python app.py" en la carpeta /api?\n\n' + err.message);
    throw err;
  }
}

// ---------- Tabs ----------
const tabs = document.querySelectorAll('.tab-pill');
const panels = document.querySelectorAll('.panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.target).classList.add('active');
  });
});

// ---------- Selección de Regla ----------
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

// ---------- Vista previa en vivo ----------
const nombreInput = document.getElementById('nombre');
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
  const nombre = nombreInput.value.trim();
  const descripcion = descripcionInput.value.trim();
  const condicion = condicionInput.value.trim();

  if (!nombre && !descripcion && !reglaSeleccionada && !condicion) {
    previewBox.innerHTML = '<p class="text-secondary">Completa "Acciones" y "Reglas" para ver aquí el resumen.</p>';
    return;
  }

  previewBox.innerHTML = `
    <dl>
      <dt>Nombre</dt><dd>${nombre || '—'}</dd>
      <dt>Descripción</dt><dd>${descripcion || '—'}</dd>
      <dt>Regla</dt><dd>${reglaSeleccionada ? ETIQUETAS_REGLA[reglaSeleccionada] : '—'}</dd>
      <dt>Condición</dt><dd>${condicion || '—'}</dd>
    </dl>
  `;
}

[nombreInput, descripcionInput, condicionInput].forEach(el => {
  el.addEventListener('input', actualizarVistaPrevia);
});

// ---------- Historial (desde la base de datos) ----------
const historialList = document.getElementById('historialList');

async function cargarHistorial() {
  const historial = await apiFetch('/automatizaciones/historial');
  if (!historial) return;

  historialList.innerHTML = '';
  if (historial.length === 0) {
    historialList.innerHTML = '<li class="historial-empty text-secondary">Aún no hay automatizaciones guardadas.</li>';
    return;
  }

  historial.forEach(item => {
    const li = document.createElement('li');
    const hora = new Date(item.fecha_ejecucion).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `<i data-lucide="check-circle-2" width="16" height="16"></i> ${item.automatizacion_nombre} <span class="text-secondary" style="margin-left:auto;">${hora}</span>`;
    historialList.appendChild(li);
  });
  lucide.createIcons();
}

// ---------- Guardar automatización ----------
document.getElementById('btnGuardar').addEventListener('click', async () => {
  const nombre = nombreInput.value.trim();
  const descripcion = descripcionInput.value.trim();
  const condicion = condicionInput.value.trim();

  if (!nombre) {
    alert('Ingresa un nombre para la automatización antes de guardar.');
    nombreInput.focus();
    return;
  }
  if (!reglaSeleccionada) {
    alert('Selecciona una regla en la pestaña "Reglas" antes de guardar.');
    return;
  }

  const creada = await apiFetch('/automatizaciones', {
    method: 'POST',
    body: JSON.stringify({ nombre, descripcion, tipo_regla: reglaSeleccionada, condicion }),
  });
  if (!creada) return;

  // Limpiar formulario
  nombreInput.value = '';
  descripcionInput.value = '';
  condicionInput.value = '';
  reglaOptions.forEach(o => o.classList.remove('selected'));
  reglaSeleccionada = null;
  actualizarVistaPrevia();

  await cargarHistorial();
});

// ---------- Inicializar ----------
cargarHistorial();
