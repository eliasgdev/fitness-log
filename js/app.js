import {
  aTexto, aFecha, sumarDias, inicioSemana, mejorUnaRM, volumen, minutos, calorias,
  recordsNuevos, records, progreso, resumen, semanas, racha, validarEntrada, LIMITES,
} from './calculos.js';
import { CATALOGO, buscarEnCatalogo } from './catalogo.js';
import { cargar, guardar, nuevoId, exportar, importar, sanear } from './almacen.js';
import { icono } from './iconos.js';

const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
const hoy = () => aTexto(new Date());

let datos = cargar();
let diaVisto = hoy();
let diasHistorial = 10;
let deshacer = null;

// ---------- Utilidades de interfaz ----------

function el(etiqueta, props = {}, ...hijos) {
  const n = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'texto') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat()) if (h != null && h !== false) n.append(h);
  return n;
}

function fechaLarga(texto, { anio = false } = {}) {
  const t = aFecha(texto).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', ...(anio && { year: 'numeric' }) });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function nombreDia(texto) {
  const h = hoy();
  if (texto === h) return 'Hoy';
  if (texto === sumarDias(h, -1)) return 'Ayer';
  return fechaLarga(texto, { anio: texto.slice(0, 4) !== h.slice(0, 4) });
}

const metCatalogo = e => buscarEnCatalogo(e.ejercicio)?.met;
const kcal = e => calorias(e, datos.perfil.pesoKg, metCatalogo(e));

function detalle(e) {
  if (e.tipo === 'cardio') {
    const partes = [`${e.minutos} min`];
    if (e.km) partes.push(`${nf.format(e.km)} km`);
    if (e.km && e.minutos) {
      const ritmo = e.minutos / e.km;
      partes.push(`${Math.floor(ritmo)}:${String(Math.round((ritmo % 1) * 60)).padStart(2, '0')} min/km`);
    }
    return partes.join(' · ');
  }
  const s = e.series;
  const iguales = s.every(x => x.reps === s[0].reps && x.kg === s[0].kg);
  const conKg = x => (x.kg ? ` × ${nf.format(x.kg)} kg` : '');
  let texto = iguales
    ? `${s.length} × ${s[0].reps}${s[0].kg ? ` con ${nf.format(s[0].kg)} kg` : ''}`
    : s.map(x => `${x.reps}${conKg(x)}`).join(', ') + (s.some(x => x.kg) ? '' : ' reps');
  if (e.tipo === 'fuerza') {
    const rm = mejorUnaRM(e);
    if (rm) texto += ` · 1RM ≈ ${nf.format(rm)} kg`;
  }
  return texto;
}

function guardarYPintar() {
  if (!guardar(datos)) mostrarAviso('No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado.');
  pintar();
}

function mostrarAviso(texto, alDeshacer = null) {
  clearTimeout(mostrarAviso.t);
  $('avisoTexto').textContent = texto;
  $('avisoDeshacer').hidden = !alDeshacer;
  deshacer = alDeshacer;
  $('aviso').hidden = false;
  mostrarAviso.t = setTimeout(() => { $('aviso').hidden = true; deshacer = null; }, 6000);
}

// ---------- Formulario de registro ----------

const tipoElegido = () => document.querySelector('input[name="tipo"]:checked').value;

function elegirTipo(tipo) {
  document.querySelector(`input[name="tipo"][value="${tipo}"]`).checked = true;
  const cardio = tipo === 'cardio';
  $('bloqueSeries').hidden = cardio;
  $('bloqueCardio').hidden = !cardio;
  for (const fila of $('series').children) fila.querySelector('.kg-texto').textContent = tipo === 'fuerza' ? 'kg' : 'kg de lastre';
}

function filaSerie({ reps = '', kg = '' } = {}) {
  const n = $('series').children.length + 1;
  const tipo = tipoElegido();
  const fila = el('li', { class: 'serie' },
    el('span', { class: 'serie-num', texto: String(n) }),
    el('input', { type: 'number', inputmode: 'numeric', min: 1, max: LIMITES.reps, step: 1, class: 'reps', 'aria-label': `Repeticiones de la serie ${n}`, value: reps, placeholder: '10' }),
    el('span', { texto: 'reps ×' }),
    el('input', { type: 'number', inputmode: 'decimal', min: 0, max: LIMITES.kg, step: 0.5, class: 'kg', 'aria-label': `Peso de la serie ${n}`, value: kg, placeholder: tipo === 'fuerza' ? '20' : '0' }),
    el('span', { class: 'kg-texto', texto: tipo === 'fuerza' ? 'kg' : 'kg de lastre' }),
    el('button', {
      type: 'button', class: 'quitar', 'aria-label': `Quitar la serie ${n}`,
      onclick: () => { fila.remove(); renumerar(); },
    }, icono('cerrar', { tam: 16 })),
  );
  return fila;
}

function renumerar() {
  [...$('series').children].forEach((f, i) => {
    f.querySelector('.serie-num').textContent = String(i + 1);
    f.querySelector('.reps').setAttribute('aria-label', `Repeticiones de la serie ${i + 1}`);
    f.querySelector('.kg').setAttribute('aria-label', `Peso de la serie ${i + 1}`);
    f.querySelector('.quitar').setAttribute('aria-label', `Quitar la serie ${i + 1}`);
  });
  $('agregarSerie').hidden = $('series').children.length >= LIMITES.series;
}

function agregarSerie() {
  const ultima = $('series').lastElementChild;
  const copia = ultima ? { reps: ultima.querySelector('.reps').value, kg: ultima.querySelector('.kg').value } : {};
  const fila = filaSerie(copia);
  $('series').append(fila);
  renumerar();
  return fila;
}

function reiniciarSeries(series = [{}]) {
  $('series').replaceChildren();
  for (const s of series) $('series').append(filaSerie(s));
  renumerar();
}

const num = v => (v === '' ? null : Number(v));

function leerFormulario() {
  const tipo = tipoElegido();
  const base = { fecha: $('fecha').value, ejercicio: $('ejercicio').value, tipo, notas: $('notas').value };
  if (tipo === 'cardio') {
    return { ...base, minutos: num($('minutos').value), km: num($('km').value), modo: buscarEnCatalogo(base.ejercicio)?.modo ?? null };
  }
  const series = [...$('series').children]
    .map(f => ({ reps: num(f.querySelector('.reps').value), kg: num(f.querySelector('.kg').value) ?? (tipo === 'fuerza' ? null : 0) }))
    .filter(s => s.reps != null || s.kg != null);
  return { ...base, series };
}

// Al escribir el ejercicio: elige el tipo del catálogo y muestra lo que hiciste la última vez.
function alCambiarEjercicio() {
  const nombre = $('ejercicio').value.trim();
  const delCatalogo = buscarEnCatalogo(nombre);
  const anterior = [...datos.entradas]
    .filter(e => e.ejercicio.toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es'))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creada ?? 0) - (a.creada ?? 0))[0];
  if (anterior) elegirTipo(anterior.tipo);
  else if (delCatalogo) elegirTipo(delCatalogo.tipo);
  $('ultimaVez').textContent = anterior ? `Última vez (${nombreDia(anterior.fecha).toLocaleLowerCase('es')}): ${detalle(anterior)}` : '';
  $('ultimaVez').dataset.id = anterior?.id ?? '';
}

function enviarRegistro(ev) {
  ev.preventDefault();
  const r = validarEntrada(leerFormulario());
  const msg = $('mensajeRegistro');
  msg.className = 'mensaje';
  if (!r.ok) {
    msg.classList.add('error');
    msg.textContent = Object.values(r.errores)[0];
    const campo = { ejercicio: 'ejercicio', fecha: 'fecha', minutos: 'minutos', km: 'km', notas: 'notas' }[Object.keys(r.errores)[0]];
    (campo ? $(campo) : $('series').querySelector('input'))?.focus();
    return;
  }
  const entrada = { ...r.entrada, id: nuevoId(), creada: Date.now() };
  const logros = recordsNuevos(datos.entradas, entrada);
  datos.entradas.push(entrada);
  diaVisto = entrada.fecha;
  guardarYPintar();

  msg.classList.add(logros.length ? 'logro' : 'ok');
  msg.textContent = logros.length ? `Nuevo récord en ${entrada.ejercicio}: ${logros.join(' y ')}.` : `${entrada.ejercicio} guardado.`;

  // Deja el ejercicio listo para la siguiente anotación; las series se conservan por si repites.
  $('ejercicio').value = '';
  $('notas').value = '';
  $('ultimaVez').textContent = '';
  $('ejercicio').focus();
}

// ---------- Listas ----------

function filaEntrada(e) {
  const k = kcal(e);
  return el('li', { class: 'entrada' },
    el('div', { class: 'entrada-texto' },
      el('strong', { texto: e.ejercicio }),
      el('span', { class: 'tenue', texto: detalle(e) }),
      e.notas ? el('span', { class: 'entrada-notas', texto: e.notas }) : null,
    ),
    el('span', { class: 'entrada-kcal tenue', texto: k ? `${k} kcal` : '' }),
    el('button', {
      type: 'button', class: 'quitar', 'aria-label': `Borrar ${e.ejercicio}`, title: 'Borrar',
      onclick: () => borrarEntrada(e.id),
    }, icono('basura', { tam: 18 })),
  );
}

function borrarEntrada(id) {
  const i = datos.entradas.findIndex(e => e.id === id);
  if (i < 0) return;
  const [quitada] = datos.entradas.splice(i, 1);
  guardarYPintar();
  mostrarAviso(`${quitada.ejercicio} borrado.`, () => { datos.entradas.splice(i, 0, quitada); guardarYPintar(); });
}

function pintarDia() {
  const del = datos.entradas.filter(e => e.fecha === diaVisto).sort((a, b) => (a.creada ?? 0) - (b.creada ?? 0));
  $('tituloDia').textContent = nombreDia(diaVisto);
  $('listaDia').replaceChildren(...del.map(filaEntrada));
  $('vacioDia').hidden = del.length > 0;
}

function pintarHistorial() {
  const fechas = [...new Set(datos.entradas.map(e => e.fecha))].filter(f => f !== diaVisto).sort().reverse();
  $('seccionHistorial').hidden = fechas.length === 0;
  const bloques = fechas.slice(0, diasHistorial).map(f => {
    const del = datos.entradas.filter(e => e.fecha === f);
    const vol = del.reduce((t, e) => t + volumen(e), 0);
    const min = Math.round(del.reduce((t, e) => t + minutos(e), 0));
    const resumenDia = [`${del.length} ${del.length === 1 ? 'ejercicio' : 'ejercicios'}`, vol ? `${nf.format(vol)} kg` : null, `${min} min`].filter(Boolean).join(' · ');
    return el('section', { class: 'dia' },
      el('h3', {}, el('button', { type: 'button', class: 'enlace dia-titulo', texto: nombreDia(f), onclick: () => verDia(f) }),
        el('span', { class: 'tenue', texto: resumenDia })),
      el('ul', { class: 'lista' }, del.sort((a, b) => (a.creada ?? 0) - (b.creada ?? 0)).map(filaEntrada)),
    );
  });
  $('historial').replaceChildren(...bloques);
  $('verMas').hidden = fechas.length <= diasHistorial;
}

function verDia(fecha) {
  diaVisto = fecha;
  $('fecha').value = fecha;
  pintar();
  $('tituloDia').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Semana, semanas y progreso ----------

function dato(valor, unidad, etiqueta) {
  return el('div', { class: 'dato' },
    el('dt', { texto: etiqueta }),
    el('dd', {}, valor, unidad ? el('small', { texto: unidad }) : null),
  );
}

function pintarSemana() {
  const h = hoy();
  const desde = inicioSemana(h);
  const r = resumen(datos.entradas, { desde, hasta: sumarDias(desde, 6), pesoKg: datos.perfil.pesoKg, metDeEntrada: metCatalogo });
  $('fechaHoy').textContent = fechaLarga(h);
  $('titulo').textContent = r.dias === 0
    ? 'Esta semana aún no entrenas'
    : `${r.dias} ${r.dias === 1 ? 'día entrenado' : 'días entrenados'} esta semana`;
  const items = [dato(nf.format(r.ejercicios), '', 'ejercicios'), dato(nf.format(r.volumen), 'kg', 'volumen levantado'), dato(nf.format(r.minutos), 'min', 'de entrenamiento')];
  items.push(datos.perfil.pesoKg
    ? dato(nf.format(r.calorias), 'kcal', 'estimadas')
    : el('div', { class: 'dato' }, el('dt', { texto: 'calorías' }), el('dd', { class: 'dd-enlace' }, el('a', { class: 'enlace', href: '#ajustes', texto: 'Anota tu peso' }))));
  $('datosSemana').replaceChildren(...items);
}

// La altura va por CSSOM: la CSP no permite atributos style en línea.
function barra(dias) {
  const b = el('span', { class: 'semana-barra' });
  b.style.setProperty('--alto', `${(dias / 7) * 100}%`);
  return b;
}

function pintarSemanas() {
  const h = hoy();
  const lista = semanas(datos.entradas, h, 12);
  let mesAnterior = '';
  $('semanas').replaceChildren(...lista.map((s, i) => {
    const mes = aFecha(s.desde).toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
    const etiqueta = mes !== mesAnterior ? mes : '';
    mesAnterior = mes;
    return el('li', { class: `semana${i === lista.length - 1 ? ' actual' : ''}`, title: `Semana del ${fechaLarga(s.desde)}: ${s.dias} ${s.dias === 1 ? 'día' : 'días'}` },
      el('span', { class: 'semana-dias', texto: s.dias ? String(s.dias) : '' }),
      barra(s.dias),
      el('span', { class: 'semana-mes', texto: etiqueta }),
    );
  }));
  const n = racha(datos.entradas, h);
  $('racha').textContent = n >= 2 ? `${n} semanas seguidas entrenando` : '';
}

function pintarProgreso() {
  const conteo = new Map();
  for (const e of datos.entradas) {
    const k = e.ejercicio.toLocaleLowerCase('es');
    const c = conteo.get(k) ?? { nombre: e.ejercicio, dias: new Set() };
    c.dias.add(e.fecha);
    conteo.set(k, c);
  }
  const opciones = [...conteo.values()].filter(c => c.dias.size >= 2).sort((a, b) => b.dias.size - a.dias.size || a.nombre.localeCompare(b.nombre, 'es'));
  $('seccionProgreso').hidden = opciones.length === 0;
  if (opciones.length === 0) return;

  const sel = $('progresoEjercicio');
  const previo = sel.value;
  sel.replaceChildren(...opciones.map(o => el('option', { value: o.nombre, texto: o.nombre })));
  sel.value = opciones.some(o => o.nombre === previo) ? previo : opciones[0].nombre;

  const nombre = sel.value;
  const puntos = progreso(datos.entradas, nombre);
  const delEjercicio = datos.entradas.filter(e => e.ejercicio.toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es'));
  const muestra = delEjercicio[0];
  const rec = records(datos.entradas).get(nombre.trim().toLocaleLowerCase('es'));
  const unidad = muestra.tipo === 'fuerza' ? 'kg' : muestra.tipo === 'peso-corporal' ? 'reps' : (delEjercicio.some(e => e.km) ? 'km' : 'min');
  const que = muestra.tipo === 'fuerza' ? '1RM estimado' : muestra.tipo === 'peso-corporal' ? 'repeticiones seguidas' : unidad === 'km' ? 'distancia' : 'duración';

  const mejor = muestra.tipo === 'fuerza' ? rec?.unaRM : muestra.tipo === 'peso-corporal' ? rec?.reps : (rec?.km ?? rec?.minutos);
  const primero = puntos[0]?.valor;
  const ultimo = puntos.at(-1)?.valor;
  const cambio = primero ? Math.round(((ultimo - primero) / primero) * 100) : 0;
  $('progresoCifra').replaceChildren(
    el('span', { class: 'cifra' }, mejor ? nf.format(mejor.valor) : '—', el('small', { texto: unidad })),
    el('span', { class: 'tenue', texto: mejor ? `mejor ${que} · ${nombreDia(mejor.fecha).toLocaleLowerCase('es')}` : '' }),
    puntos.length >= 2 && cambio !== 0
      ? el('span', { class: cambio > 0 ? 'sube' : 'baja', texto: `${cambio > 0 ? '+' : ''}${cambio} % desde ${nombreDia(puntos[0].fecha).toLocaleLowerCase('es')}` })
      : null,
  );
  $('grafica').replaceChildren(grafica(puntos, unidad));
}

// Línea simple en SVG: sin librerías y sin innerHTML.
function grafica(puntos, unidad) {
  const ns = 'http://www.w3.org/2000/svg';
  const W = Math.max(300, Math.round($('grafica').clientWidth) || 640), H = 200, M = { i: 36, d: 12, a: 12, b: 26 };
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Progreso: ${puntos.map(p => `${p.fecha} ${p.valor} ${unidad}`).join(', ')}`);
  const nodo = (tag, attrs) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    svg.append(n);
    return n;
  };
  const valores = puntos.map(p => p.valor);
  let min = Math.min(...valores), max = Math.max(...valores);
  if (min === max) { min -= 1; max += 1; }
  const margen = (max - min) * 0.15;
  min = Math.max(0, min - margen); max += margen;
  const t0 = aFecha(puntos[0].fecha).getTime(), t1 = aFecha(puntos.at(-1).fecha).getTime();
  const x = p => M.i + (t1 === t0 ? 0.5 : (aFecha(p.fecha).getTime() - t0) / (t1 - t0)) * (W - M.i - M.d);
  const y = v => M.a + (1 - (v - min) / (max - min)) * (H - M.a - M.b);

  for (const v of [min, (min + max) / 2, max]) {
    nodo('line', { x1: M.i, x2: W - M.d, y1: y(v), y2: y(v), class: 'g-guia' });
    nodo('text', { x: M.i - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'g-texto' }).textContent = nf.format(Math.round(v));
  }
  nodo('polyline', { points: puntos.map(p => `${x(p)},${y(p.valor)}`).join(' '), class: 'g-linea' });
  puntos.forEach((p, i) => {
    const c = nodo('circle', { cx: x(p), cy: y(p.valor), r: i === puntos.length - 1 ? 5 : 3.5, class: 'g-punto' });
    const titulo = document.createElementNS(ns, 'title');
    titulo.textContent = `${nombreDia(p.fecha)}: ${nf.format(p.valor)} ${unidad}`;
    c.append(titulo);
  });
  const fechaCorta = f => aFecha(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
  nodo('text', { x: M.i, y: H - 6, class: 'g-texto' }).textContent = fechaCorta(puntos[0].fecha);
  if (puntos.length > 1) nodo('text', { x: W - M.d, y: H - 6, 'text-anchor': 'end', class: 'g-texto' }).textContent = fechaCorta(puntos.at(-1).fecha);
  return svg;
}

// ---------- Ajustes y respaldo ----------

function pintarAjustes() {
  if (document.activeElement !== $('pesoCorporal')) $('pesoCorporal').value = datos.perfil.pesoKg ?? '';
}

function guardarPeso() {
  const v = num($('pesoCorporal').value);
  const msg = $('mensajeAjustes');
  if (v != null && !(v >= LIMITES.pesoCorporal.min && v <= LIMITES.pesoCorporal.max)) {
    msg.className = 'mensaje error';
    msg.textContent = `El peso va de ${LIMITES.pesoCorporal.min} a ${LIMITES.pesoCorporal.max} kg.`;
    return;
  }
  datos.perfil.pesoKg = v;
  msg.className = 'mensaje';
  msg.textContent = '';
  guardarYPintar();
}

function descargarRespaldo() {
  const url = URL.createObjectURL(exportar(datos));
  const a = el('a', { href: url, download: `fitnesslog-${hoy()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function cargarRespaldo(ev) {
  const archivo = ev.target.files?.[0];
  ev.target.value = '';
  if (!archivo) return;
  const msg = $('mensajeAjustes');
  try {
    const { datos: nuevos, descartadas } = await importar(archivo);
    const n = nuevos.entradas.length;
    const reemplazar = datos.entradas.length === 0 || confirm(`El respaldo tiene ${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}. ¿Reemplazar los ${datos.entradas.length} que tienes ahora?\n\nAceptar: reemplazar · Cancelar: juntarlos`);
    const anterior = structuredClone(datos);
    if (reemplazar) datos = nuevos;
    else datos = sanear({ perfil: datos.perfil.pesoKg ? datos.perfil : nuevos.perfil, entradas: [...datos.entradas, ...nuevos.entradas.filter(e => !datos.entradas.some(x => x.id === e.id))] }).datos;
    guardarYPintar();
    msg.className = 'mensaje ok';
    msg.textContent = `Respaldo cargado: ${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}${descartadas ? ` (${descartadas} no se ${descartadas === 1 ? 'pudo' : 'pudieron'} leer)` : ''}.`;
    mostrarAviso('Respaldo cargado.', () => { datos = anterior; guardarYPintar(); msg.textContent = ''; });
  } catch (err) {
    msg.className = 'mensaje error';
    msg.textContent = err.message;
  }
}

function borrarTodo() {
  if (datos.entradas.length === 0) return;
  if (!confirm(`¿Borrar los ${datos.entradas.length} ejercicios guardados en este navegador?`)) return;
  const anterior = structuredClone(datos);
  datos.entradas = [];
  guardarYPintar();
  mostrarAviso('Se borró todo.', () => { datos = anterior; guardarYPintar(); });
}

// ---------- Inicio ----------

function pintar() {
  pintarSemana();
  pintarDia();
  pintarSemanas();
  pintarProgreso();
  pintarHistorial();
  pintarAjustes();
}

function iniciar() {
  $('catalogo').replaceChildren(...CATALOGO.map(e => el('option', { value: e.nombre })));
  $('fecha').value = hoy();
  $('fecha').max = sumarDias(hoy(), 1);
  reiniciarSeries();
  elegirTipo('fuerza');

  $('ejercicio').addEventListener('input', alCambiarEjercicio);
  $('ejercicio').addEventListener('change', () => {
    // Si la última vez tenía series, se ofrecen las mismas como punto de partida.
    const anterior = datos.entradas.find(e => e.id === $('ultimaVez').dataset.id);
    if (anterior?.series && anterior.tipo === tipoElegido()) reiniciarSeries(anterior.series);
    if (anterior?.tipo === 'cardio') { $('minutos').value = anterior.minutos; $('km').value = anterior.km ?? ''; }
  });
  for (const r of document.querySelectorAll('input[name="tipo"]')) r.addEventListener('change', () => elegirTipo(r.value));
  $('fecha').addEventListener('change', () => { if ($('fecha').value) { diaVisto = $('fecha').value; pintar(); } });
  $('agregarSerie').addEventListener('click', () => agregarSerie().querySelector('.reps').focus());
  $('formRegistro').addEventListener('submit', enviarRegistro);
  $('verMas').addEventListener('click', () => { diasHistorial += 10; pintarHistorial(); });
  $('progresoEjercicio').addEventListener('change', pintarProgreso);
  $('pesoCorporal').addEventListener('change', guardarPeso);
  $('formPeso').addEventListener('submit', ev => { ev.preventDefault(); guardarPeso(); });
  $('exportar').addEventListener('click', descargarRespaldo);
  $('importar').addEventListener('change', cargarRespaldo);
  $('borrarTodo').addEventListener('click', borrarTodo);
  $('avisoDeshacer').addEventListener('click', () => { const f = deshacer; $('aviso').hidden = true; deshacer = null; f?.(); });

  // Si la app queda abierta de un día para otro, se actualiza al volver.
  let dia = hoy();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && hoy() !== dia) {
      if (diaVisto === dia) diaVisto = hoy();
      dia = hoy();
      $('fecha').max = sumarDias(dia, 1);
      pintar();
    }
  });
  // Otra pestaña cambió los datos.
  addEventListener('storage', ev => { if (ev.key === 'fl:datos') { datos = cargar(); pintar(); } });

  let ancho = innerWidth;
  addEventListener('resize', () => { if (Math.abs(innerWidth - ancho) > 40) { ancho = innerWidth; pintarProgreso(); } });

  pintar();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

iniciar();
