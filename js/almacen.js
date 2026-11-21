// Todo se guarda en el navegador (localStorage). Nada sale del dispositivo.
import { migrarV1, validarEntrada, LIMITES } from './calculos.js';

const CLAVE = 'fl:datos';
const CLAVE_V1 = 'fitnesslog';
export const VERSION_DATOS = 2;

function vacio() {
  return { version: VERSION_DATOS, perfil: { pesoKg: null }, entradas: [] };
}

function leerJson(clave) {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Revisa cada entrada como si viniera de afuera: un respaldo editado a mano no puede romper la app.
export function sanear(datos) {
  const limpio = vacio();
  const peso = Number(datos?.perfil?.pesoKg);
  if (peso >= LIMITES.pesoCorporal.min && peso <= LIMITES.pesoCorporal.max) limpio.perfil.pesoKg = peso;
  const vistos = new Set();
  let descartadas = 0;
  for (const e of Array.isArray(datos?.entradas) ? datos.entradas : []) {
    const r = validarEntrada(e);
    if (!r.ok) { descartadas++; continue; }
    if (!r.entrada.id || vistos.has(r.entrada.id)) r.entrada.id = nuevoId();
    vistos.add(r.entrada.id);
    limpio.entradas.push(r.entrada);
  }
  return { datos: limpio, descartadas };
}

export function cargar() {
  const actual = leerJson(CLAVE);
  if (actual) return sanear(actual).datos;
  const viejo = leerJson(CLAVE_V1);
  const datos = vacio();
  if (viejo) {
    datos.entradas = migrarV1(viejo);
    guardar(datos);
  }
  return datos;
}

export function guardar(datos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
    return true;
  } catch {
    return false;
  }
}

export function nuevoId() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function exportar(datos) {
  return new Blob([JSON.stringify({ ...datos, exportado: new Date().toISOString() }, null, 2)], { type: 'application/json' });
}

export async function importar(archivo) {
  if (archivo.size > 5 * 1024 * 1024) throw new Error('El archivo pesa más de 5 MB.');
  let json;
  try {
    json = JSON.parse(await archivo.text());
  } catch {
    throw new Error('El archivo no es un respaldo válido.');
  }
  // Acepta respaldos de esta versión y el formato anterior por fechas.
  if (Array.isArray(json?.entradas)) return sanear(json);
  const entradas = migrarV1(json);
  if (entradas.length === 0) throw new Error('El archivo no tiene entrenamientos que se puedan leer.');
  return { datos: { ...vacio(), entradas }, descartadas: 0 };
}
