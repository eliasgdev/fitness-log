import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  unaRM, mejorUnaRM, volumen, minutos, calorias, metDe, records, recordsNuevos, progreso,
  resumen, semanas, racha, inicioSemana, sumarDias, esFechaValida, validarEntrada, migrarV1,
} from '../js/calculos.js';
import { buscarEnCatalogo } from '../js/catalogo.js';

const fuerza = (fecha, ejercicio, series, id = `${fecha}-${ejercicio}`) => ({ id, fecha, ejercicio, tipo: 'fuerza', series });

test('1RM con Epley, y nulo con más de 12 repeticiones', () => {
  assert.equal(unaRM(100, 1), 100);
  assert.equal(unaRM(80, 10), 106.5);
  assert.equal(unaRM(80, 13), null);
  assert.equal(unaRM(0, 5), null);
  assert.equal(mejorUnaRM({ series: [{ reps: 5, kg: 100 }, { reps: 20, kg: 60 }, { reps: 3, kg: 105 }] }), 116.5);
});

test('volumen y minutos de una entrada de fuerza', () => {
  const e = fuerza('2026-11-20', 'Sentadilla', [{ reps: 10, kg: 60 }, { reps: 8, kg: 70 }]);
  assert.equal(volumen(e), 1160);
  assert.equal(minutos(e), 5);
});

test('calorías con MET × peso × horas', () => {
  const e = { tipo: 'cardio', minutos: 60, modo: null };
  assert.equal(calorias(e, 70, 7.5), 525);
  assert.equal(calorias(e, null, 7.5), 0);
});

test('correr con distancia usa la ecuación del ACSM', () => {
  // 10 km/h = 166,7 m/min → VO2 = 36,8 → 10,5 MET
  const met = metDe({ tipo: 'cardio', modo: 'correr', km: 10, minutos: 60 }, 9.8);
  assert.ok(Math.abs(met - 10.52) < 0.01);
  // Caminar a 5 km/h → 3,4 MET
  const caminar = metDe({ tipo: 'cardio', modo: 'caminar', km: 5, minutos: 60 }, 3.5);
  assert.ok(Math.abs(caminar - 3.38) < 0.01);
  // Sin distancia, el del catálogo
  assert.equal(metDe({ tipo: 'cardio', modo: 'correr', minutos: 30 }, 9.8), 9.8);
});

test('récords por ejercicio sin importar mayúsculas', () => {
  const r = records([
    fuerza('2026-11-01', 'Sentadilla', [{ reps: 5, kg: 100 }]),
    fuerza('2026-11-08', 'sentadilla ', [{ reps: 1, kg: 120 }]),
  ]);
  assert.equal(r.size, 1);
  assert.deepEqual(r.get('sentadilla').unaRM, { valor: 120, fecha: '2026-11-08' });
  assert.deepEqual(r.get('sentadilla').kg, { valor: 120, fecha: '2026-11-08' });
});

test('recordsNuevos avisa solo si supera el historial', () => {
  const antes = [fuerza('2026-11-01', 'Press de banca', [{ reps: 5, kg: 80 }])];
  assert.deepEqual(recordsNuevos(antes, fuerza('2026-11-08', 'Press de banca', [{ reps: 5, kg: 85 }])), ['1RM estimado de 99 kg']);
  assert.deepEqual(recordsNuevos(antes, fuerza('2026-11-08', 'Press de banca', [{ reps: 5, kg: 70 }])), []);
  // La primera vez no es récord: no hay con qué comparar.
  assert.deepEqual(recordsNuevos([], fuerza('2026-11-08', 'Press de banca', [{ reps: 5, kg: 85 }])), []);
  const cardio = (fecha, km, id) => ({ id, fecha, ejercicio: 'Correr', tipo: 'cardio', minutos: 30, km });
  assert.deepEqual(recordsNuevos([cardio('2026-11-01', 5, 'a')], cardio('2026-11-02', 6, 'b')), ['6 km']);
});

test('progreso toma el mejor valor de cada día en orden', () => {
  const p = progreso([
    fuerza('2026-11-08', 'Sentadilla', [{ reps: 1, kg: 110 }], 'b'),
    fuerza('2026-11-01', 'Sentadilla', [{ reps: 1, kg: 100 }], 'a'),
    fuerza('2026-11-08', 'Sentadilla', [{ reps: 1, kg: 115 }], 'c'),
    fuerza('2026-11-08', 'Remo', [{ reps: 1, kg: 300 }], 'd'),
  ], 'Sentadilla');
  assert.deepEqual(p, [{ fecha: '2026-11-01', valor: 100 }, { fecha: '2026-11-08', valor: 115 }]);
});

test('fechas: semana empieza el lunes y cruza meses', () => {
  assert.equal(inicioSemana('2026-11-20'), '2026-11-16'); // viernes → lunes
  assert.equal(inicioSemana('2026-11-16'), '2026-11-16');
  assert.equal(inicioSemana('2026-11-22'), '2026-11-16'); // domingo
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(esFechaValida('2026-02-30'), false);
  assert.equal(esFechaValida('2026-02-28'), true);
});

test('resumen, semanas y racha', () => {
  const e = [
    fuerza('2026-11-17', 'Sentadilla', [{ reps: 10, kg: 50 }], '1'),
    fuerza('2026-11-17', 'Remo', [{ reps: 10, kg: 40 }], '2'),
    fuerza('2026-11-19', 'Sentadilla', [{ reps: 10, kg: 50 }], '3'),
    fuerza('2026-11-10', 'Sentadilla', [{ reps: 10, kg: 50 }], '4'),
    fuerza('2026-10-20', 'Sentadilla', [{ reps: 10, kg: 50 }], '5'),
  ];
  const r = resumen(e, { desde: '2026-11-16', hasta: '2026-11-22', pesoKg: 70 });
  assert.equal(r.dias, 2);
  assert.equal(r.ejercicios, 3);
  assert.equal(r.volumen, 1400);
  const s = semanas(e, '2026-11-20', 6);
  assert.deepEqual(s.map(x => x.dias), [0, 1, 0, 0, 1, 2]);
  assert.equal(racha(e, '2026-11-20'), 2);
  // La semana actual vacía no corta la racha.
  assert.equal(racha(e, '2026-11-24'), 2);
  assert.equal(racha([], '2026-11-24'), 0);
});

test('validarEntrada exige datos coherentes', () => {
  const ok = validarEntrada({ fecha: '2026-11-20', ejercicio: '  Press   de banca ', tipo: 'fuerza', series: [{ reps: 8, kg: 60 }] });
  assert.equal(ok.ok, true);
  assert.equal(ok.entrada.ejercicio, 'Press de banca');

  assert.ok(validarEntrada({ fecha: '2026-11-20', ejercicio: 'X', tipo: 'fuerza', series: [] }).errores.series);
  assert.ok(validarEntrada({ fecha: '2026-11-20', ejercicio: 'X', tipo: 'fuerza', series: [{ reps: 0, kg: 10 }] }).errores.series);
  assert.ok(validarEntrada({ fecha: '2026-11-20', ejercicio: 'X', tipo: 'fuerza', series: [{ reps: 5, kg: 9999 }] }).errores.series);
  assert.ok(validarEntrada({ fecha: '2026-11-20', ejercicio: 'X', tipo: 'cardio', minutos: 0 }).errores.minutos);
  assert.ok(validarEntrada({ fecha: 'ayer', ejercicio: 'X', tipo: 'cardio', minutos: 5 }).errores.fecha);
  assert.ok(validarEntrada({ fecha: '2026-11-20', ejercicio: 'x'.repeat(61), tipo: 'cardio', minutos: 5 }).errores.ejercicio);
  assert.ok(validarEntrada({ fecha: '2026-11-20', ejercicio: 'X', tipo: 'yoga', minutos: 5 }).errores.tipo);
  assert.ok(validarEntrada(null).errores.ejercicio);
});

test('migra el formato anterior sin perder entrenamientos válidos', () => {
  const viejo = {
    '2026-03-18': [
      { id: 1710000000000, tipo: 'pesas', nombre: 'Sentadilla', series: '4', reps: '12', peso: '80', notas: 'Sin dolor' },
      { id: 1710000000001, tipo: 'cardio', nombre: 'Correr', duracion: '30' },
      { id: 1710000000002, tipo: 'calistenia', nombre: 'Dominadas', series: '3', reps: '8', peso: '' },
      { id: 1710000000003, tipo: 'pesas', nombre: '', series: '3', reps: '8' },
    ],
  };
  const e = migrarV1(viejo);
  assert.equal(e.length, 3);
  assert.equal(e[0].series.length, 4);
  assert.deepEqual(e[0].series[0], { reps: 12, kg: 80 });
  assert.equal(e[1].minutos, 30);
  assert.equal(e[2].tipo, 'peso-corporal');
  assert.equal(migrarV1('basura').length, 0);
});

test('el catálogo encuentra ejercicios sin tildes', () => {
  assert.equal(buscarEnCatalogo('eliptica').nombre, 'Elíptica');
  assert.equal(buscarEnCatalogo('PRESS DE BANCA').tipo, 'fuerza');
  assert.equal(buscarEnCatalogo('Nada'), null);
});
