// Ejercicios comunes con su tipo y MET (Compendium of Physical Activities, 2024).
// Sirven para autocompletar y para estimar calorías; el usuario puede escribir cualquier otro.
export const CATALOGO = [
  // Fuerza con peso
  ['Sentadilla', 'fuerza', 6.0], ['Peso muerto', 'fuerza', 6.0], ['Press de banca', 'fuerza', 5.0],
  ['Press militar', 'fuerza', 5.0], ['Remo con barra', 'fuerza', 5.0], ['Remo con mancuerna', 'fuerza', 5.0],
  ['Jalón al pecho', 'fuerza', 4.0], ['Prensa de piernas', 'fuerza', 5.0], ['Zancadas', 'fuerza', 5.0],
  ['Hip thrust', 'fuerza', 5.0], ['Curl de bíceps', 'fuerza', 3.5], ['Extensión de tríceps', 'fuerza', 3.5],
  ['Elevaciones laterales', 'fuerza', 3.5], ['Press inclinado', 'fuerza', 5.0], ['Aperturas', 'fuerza', 3.5],
  ['Extensión de cuádriceps', 'fuerza', 3.5], ['Curl femoral', 'fuerza', 3.5], ['Pantorrillas', 'fuerza', 3.5],
  ['Peso muerto rumano', 'fuerza', 6.0], ['Kettlebell swing', 'fuerza', 9.8],
  // Peso corporal
  ['Dominadas', 'peso-corporal', 8.0], ['Flexiones', 'peso-corporal', 8.0], ['Fondos', 'peso-corporal', 8.0],
  ['Sentadilla libre', 'peso-corporal', 5.0], ['Abdominales', 'peso-corporal', 3.8], ['Burpees', 'peso-corporal', 8.0],
  ['Muscle up', 'peso-corporal', 8.0], ['Elevación de piernas', 'peso-corporal', 3.8], ['Plancha', 'peso-corporal', 3.8],
  // Cardio (el MET de correr y caminar se recalcula con la velocidad si se anota la distancia)
  ['Correr', 'cardio', 9.8, 'correr'], ['Caminar', 'cardio', 3.5, 'caminar'], ['Trotar', 'cardio', 7.0, 'correr'],
  ['Bicicleta', 'cardio', 7.5], ['Bicicleta estática', 'cardio', 6.8], ['Elíptica', 'cardio', 5.0],
  ['Natación', 'cardio', 6.0], ['Saltar cuerda', 'cardio', 11.8], ['Remo (máquina)', 'cardio', 7.0],
  ['Escaladora', 'cardio', 9.0], ['Fútbol', 'cardio', 7.0], ['Baloncesto', 'cardio', 6.5], ['Spinning', 'cardio', 8.5],
].map(([nombre, tipo, met, modo = null]) => ({ nombre, tipo, met, modo }));

const normal = t => t.trim().toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu, '');
const PORNOMBRE = new Map(CATALOGO.map(e => [normal(e.nombre), e]));

export function buscarEnCatalogo(nombre) {
  return typeof nombre === 'string' ? PORNOMBRE.get(normal(nombre)) ?? null : null;
}

export const TIPOS = {
  fuerza: 'Con peso',
  'peso-corporal': 'Peso corporal',
  cardio: 'Cardio',
};
