const MS_DAY = 86400000;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const STORAGE_KEY = 'qhay-tracker-nevera-v1';

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

function statusFor(fechaVenc) {
  const today = toDateOnly(new Date());
  const diffDays = Math.round((fechaVenc - today) / MS_DAY);
  if (diffDays < 0) return { tone: 'expired', label: `Venció hace ${-diffDays} día${-diffDays === 1 ? '' : 's'}` };
  if (diffDays === 0) return { tone: 'soon', label: 'Vence hoy' };
  if (diffDays <= 5) return { tone: 'soon', label: `Vence en ${diffDays} día${diffDays === 1 ? '' : 's'}` };
  return { tone: 'fresh', label: 'Fresco' };
}

function buildSeed() {
  const today = toDateOnly(new Date());
  const mkDate = (offsetDays) => new Date(today.getTime() - offsetDays * MS_DAY);

  const seedDefs = [
    { nombre: 'Sopa de lentejas', porciones: [{ offset: 95 }, { offset: 95 }, { offset: 93 }, { offset: 93 }] },
    { nombre: 'Pollo troceado', porciones: [{ offset: 87 }, { offset: 87 }, { offset: 80 }] },
    { nombre: 'Puré de papa', porciones: [{ offset: 60 }, { offset: 60 }] },
    { nombre: 'Caldo de verduras', porciones: [{ offset: 89 }, { offset: 89 }, { offset: 89 }, { offset: 84 }, { offset: 84 }, { offset: 84 }] },
    { nombre: 'Lomo de cerdo', porciones: [{ offset: 10 }] },
  ];

  const products = [];
  const portions = [];
  let productId = 1;
  let portionId = 1;

  seedDefs.forEach(def => {
    const pid = productId++;
    products.push({ id: pid, nombre: def.nombre });
    def.porciones.forEach(p => {
      const entrada = mkDate(p.offset);
      portions.push({
        id: portionId++,
        productId: pid,
        fechaEntrada: entrada.getTime(),
        fechaVencimiento: addMonths(entrada, 3).getTime(),
        estado: 'activa',
      });
    });
  });

  return { products, portions, nextProductId: productId, nextPortionId: portionId };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveState() {
  const { products, portions, nextProductId, nextPortionId } = state;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, portions, nextProductId, nextPortionId }));
}

const persisted = loadState();

const state = {
  screen: 'inventory',
  expandedId: null,
  entradaNombre: '',
  entradaPorciones: '',
  entradaFecha: todayStr(),
  entradaErrors: {},
  salidaProductId: '',
  salidaSelected: [],
  toastVisible: false,
  toastMessage: '',
  ...(persisted || buildSeed()),
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

function submitEntrada() {
  const { entradaNombre, entradaPorciones, entradaFecha } = state;
  const errors = {};
  if (!entradaNombre.trim()) errors.nombre = 'Escribe el nombre del producto.';
  const n = Number(entradaPorciones);
  if (!entradaPorciones || !Number.isInteger(n) || n < 1) errors.porciones = 'Debe ser un número entero de 1 o más.';
  if (!entradaFecha) {
    errors.fecha = 'Elige una fecha de entrada.';
  } else {
    const fecha = new Date(entradaFecha + 'T00:00:00');
    if (fecha > toDateOnly(new Date())) errors.fecha = 'No puede ser una fecha futura.';
  }
  if (Object.keys(errors).length) {
    state.entradaErrors = errors;
    render();
    return;
  }

  const norm = normalize(entradaNombre);
  let existing = state.products.find(p => normalize(p.nombre) === norm);
  if (!existing) {
    existing = { id: state.nextProductId, nombre: entradaNombre.trim() };
    state.products = [...state.products, existing];
    state.nextProductId += 1;
  }

  const fecha = new Date(entradaFecha + 'T00:00:00');
  const vencimiento = addMonths(fecha, 3);
  const newPortions = [];
  for (let i = 0; i < n; i++) {
    newPortions.push({
      id: state.nextPortionId++,
      productId: existing.id,
      fechaEntrada: fecha.getTime(),
      fechaVencimiento: vencimiento.getTime(),
      estado: 'activa',
    });
  }

  state.portions = [...state.portions, ...newPortions];
  state.entradaNombre = '';
  state.entradaPorciones = '';
  state.entradaFecha = todayStr();
  state.entradaErrors = {};
  state.screen = 'inventory';
  saveState();
  render();
  showToast(`Agregaste ${n} ${n === 1 ? 'porción' : 'porciones'} de ${existing.nombre} a tu nevera.`);
}

function togglePortionSelected(id) {
  const has = state.salidaSelected.includes(id);
  state.salidaSelected = has ? state.salidaSelected.filter(x => x !== id) : [...state.salidaSelected, id];
  render();
}

function submitSalida() {
  const { salidaSelected } = state;
  if (!salidaSelected.length) return;
  state.portions = state.portions.map(p => salidaSelected.includes(p.id) ? { ...p, estado: 'consumida' } : p);
  const count = salidaSelected.length;
  state.salidaProductId = '';
  state.salidaSelected = [];
  state.screen = 'inventory';
  saveState();
  render();
  showToast(`Salida registrada: ${count} ${count === 1 ? 'porción' : 'porciones'}.`);
}

// ---- DOM refs ----
const el = {
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

  el.btnSubmitSalida.disabled = state.salidaSelected.length === 0;
}

function render() {
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

render();
