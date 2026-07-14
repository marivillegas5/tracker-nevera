const MS_DAY = 86400000;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const LEGACY_STORAGE_KEY = 'qhay-tracker-nevera-v1';
const PIN_OK_KEY = 'qhay-pin-ok';
const MIGRATED_KEY = 'qhay-migrated-to-supabase';

const db = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

function normalize(str) {
  return (str || '').trim().toLowerCase();
}

function toDateOnly(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, date.getDate());
}

function fmtISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fmtShort(date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function todayStr() {
  return fmtISO(toDateOnly(new Date()));
}

function parseISODate(str) {
  return new Date(str + 'T00:00:00');
}

function statusFor(fechaVenc) {
  const today = toDateOnly(new Date());
  const diffDays = Math.round((fechaVenc - today) / MS_DAY);
  if (diffDays < 0) return { tone: 'expired', label: `Venció hace ${-diffDays} día${-diffDays === 1 ? '' : 's'}` };
  if (diffDays === 0) return { tone: 'soon', label: 'Vence hoy' };
  if (diffDays <= 5) return { tone: 'soon', label: `Vence en ${diffDays} día${diffDays === 1 ? '' : 's'}` };
  return { tone: 'fresh', label: 'Fresco' };
}

// ---- Lectura/escritura remota (Supabase) ----

function mapProduct(row) {
  return { id: row.id, nombre: row.nombre };
}

function mapPortion(row) {
  return {
    id: row.id,
    productId: row.producto_id,
    fechaEntrada: parseISODate(row.fecha_entrada).getTime(),
    fechaVencimiento: parseISODate(row.fecha_vencimiento).getTime(),
    estado: row.estado,
  };
}

async function fetchAllData() {
  const [productosRes, porcionesRes] = await Promise.all([
    db.from('productos').select('*').order('id'),
    db.from('porciones').select('*').order('id'),
  ]);
  if (productosRes.error) throw productosRes.error;
  if (porcionesRes.error) throw porcionesRes.error;
  return {
    products: productosRes.data.map(mapProduct),
    portions: porcionesRes.data.map(mapPortion),
  };
}

async function insertProduct(nombre) {
  const { data, error } = await db
    .from('productos')
    .insert({ nombre: nombre.trim(), nombre_normalizado: normalize(nombre) })
    .select()
    .single();
  if (error) throw error;
  return mapProduct(data);
}

async function insertPortions(productId, fechaEntradaISO, fechaVencimientoISO, n) {
  const rows = Array.from({ length: n }, () => ({
    producto_id: productId,
    fecha_entrada: fechaEntradaISO,
    fecha_vencimiento: fechaVencimientoISO,
  }));
  const { data, error } = await db.from('porciones').insert(rows).select();
  if (error) throw error;
  return data.map(mapPortion);
}

async function markPortionsConsumed(ids) {
  const { error } = await db.from('porciones').update({ estado: 'consumida' }).in('id', ids);
  if (error) throw error;
}

// ---- Migración de datos locales (Fase 1 -> Supabase) ----

function loadLegacyLocalState() {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function migrateLocalDataIfNeeded(currentProductCount) {
  if (currentProductCount > 0) return null;
  if (localStorage.getItem(MIGRATED_KEY)) return null;

  const local = loadLegacyLocalState();
  if (!local || !local.products || !local.products.length) {
    localStorage.setItem(MIGRATED_KEY, '1');
    return null;
  }

  const idMap = {};
  for (const p of local.products) {
    const inserted = await insertProduct(p.nombre);
    idMap[p.id] = inserted.id;
  }

  const rows = (local.portions || [])
    .filter(por => idMap[por.productId] !== undefined)
    .map(por => ({
      producto_id: idMap[por.productId],
      fecha_entrada: fmtISO(new Date(por.fechaEntrada)),
      fecha_vencimiento: fmtISO(new Date(por.fechaVencimiento)),
      estado: por.estado,
    }));

  if (rows.length) {
    const { error } = await db.from('porciones').insert(rows);
    if (error) throw error;
  }

  localStorage.setItem(MIGRATED_KEY, '1');
  return fetchAllData();
}

// ---- Estado ----

const state = {
  screen: 'pin',
  loading: false,
  products: [],
  portions: [],
  expandedId: null,
  entradaNombre: '',
  entradaPorciones: '',
  entradaFecha: todayStr(),
  entradaErrors: {},
  entradaSubmitting: false,
  salidaProductId: '',
  salidaSelected: [],
  salidaSubmitting: false,
  toastVisible: false,
  toastMessage: '',
};

let toastTimer = null;

function showToast(message) {
  if (toastTimer) clearTimeout(toastTimer);
  state.toastVisible = true;
  state.toastMessage = message;
  render();
  toastTimer = setTimeout(() => {
    state.toastVisible = false;
    render();
  }, 2600);
}

function goScreen(screen) {
  state.screen = screen;
  render();
}

function toggleExpand(id) {
  state.expandedId = state.expandedId === id ? null : id;
  render();
}

function activePortionsByProduct(pid) {
  return state.portions.filter(p => p.productId === pid && p.estado === 'activa');
}

// ---- Carga de datos ----

async function loadData() {
  state.loading = true;
  render();
  try {
    let fresh = await fetchAllData();
    if (fresh.products.length === 0) {
      const migrated = await migrateLocalDataIfNeeded(fresh.products.length);
      if (migrated) fresh = migrated;
    }
    state.products = fresh.products;
    state.portions = fresh.portions;
  } catch (e) {
    showToast('No se pudo conectar con tu inventario. Revisa tu conexión e intenta de nuevo.');
  } finally {
    state.loading = false;
    render();
  }
}

// ---- PIN ----

function submitPin() {
  const val = el.inputPin.value.trim();
  if (val && val === CONFIG.APP_PIN) {
    localStorage.setItem(PIN_OK_KEY, '1');
    el.inputPin.value = '';
    setFieldError(el.fieldPin, null);
    state.screen = 'inventory';
    render();
    loadData();
  } else {
    setFieldError(el.fieldPin, 'PIN incorrecto.');
  }
}

// ---- Entrada ----

async function submitEntrada() {
  if (state.entradaSubmitting) return;
  const { entradaNombre, entradaPorciones, entradaFecha } = state;
  const errors = {};
  if (!entradaNombre.trim()) errors.nombre = 'Escribe el nombre del producto.';
  const n = Number(entradaPorciones);
  if (!entradaPorciones || !Number.isInteger(n) || n < 1) errors.porciones = 'Debe ser un número entero de 1 o más.';
  if (!entradaFecha) {
    errors.fecha = 'Elige una fecha de entrada.';
  } else {
    const fecha = parseISODate(entradaFecha);
    if (fecha > toDateOnly(new Date())) errors.fecha = 'No puede ser una fecha futura.';
  }
  if (Object.keys(errors).length) {
    state.entradaErrors = errors;
    render();
    return;
  }

  state.entradaSubmitting = true;
  render();

  try {
    const norm = normalize(entradaNombre);
    let existing = state.products.find(p => normalize(p.nombre) === norm);
    if (!existing) {
      existing = await insertProduct(entradaNombre);
      state.products = [...state.products, existing];
    }

    const fecha = parseISODate(entradaFecha);
    const vencimiento = addMonths(fecha, 3);
    const newPortions = await insertPortions(existing.id, entradaFecha, fmtISO(vencimiento), n);

    state.portions = [...state.portions, ...newPortions];
    state.entradaNombre = '';
    state.entradaPorciones = '';
    state.entradaFecha = todayStr();
    state.entradaErrors = {};
    state.screen = 'inventory';
    state.entradaSubmitting = false;
    render();
    showToast(`Agregaste ${n} ${n === 1 ? 'porción' : 'porciones'} de ${existing.nombre} a tu nevera.`);
  } catch (e) {
    state.entradaSubmitting = false;
    render();
    showToast('No se pudo guardar la entrada. Intenta de nuevo.');
  }
}

// ---- Salida ----

function togglePortionSelected(id) {
  const has = state.salidaSelected.includes(id);
  state.salidaSelected = has ? state.salidaSelected.filter(x => x !== id) : [...state.salidaSelected, id];
  render();
}

async function submitSalida() {
  if (state.salidaSubmitting) return;
  const { salidaSelected } = state;
  if (!salidaSelected.length) return;

  state.salidaSubmitting = true;
  render();

  try {
    await markPortionsConsumed(salidaSelected);
    state.portions = state.portions.map(p => salidaSelected.includes(p.id) ? { ...p, estado: 'consumida' } : p);
    const count = salidaSelected.length;
    state.salidaProductId = '';
    state.salidaSelected = [];
    state.screen = 'inventory';
    state.salidaSubmitting = false;
    render();
    showToast(`Salida registrada: ${count} ${count === 1 ? 'porción' : 'porciones'}.`);
  } catch (e) {
    state.salidaSubmitting = false;
    render();
    showToast('No se pudo registrar la salida. Intenta de nuevo.');
  }
}

// ---- DOM refs ----
const el = {
  screenPin: document.getElementById('screen-pin'),
  fieldPin: document.getElementById('field-pin'),
  inputPin: document.getElementById('input-pin'),
  btnSubmitPin: document.getElementById('btn-submit-pin'),

  screenInventory: document.getElementById('screen-inventory'),
  screenEntrada: document.getElementById('screen-entrada'),
  screenSalida: document.getElementById('screen-salida'),
  inventorySubtitle: document.getElementById('inventory-subtitle'),
  inventoryList: document.getElementById('inventory-list'),
  btnGoSalida: document.getElementById('btn-go-salida'),
  btnFabEntrada: document.getElementById('btn-fab-entrada'),

  btnEntradaBack: document.getElementById('btn-entrada-back'),
  fieldEntradaNombre: document.getElementById('field-entrada-nombre'),
  inputEntradaNombre: document.getElementById('input-entrada-nombre'),
  fieldEntradaPorciones: document.getElementById('field-entrada-porciones'),
  inputEntradaPorciones: document.getElementById('input-entrada-porciones'),
  fieldEntradaFecha: document.getElementById('field-entrada-fecha'),
  inputEntradaFecha: document.getElementById('input-entrada-fecha'),
  btnSubmitEntrada: document.getElementById('btn-submit-entrada'),

  btnSalidaBack: document.getElementById('btn-salida-back'),
  selectSalidaProducto: document.getElementById('select-salida-producto'),
  noStockMessage: document.getElementById('no-stock-message'),
  salidaPortionsSection: document.getElementById('salida-portions-section'),
  salidaPortionsList: document.getElementById('salida-portions-list'),
  btnSubmitSalida: document.getElementById('btn-submit-salida'),

  toast: document.getElementById('toast'),
};

el.btnSubmitPin.addEventListener('click', submitPin);
el.inputPin.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitPin(); });

el.btnGoSalida.addEventListener('click', () => goScreen('salida'));
el.btnFabEntrada.addEventListener('click', () => goScreen('entrada'));
el.btnEntradaBack.addEventListener('click', () => goScreen('inventory'));
el.btnSalidaBack.addEventListener('click', () => goScreen('inventory'));

el.inputEntradaNombre.addEventListener('input', (e) => { state.entradaNombre = e.target.value; });
el.inputEntradaPorciones.addEventListener('input', (e) => { state.entradaPorciones = e.target.value; });
el.inputEntradaFecha.addEventListener('input', (e) => { state.entradaFecha = e.target.value; });
el.btnSubmitEntrada.addEventListener('click', submitEntrada);

el.selectSalidaProducto.addEventListener('change', (e) => {
  state.salidaProductId = e.target.value;
  state.salidaSelected = [];
  render();
});
el.btnSubmitSalida.addEventListener('click', submitSalida);

function setFieldError(fieldEl, message) {
  const msgEl = fieldEl.querySelector('.error-message');
  if (message) {
    fieldEl.classList.add('has-error');
    msgEl.textContent = message;
  } else {
    fieldEl.classList.remove('has-error');
    msgEl.textContent = '';
  }
}

function renderInventory() {
  if (state.loading) {
    el.inventorySubtitle.textContent = 'Cargando…';
    el.inventoryList.innerHTML = '<div class="hint" style="padding: 60px 0; text-align:center;">Cargando tu inventario…</div>';
    return;
  }

  const products = state.products;

  const productSummaries = products.map(p => {
    const active = activePortionsByProduct(p.id).slice().sort((a, b) => a.fechaEntrada - b.fechaEntrada);
    if (!active.length) return null;
    const nearest = active.reduce((min, cur) => cur.fechaVencimiento < min.fechaVencimiento ? cur : min, active[0]);
    const status = statusFor(new Date(nearest.fechaVencimiento));
    const expanded = state.expandedId === p.id;
    return { product: p, active, status, expanded };
  }).filter(Boolean);

  const hasInventory = productSummaries.length > 0;
  el.inventorySubtitle.textContent = hasInventory
    ? `${productSummaries.length} producto${productSummaries.length === 1 ? '' : 's'} guardados`
    : 'Nada guardado todavía';

  el.inventoryList.innerHTML = '';

  if (hasInventory) {
    productSummaries.forEach(({ product, active, status, expanded }) => {
      const card = document.createElement('div');
      card.className = 'card interactive';

      const row = document.createElement('div');
      row.className = 'product-row';
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => toggleExpand(product.id));

      row.innerHTML = `
        <div class="product-tile tile ${status.tone}">${active.length}</div>
        <div class="product-info">
          <div class="product-name">${escapeHtml(product.nombre)}</div>
          <div class="product-count">${active.length} ${active.length === 1 ? 'porción' : 'porciones'}</div>
        </div>
        <span class="badge ${status.tone}">${escapeHtml(status.label)}</span>
        <div class="chevron">${expanded ? '▾' : '▸'}</div>
      `;
      card.appendChild(row);

      if (expanded) {
        const detail = document.createElement('div');
        detail.className = 'product-detail';
        active.forEach(d => {
          const st = statusFor(new Date(d.fechaVencimiento));
          const drow = document.createElement('div');
          drow.className = 'portion-detail-row';
          drow.innerHTML = `
            <div class="entrada-label">Entró el ${fmtShort(new Date(d.fechaEntrada))}</div>
            <span class="badge ${st.tone}">${escapeHtml(st.label)}</span>
          `;
          detail.appendChild(drow);
        });
        card.appendChild(detail);
      }

      el.inventoryList.appendChild(card);
    });
  } else {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="icon">🥬</div>
      <div class="message">Tu nevera está vacía. Agrega tu primer producto para empezar.</div>
    `;
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Agregar producto';
    btn.addEventListener('click', () => goScreen('entrada'));
    empty.appendChild(btn);
    el.inventoryList.appendChild(empty);
  }
}

function renderEntrada() {
  el.inputEntradaNombre.value = state.entradaNombre;
  el.inputEntradaPorciones.value = state.entradaPorciones;
  el.inputEntradaFecha.value = state.entradaFecha;
  setFieldError(el.fieldEntradaNombre, state.entradaErrors.nombre);
  setFieldError(el.fieldEntradaPorciones, state.entradaErrors.porciones);
  setFieldError(el.fieldEntradaFecha, state.entradaErrors.fecha);
  el.btnSubmitEntrada.disabled = state.entradaSubmitting;
  el.btnSubmitEntrada.textContent = state.entradaSubmitting ? 'Guardando…' : 'Guardar entrada';
}

function renderSalida() {
  const productOptions = state.products
    .filter(p => activePortionsByProduct(p.id).length > 0)
    .map(p => ({ value: String(p.id), label: p.nombre }));

  const currentValue = state.salidaProductId;
  el.selectSalidaProducto.innerHTML = '<option value="">Elige un producto</option>' +
    productOptions.map(o => `<option value="${o.value}">${escapeHtml(o.label)}</option>`).join('');
  el.selectSalidaProducto.value = currentValue;

  el.noStockMessage.hidden = productOptions.length !== 0;

  el.salidaPortionsList.innerHTML = '';
  const showPortions = !!state.salidaProductId;
  el.salidaPortionsSection.hidden = !showPortions;

  if (showPortions) {
    const active = activePortionsByProduct(Number(state.salidaProductId)).slice().sort((a, b) => a.fechaEntrada - b.fechaEntrada);
    active.forEach(d => {
      const st = statusFor(new Date(d.fechaVencimiento));
      const selected = state.salidaSelected.includes(d.id);

      const card = document.createElement('div');
      card.className = 'card';
      const row = document.createElement('div');
      row.className = 'portion-select-row';

      const label = document.createElement('label');
      label.className = 'checkbox-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selected;
      checkbox.addEventListener('change', () => togglePortionSelected(d.id));
      const labelText = document.createElement('span');
      labelText.className = 'label';
      labelText.textContent = `Entró el ${fmtShort(new Date(d.fechaEntrada))}`;
      label.appendChild(checkbox);
      label.appendChild(labelText);

      const badge = document.createElement('span');
      badge.className = `badge ${st.tone}`;
      badge.textContent = st.label;

      row.appendChild(label);
      row.appendChild(badge);
      card.appendChild(row);
      el.salidaPortionsList.appendChild(card);
    });
  }

  el.btnSubmitSalida.disabled = state.salidaSubmitting || state.salidaSelected.length === 0;
  el.btnSubmitSalida.textContent = state.salidaSubmitting ? 'Guardando…' : 'Registrar salida';
}

function render() {
  el.screenPin.hidden = state.screen !== 'pin';
  el.screenInventory.hidden = state.screen !== 'inventory';
  el.screenEntrada.hidden = state.screen !== 'entrada';
  el.screenSalida.hidden = state.screen !== 'salida';

  if (state.screen === 'inventory') renderInventory();
  if (state.screen === 'entrada') renderEntrada();
  if (state.screen === 'salida') renderSalida();

  if (state.toastVisible) {
    el.toast.textContent = state.toastMessage;
    el.toast.classList.add('visible');
  } else {
    el.toast.classList.remove('visible');
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function init() {
  const pinOk = localStorage.getItem(PIN_OK_KEY) === '1';
  state.screen = pinOk ? 'inventory' : 'pin';
  render();
  if (pinOk) loadData();
}

init();
