/**
 * Asesor de Autoevaluación AWS
 * Lógica principal: carga de cuestionario, respuestas, análisis de gaps y reporte.
 */

// ─────────────────────────────────────────────
// ESTADO DE LA APLICACIÓN
// ─────────────────────────────────────────────
const state = {
  /** @type {{ titulo: string, categorias: Array } | null} */
  cuestionario: null,
  /** @type {Record<string, { estado: string, nota: string }>} */
  respuestas: {},
};

// ─────────────────────────────────────────────
// REFERENCIAS AL DOM
// ─────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const elements = {
  loadingPanel:       $('loading-panel'),
  questionnaireSection: $('questionnaire-section'),
  analysisSection:    $('analysis-section'),
  categoriesContainer: $('categories-container'),
  errorBanner:        $('error-banner'),
  errorMessage:       $('error-message'),
  progressFill:       $('progress-fill'),
  progressLabel:      $('progress-label'),
  progressBar:        document.querySelector('.progress-bar-container'),
  btnAnalizar:        $('btn-analizar'),
  btnReporte:         $('btn-reporte'),
  btnVolver:          $('btn-volver'),
  statCumple:         $('stat-cumple'),
  statParcial:        $('stat-parcial'),
  statNoCumple:       $('stat-nocumple'),
  statPorcentaje:     $('stat-porcentaje'),
  gapsList:           $('gaps-list'),
  reportModal:        $('report-modal'),
  reportPreview:      $('report-preview'),
  btnDescargarMd:     $('btn-descargar-md'),
  btnDescargarJson:   $('btn-descargar-json'),
  btnCerrarModal:     $('btn-cerrar-modal'),
};

// ─────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  cargarCuestionario();

  elements.btnAnalizar.addEventListener('click', mostrarAnalisis);
  elements.btnVolver.addEventListener('click', mostrarCuestionario);
  elements.btnReporte.addEventListener('click', abrirModal);
  elements.btnCerrarModal.addEventListener('click', cerrarModal);
  elements.btnDescargarMd.addEventListener('click', descargarMarkdown);
  elements.btnDescargarJson.addEventListener('click', descargarJSON);

  // Cerrar modal al hacer clic fuera
  elements.reportModal.addEventListener('click', (e) => {
    if (e.target === elements.reportModal) cerrarModal();
  });

  // Cerrar modal con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elements.reportModal.classList.contains('hidden')) {
      cerrarModal();
    }
  });
});

// ─────────────────────────────────────────────
// CARGA DEL CUESTIONARIO (R1)
// ─────────────────────────────────────────────
async function cargarCuestionario() {
  try {
    const res = await fetch('data/questionnaire.json');

    if (!res.ok) {
      throw new Error(`No se pudo obtener el cuestionario (HTTP ${res.status}).`);
    }

    const data = await res.json();
    validarEstructura(data);

    state.cuestionario = data;
    renderizarCuestionario(data);

  } catch (err) {
    mostrarError(
      err instanceof SyntaxError
        ? 'El archivo JSON del cuestionario es inválido. Revisa su formato.'
        : err.message
    );
    elements.loadingPanel.classList.add('hidden');
  }
}

/** Valida que el JSON tenga la estructura mínima esperada. */
function validarEstructura(data) {
  if (!data || typeof data !== 'object') throw new Error('El cuestionario no es un objeto JSON válido.');
  if (!Array.isArray(data.categorias) || data.categorias.length === 0) {
    throw new Error('El cuestionario no contiene ninguna categoría.');
  }
  for (const cat of data.categorias) {
    if (!Array.isArray(cat.criterios) || cat.criterios.length === 0) {
      throw new Error(`La categoría "${cat.nombre || cat.id}" no tiene criterios.`);
    }
  }
}

// ─────────────────────────────────────────────
// RENDER DEL CUESTIONARIO
// ─────────────────────────────────────────────
function renderizarCuestionario(data) {
  elements.categoriesContainer.innerHTML = '';

  for (const categoria of data.categorias) {
    const card = crearTarjetaCategoria(categoria);
    elements.categoriesContainer.appendChild(card);
  }

  elements.loadingPanel.classList.add('hidden');
  elements.questionnaireSection.classList.remove('hidden');
  actualizarProgreso();
}

function crearTarjetaCategoria(categoria) {
  const card = document.createElement('div');
  card.className = 'category-card';
  card.dataset.catId = categoria.id;

  // Cabecera colapsable
  const header = document.createElement('div');
  header.className = 'category-header';
  header.setAttribute('role', 'button');
  header.setAttribute('tabindex', '0');
  header.setAttribute('aria-expanded', 'true');
  header.innerHTML = `
    <span class="category-title">${escapeHtml(categoria.nombre)}</span>
    <span class="category-meta">
      <span class="category-progress-text" data-cat-progress="${categoria.id}">0 / ${categoria.criterios.length}</span>
      <span class="category-chevron">▼</span>
    </span>
  `;

  header.addEventListener('click', () => toggleCategoria(card, header));
  header.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleCategoria(card, header);
    }
  });

  // Lista de criterios
  const lista = document.createElement('ul');
  lista.className = 'criteria-list';

  for (const criterio of categoria.criterios) {
    const item = crearItemCriterio(criterio, categoria.nombre);
    lista.appendChild(item);
  }

  card.appendChild(header);
  card.appendChild(lista);
  return card;
}

function crearItemCriterio(criterio, nombreCategoria) {
  const li = document.createElement('li');
  li.className = 'criterion-item';
  li.dataset.critId = criterio.id;

  const nivelClass = `level-${criterio.nivel}`;

  li.innerHTML = `
    <div class="criterion-content">
      <p class="criterion-desc">${escapeHtml(criterio.descripcion)}</p>
      <span class="criterion-level ${nivelClass}">${escapeHtml(criterio.nivel)}</span>
    </div>
    <div class="criterion-controls">
      <div class="radio-group" role="radiogroup" aria-label="Estado de cumplimiento">
        <label class="radio-label radio-cumple">
          <input type="radio" name="${criterio.id}" value="cumple" />
          Cumple
        </label>
        <label class="radio-label radio-parcial">
          <input type="radio" name="${criterio.id}" value="parcial" />
          Parcial
        </label>
        <label class="radio-label radio-nocumple">
          <input type="radio" name="${criterio.id}" value="no-cumple" />
          No cumple
        </label>
      </div>
      <textarea
        class="evidencia-input"
        placeholder="Nota de evidencia (opcional)…"
        aria-label="Nota de evidencia para ${escapeHtml(criterio.descripcion)}"
        data-crit-nota="${criterio.id}"
      ></textarea>
    </div>
  `;

  // Eventos
  const radios = li.querySelectorAll(`input[name="${criterio.id}"]`);
  radios.forEach((radio) => {
    radio.addEventListener('change', () => {
      registrarRespuesta(criterio.id, radio.value);
      actualizarProgresoCat(criterio.id);
      actualizarProgreso();
    });
  });

  const textarea = li.querySelector(`[data-crit-nota="${criterio.id}"]`);
  textarea.addEventListener('input', () => {
    registrarNota(criterio.id, textarea.value);
  });

  return li;
}

function toggleCategoria(card, header) {
  const expanded = header.getAttribute('aria-expanded') === 'true';
  header.setAttribute('aria-expanded', String(!expanded));
  card.classList.toggle('collapsed', expanded);
}

// ─────────────────────────────────────────────
// REGISTRO DE RESPUESTAS (R2)
// ─────────────────────────────────────────────
function registrarRespuesta(critId, estado) {
  if (!state.respuestas[critId]) state.respuestas[critId] = { estado: '', nota: '' };
  state.respuestas[critId].estado = estado;
  habilitarBotones();
}

function registrarNota(critId, nota) {
  if (!state.respuestas[critId]) state.respuestas[critId] = { estado: '', nota: '' };
  state.respuestas[critId].nota = nota;
}

function habilitarBotones() {
  const hayRespuestas = Object.values(state.respuestas).some((r) => r.estado !== '');
  elements.btnAnalizar.disabled = !hayRespuestas;
  elements.btnReporte.disabled = !hayRespuestas;
}

// ─────────────────────────────────────────────
// PROGRESO
// ─────────────────────────────────────────────
function actualizarProgreso() {
  const total = contarCriteriosTotal();
  const respondidos = Object.values(state.respuestas).filter((r) => r.estado !== '').length;
  const pct = total === 0 ? 0 : Math.round((respondidos / total) * 100);

  elements.progressFill.style.width = `${pct}%`;
  elements.progressLabel.textContent = `${pct}% completado (${respondidos} / ${total} criterios)`;
  elements.progressBar.setAttribute('aria-valuenow', pct);
}

function actualizarProgresoCat(critId) {
  const cat = encontrarCategoriaDeCriterio(critId);
  if (!cat) return;

  const respondidosEnCat = cat.criterios.filter(
    (c) => state.respuestas[c.id]?.estado
  ).length;

  const el = document.querySelector(`[data-cat-progress="${cat.id}"]`);
  if (el) el.textContent = `${respondidosEnCat} / ${cat.criterios.length}`;
}

// ─────────────────────────────────────────────
// ANÁLISIS DE GAPS (R3)
// ─────────────────────────────────────────────
function calcularStats() {
  let cumple = 0, parcial = 0, noCumple = 0, total = 0;

  for (const cat of state.cuestionario.categorias) {
    for (const crit of cat.criterios) {
      const resp = state.respuestas[crit.id];
      if (!resp?.estado) continue;
      total++;
      if (resp.estado === 'cumple')     cumple++;
      else if (resp.estado === 'parcial')  parcial++;
      else if (resp.estado === 'no-cumple') noCumple++;
    }
  }

  const porcentaje = total === 0 ? 0 : Math.round((cumple / total) * 100);
  return { cumple, parcial, noCumple, total, porcentaje };
}

function obtenerGaps() {
  const gaps = [];
  for (const cat of state.cuestionario.categorias) {
    for (const crit of cat.criterios) {
      const resp = state.respuestas[crit.id];
      if (resp?.estado === 'parcial' || resp?.estado === 'no-cumple') {
        gaps.push({ crit, categoria: cat.nombre, resp });
      }
    }
  }
  return gaps;
}

function mostrarAnalisis() {
  const stats = calcularStats();
  const gaps = obtenerGaps();

  elements.statCumple.textContent      = stats.cumple;
  elements.statParcial.textContent     = stats.parcial;
  elements.statNoCumple.textContent    = stats.noCumple;
  elements.statPorcentaje.textContent  = `${stats.porcentaje}%`;

  elements.gapsList.innerHTML = '';

  if (gaps.length === 0) {
    elements.gapsList.innerHTML = `
      <div class="no-gaps-msg">🎉 ¡Sin gaps! Todos los criterios respondidos cumplen el estándar.</div>
    `;
  } else {
    for (const { crit, categoria, resp } of gaps) {
      const item = document.createElement('div');
      item.className = 'gap-item';
      const badgeClass = resp.estado === 'parcial' ? 'badge-parcial' : 'badge-nocumple';
      const badgeText  = resp.estado === 'parcial' ? 'Parcial' : 'No cumple';
      item.innerHTML = `
        <span class="gap-badge ${badgeClass}">${badgeText}</span>
        <div class="gap-content">
          <p class="gap-desc">${escapeHtml(crit.descripcion)}</p>
          <span class="gap-cat">📂 ${escapeHtml(categoria)}</span>
          ${resp.nota ? `<span class="gap-nota">📝 ${escapeHtml(resp.nota)}</span>` : ''}
        </div>
      `;
      elements.gapsList.appendChild(item);
    }
  }

  elements.questionnaireSection.classList.add('hidden');
  elements.analysisSection.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function mostrarCuestionario() {
  elements.analysisSection.classList.add('hidden');
  elements.questionnaireSection.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─────────────────────────────────────────────
// REPORTE DE EVIDENCIA (R4)
// ─────────────────────────────────────────────
function generarReporteMarkdown() {
  const stats = calcularStats();
  const gaps  = obtenerGaps();
  const fecha = new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });

  let md = `# Reporte de Evidencia — ${state.cuestionario.titulo}\n\n`;
  md += `**Fecha de generación:** ${fecha}\n\n`;
  md += `---\n\n`;
  md += `## Resumen de cumplimiento\n\n`;
  md += `| Estado      | Cantidad |\n`;
  md += `|-------------|----------|\n`;
  md += `| ✅ Cumple    | ${stats.cumple}        |\n`;
  md += `| ⚠️ Parcial   | ${stats.parcial}       |\n`;
  md += `| ❌ No cumple | ${stats.noCumple}      |\n`;
  md += `\n**Cumplimiento global: ${stats.porcentaje}%**\n\n`;
  md += `---\n\n`;
  md += `## Detalle por categoría\n\n`;

  for (const cat of state.cuestionario.categorias) {
    const tieneRespuestas = cat.criterios.some((c) => state.respuestas[c.id]?.estado);
    if (!tieneRespuestas) continue;

    md += `### ${cat.nombre}\n\n`;
    for (const crit of cat.criterios) {
      const resp = state.respuestas[crit.id];
      if (!resp?.estado) continue;
      const estadoLabel = { cumple: '✅ Cumple', parcial: '⚠️ Parcial', 'no-cumple': '❌ No cumple' }[resp.estado] || resp.estado;
      md += `- **${estadoLabel}** — ${crit.descripcion}\n`;
      if (resp.nota) md += `  - _Evidencia:_ ${resp.nota}\n`;
    }
    md += '\n';
  }

  if (gaps.length > 0) {
    md += `---\n\n## Gaps identificados (${gaps.length})\n\n`;
    for (const { crit, categoria, resp } of gaps) {
      const estadoLabel = resp.estado === 'parcial' ? '⚠️ Parcial' : '❌ No cumple';
      md += `- **${estadoLabel}** — ${crit.descripcion} _(${categoria})_\n`;
      if (resp.nota) md += `  - _Nota:_ ${resp.nota}\n`;
    }
  }

  return md;
}

function generarReporteJSON() {
  const stats = calcularStats();
  const gaps  = obtenerGaps();

  const detalle = [];
  for (const cat of state.cuestionario.categorias) {
    for (const crit of cat.criterios) {
      const resp = state.respuestas[crit.id];
      if (!resp?.estado) continue;
      detalle.push({
        criterio:  crit.descripcion,
        categoria: cat.nombre,
        nivel:     crit.nivel,
        estado:    resp.estado,
        evidencia: resp.nota || '',
      });
    }
  }

  return {
    titulo: state.cuestionario.titulo,
    fechaGeneracion: new Date().toISOString(),
    resumen: {
      cumple:         stats.cumple,
      parcial:        stats.parcial,
      noCumple:       stats.noCumple,
      porcentajeGlobal: `${stats.porcentaje}%`,
    },
    detalle,
    gaps: gaps.map(({ crit, categoria, resp }) => ({
      criterio:  crit.descripcion,
      categoria,
      estado:    resp.estado,
      evidencia: resp.nota || '',
    })),
  };
}

/**
 * Devuelve los criterios marcados como "Cumple" que no tienen nota de evidencia.
 * @returns {{ crit: object, categoria: string }[]}
 */
function obtenerCumplesSinEvidencia() {
  const sinEvidencia = [];
  for (const cat of state.cuestionario.categorias) {
    for (const crit of cat.criterios) {
      const resp = state.respuestas[crit.id];
      if (resp?.estado === 'cumple' && !resp.nota.trim()) {
        sinEvidencia.push({ crit, categoria: cat.nombre });
      }
    }
  }
  return sinEvidencia;
}

function abrirModal() {
  const sinEvidencia = obtenerCumplesSinEvidencia();
  const avisoEl = elements.reportModal.querySelector('#aviso-sin-evidencia');

  if (sinEvidencia.length > 0) {
    const lista = sinEvidencia
      .map(({ crit, categoria }) => `• [${escapeHtml(categoria)}] ${escapeHtml(crit.descripcion)}`)
      .join('\n');
    avisoEl.querySelector('#aviso-lista').textContent = lista;
    avisoEl.classList.remove('hidden');
  } else {
    avisoEl.classList.add('hidden');
  }

  const md = generarReporteMarkdown();
  elements.reportPreview.textContent = md;
  elements.reportModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function cerrarModal() {
  elements.reportModal.classList.add('hidden');
  document.body.style.overflow = '';
}

function descargarMarkdown() {
  const md = generarReporteMarkdown();
  descargarArchivo(md, 'reporte-aws.md', 'text/markdown');
}

function descargarJSON() {
  const json = JSON.stringify(generarReporteJSON(), null, 2);
  descargarArchivo(json, 'reporte-aws.json', 'application/json');
}

function descargarArchivo(contenido, nombre, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────
function mostrarError(mensaje) {
  elements.errorMessage.textContent = mensaje;
  elements.errorBanner.classList.remove('hidden');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function contarCriteriosTotal() {
  if (!state.cuestionario) return 0;
  return state.cuestionario.categorias.reduce((sum, cat) => sum + cat.criterios.length, 0);
}

function encontrarCategoriaDeCriterio(critId) {
  if (!state.cuestionario) return null;
  return state.cuestionario.categorias.find((cat) =>
    cat.criterios.some((c) => c.id === critId)
  ) || null;
}
