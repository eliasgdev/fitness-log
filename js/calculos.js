// Cálculos puros (sin DOM ni almacenamiento): se prueban con node:test.

export const LIMITES = {
  nombre: 60, notas: 200, series: 20, reps: 100, kg: 500, minutos: 600, km: 300,
  pesoCorporal: { min: 25, max: 300 },
};

// Minutos que se cuentan por cada serie de fuerza, contando el descanso.
export const MINUTOS_POR_SERIE = 2.5;

// MET de referencia (Compendium of Physical Activities, 2024).
export const MET_TIPO = { fuerza: 5.0, 'peso-corporal': 3.8, cardio: 7.0 };

// ---------- Fechas (siempre en hora local, formato YYYY-MM-DD) ----------

export function aTexto(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

export function aFecha(texto) {
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
}

export function sumarDias(texto, n) {
  const d = aFecha(texto);
  d.setDate(d.getDate() + n);
  return aTexto(d);
}

// Lunes de la semana de la fecha dada.
export function inicioSemana(texto) {
  const dia = (aFecha(texto).getDay() + 6) % 7;
  return sumarDias(texto, -dia);
}

export function esFechaValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  return aTexto(aFecha(texto)) === texto;
}

// ---------- Fuerza ----------

// 1RM estimado con la fórmula de Epley. Con más de 12 repeticiones la estimación deja de ser fiable.
export function unaRM(kg, reps) {
  if (!(kg > 0) || !(reps >= 1) || reps > 12) return null;
  if (reps === 1) return kg;
  return Math.round(kg * (1 + reps / 30) * 2) / 2;
}

export function mejorUnaRM(entrada) {
  let mejor = null;
  for (const s of entrada.series ?? []) {
    const v = unaRM(s.kg, s.reps);
    if (v != null && (mejor == null || v > mejor)) mejor = v;
  }
  return mejor;
}

export function volumen(entrada) {
  return (entrada.series ?? []).reduce((t, s) => t + (s.reps || 0) * (s.kg || 0), 0);
}

export function repsTotales(entrada) {
  return (entrada.series ?? []).reduce((t, s) => t + (s.reps || 0), 0);
}

// ---------- Tiempo y calorías ----------

export function minutos(entrada) {
  if (entrada.tipo === 'cardio') return entrada.minutos || 0;
  return (entrada.series?.length || 0) * MINUTOS_POR_SERIE;
}

// MET para correr o caminar según la velocidad (ecuaciones del ACSM); si no hay distancia, el del catálogo.
export function metDe(entrada, metCatalogo) {
  const base = metCatalogo ?? MET_TIPO[entrada.tipo] ?? MET_TIPO.fuerza;
  if (entrada.tipo !== 'cardio' || !(entrada.km > 0) || !(entrada.minutos > 0)) return base;
  const metrosMin = (entrada.km * 1000) / entrada.minutos;
  if (entrada.modo === 'correr' && metrosMin >= 134) return (0.2 * metrosMin + 3.5) / 3.5;
  if (entrada.modo === 'caminar' || entrada.modo === 'correr') return (0.1 * metrosMin + 3.5) / 3.5;
  return base;
}

// kcal = MET × peso (kg) × horas. Es una estimación: no cuenta intensidad real ni descansos largos.
export function calorias(entrada, pesoKg, metCatalogo) {
  if (!(pesoKg > 0)) return 0;
  return Math.round(metDe(entrada, metCatalogo) * pesoKg * (minutos(entrada) / 60));
}

// ---------- Récords y progreso ----------

const clave = nombre => nombre.trim().toLocaleLowerCase('es');

export function records(entradas) {
  const r = new Map();
  for (const e of [...entradas].sort(porFecha)) {
    const k = clave(e.ejercicio);
    const actual = r.get(k) ?? { ejercicio: e.ejercicio, unaRM: null, kg: null, minutos: null, km: null };
    const rm = mejorUnaRM(e);
    if (rm != null && (actual.unaRM == null || rm > actual.unaRM.valor)) actual.unaRM = { valor: rm, fecha: e.fecha };
    const kg = Math.max(0, ...(e.series ?? []).map(s => s.kg || 0));
    if (kg > 0 && (actual.kg == null || kg > actual.kg.valor)) actual.kg = { valor: kg, fecha: e.fecha };
    if (e.tipo === 'cardio') {
      if (e.minutos && (actual.minutos == null || e.minutos > actual.minutos.valor)) actual.minutos = { valor: e.minutos, fecha: e.fecha };
      if (e.km && (actual.km == null || e.km > actual.km.valor)) actual.km = { valor: e.km, fecha: e.fecha };
    }
    if (e.tipo === 'peso-corporal') {
      const reps = Math.max(0, ...(e.series ?? []).map(s => s.reps || 0));
      if (reps > 0 && (actual.reps == null || reps > actual.reps.valor)) actual.reps = { valor: reps, fecha: e.fecha };
    }
    r.set(k, actual);
  }
  return r;
}

// Qué récords rompe `nueva` frente al historial anterior. Devuelve textos cortos.
export function recordsNuevos(anteriores, nueva) {
  const previas = anteriores.filter(e => clave(e.ejercicio) === clave(nueva.ejercicio) && e.id !== nueva.id);
  if (previas.length === 0) return [];
  const antes = records(previas).get(clave(nueva.ejercicio));
  const ahora = records([...previas, nueva]).get(clave(nueva.ejercicio));
  const logros = [];
  if (ahora.unaRM && (!antes.unaRM || ahora.unaRM.valor > antes.unaRM.valor)) logros.push(`1RM estimado de ${ahora.unaRM.valor} kg`);
  else if (ahora.kg && (!antes.kg || ahora.kg.valor > antes.kg.valor)) logros.push(`más peso: ${ahora.kg.valor} kg`);
  if (ahora.reps && (!antes.reps || ahora.reps.valor > antes.reps.valor)) logros.push(`${ahora.reps.valor} repeticiones seguidas`);
  if (ahora.km && (!antes.km || ahora.km.valor > antes.km.valor)) logros.push(`${ahora.km.valor} km`);
  else if (ahora.minutos && (!antes.minutos || ahora.minutos.valor > antes.minutos.valor)) logros.push(`${ahora.minutos.valor} minutos`);
  return logros;
}

// Serie de puntos { fecha, valor } por día: 1RM estimado (fuerza), repeticiones máximas (peso corporal) o km/min (cardio).
export function progreso(entradas, ejercicio) {
  const porDia = new Map();
  const propias = entradas.filter(e => clave(e.ejercicio) === clave(ejercicio));
  // En cardio se grafica la distancia si alguna vez se anotó; si no, la duración. Nunca se mezclan.
  const usarKm = propias.some(e => e.tipo === 'cardio' && e.km > 0);
  for (const e of propias) {
    let v;
    if (e.tipo === 'fuerza') v = mejorUnaRM(e);
    else if (e.tipo === 'peso-corporal') v = Math.max(0, ...(e.series ?? []).map(s => s.reps || 0)) || null;
    else v = (usarKm ? e.km : e.minutos) || null;
    if (v == null) continue;
    porDia.set(e.fecha, Math.max(v, porDia.get(e.fecha) ?? 0));
  }
  return [...porDia].map(([fecha, valor]) => ({ fecha, valor })).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ---------- Resúmenes ----------

function porFecha(a, b) {
  return a.fecha.localeCompare(b.fecha) || (a.creada ?? 0) - (b.creada ?? 0);
}

export function resumen(entradas, { desde, hasta, pesoKg, metDeEntrada = () => undefined }) {
  const dentro = entradas.filter(e => e.fecha >= desde && e.fecha <= hasta);
  return {
    dias: new Set(dentro.map(e => e.fecha)).size,
    ejercicios: dentro.length,
    volumen: Math.round(dentro.reduce((t, e) => t + volumen(e), 0)),
    minutos: Math.round(dentro.reduce((t, e) => t + minutos(e), 0)),
    calorias: dentro.reduce((t, e) => t + calorias(e, pesoKg, metDeEntrada(e)), 0),
  };
}

// Días entrenados por semana en las últimas `n` semanas (la última es la actual).
export function semanas(entradas, hoy, n = 12) {
  const actual = inicioSemana(hoy);
  const lista = [];
  for (let i = n - 1; i >= 0; i--) {
    const desde = sumarDias(actual, -7 * i);
    const hasta = sumarDias(desde, 6);
    lista.push({ desde, dias: new Set(entradas.filter(e => e.fecha >= desde && e.fecha <= hasta).map(e => e.fecha)).size });
  }
  return lista;
}

// Semanas seguidas con al menos un entrenamiento. La semana actual sin entrenar todavía no rompe la racha.
export function racha(entradas, hoy) {
  const lista = semanas(entradas, hoy, 520);
  let i = lista.length - 1;
  if (lista[i].dias === 0) i--;
  let n = 0;
  while (i >= 0 && lista[i].dias > 0) { n++; i--; }
  return n;
}

// ---------- Validación ----------

const entero = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const numero = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

// Recibe lo que llega del formulario o de un respaldo importado. Devuelve { ok, errores, entrada }.
export function validarEntrada(d) {
  const errores = {};
  const nombre = typeof d?.ejercicio === 'string' ? d.ejercicio.trim().replace(/\s+/g, ' ') : '';
  if (!nombre) errores.ejercicio = 'Escribe el ejercicio.';
  else if (nombre.length > LIMITES.nombre) errores.ejercicio = `Máximo ${LIMITES.nombre} caracteres.`;
  if (!esFechaValida(d?.fecha)) errores.fecha = 'Fecha inválida.';
  if (!['fuerza', 'peso-corporal', 'cardio'].includes(d?.tipo)) errores.tipo = 'Tipo inválido.';
  const notas = typeof d?.notas === 'string' ? d.notas.trim() : '';
  if (notas.length > LIMITES.notas) errores.notas = `Máximo ${LIMITES.notas} caracteres.`;

  const entrada = { id: typeof d?.id === 'string' && d.id ? d.id.slice(0, 40) : null, fecha: d?.fecha, ejercicio: nombre, tipo: d?.tipo, notas, creada: Number.isFinite(d?.creada) ? d.creada : null };

  if (d?.tipo === 'cardio') {
    if (!entero(d.minutos, 1, LIMITES.minutos)) errores.minutos = `Entre 1 y ${LIMITES.minutos} minutos.`;
    if (d.km != null && !numero(d.km, 0, LIMITES.km)) errores.km = `Entre 0 y ${LIMITES.km} km.`;
    entrada.minutos = d.minutos;
    entrada.km = d.km ? Math.round(d.km * 100) / 100 : null;
    entrada.modo = typeof d.modo === 'string' ? d.modo.slice(0, 20) : null;
  } else if (d?.tipo) {
    const series = Array.isArray(d.series) ? d.series : [];
    if (series.length === 0) errores.series = 'Agrega al menos una serie.';
    else if (series.length > LIMITES.series) errores.series = `Máximo ${LIMITES.series} series.`;
    else if (!series.every(s => entero(s?.reps, 1, LIMITES.reps))) errores.series = `Cada serie necesita entre 1 y ${LIMITES.reps} repeticiones.`;
    else if (d.tipo === 'fuerza' && !series.every(s => numero(s?.kg, 0, LIMITES.kg))) errores.series = `El peso va de 0 a ${LIMITES.kg} kg.`;
    else if (d.tipo === 'peso-corporal' && !series.every(s => s?.kg == null || numero(s.kg, 0, LIMITES.kg))) errores.series = `El lastre va de 0 a ${LIMITES.kg} kg.`;
    entrada.series = series.slice(0, LIMITES.series).map(s => ({ reps: s?.reps, kg: d.tipo === 'fuerza' ? s?.kg : (s?.kg || 0) }));
  }

  const ok = Object.keys(errores).length === 0;
  return { ok, errores, entrada: ok ? entrada : null };
}

// ---------- Migración del formato anterior (clave "fitnesslog") ----------

// v1 guardaba { "YYYY-MM-DD": [{ id, tipo: pesas|cardio|calistenia, nombre, series, reps, peso, duracion, notas }] } con todo como texto.
export function migrarV1(viejo) {
  const entradas = [];
  if (!viejo || typeof viejo !== 'object') return entradas;
  for (const [fecha, lista] of Object.entries(viejo)) {
    if (!Array.isArray(lista)) continue;
    for (const v of lista) {
      const n = x => (x === '' || x == null ? NaN : Number(x));
      const tipo = v?.tipo === 'cardio' ? 'cardio' : v?.tipo === 'calistenia' ? 'peso-corporal' : 'fuerza';
      const base = { id: `v1-${v?.id ?? Math.random().toString(36).slice(2)}`, fecha, ejercicio: v?.nombre, tipo, notas: v?.notas ?? '', creada: Number(v?.id) || null };
      let datos;
      if (tipo === 'cardio') {
        datos = { ...base, minutos: Math.round(n(v.duracion ?? v.minutos)), km: Number.isFinite(n(v.distancia)) ? n(v.distancia) : null };
      } else {
        const cuantas = Math.min(Math.max(Math.round(n(v.series)) || 1, 1), LIMITES.series);
        const reps = Math.round(n(v.reps));
        const kg = Number.isFinite(n(v.peso)) ? n(v.peso) : 0;
        datos = { ...base, series: Array.from({ length: cuantas }, () => ({ reps, kg })) };
      }
      const r = validarEntrada(datos);
      if (r.ok) entradas.push(r.entrada);
    }
  }
  return entradas;
}
