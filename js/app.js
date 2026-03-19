/* ============================================================
   FITNESS LOG - app.js
   
   Descripcion:
     Logica principal de la app. Maneja el registro de ejercicios,
     persistencia en localStorage, renderizado del historial y
     calculo estimado de calorias quemadas.

   Estructura de datos en localStorage:
     clave:  "fitnesslog"
     valor:  objeto JSON con fechas como claves
     ejemplo:
     {
       "2026-03-18": [
         {
           id: 1710000000000,
           tipo: "pesas",
           nombre: "Sentadilla",
           series: "4",
           reps: "12",
           peso: "80",
           notas: "Sin dolor en rodilla"
         },
         ...
       ]
     }

   Estimacion de calorias:
     pesas:      6 kcal por serie
     cardio:     8 kcal por minuto
     calistenia: 5 kcal por serie
     
   Nota: estos son promedios generales. El valor real varia
   segun el peso corporal, intensidad y descansos.
   ============================================================ */


// ============================================================
// CONSTANTES
// ============================================================

// Calorias estimadas segun tipo de ejercicio
var CALORIAS = {
  pesas:      6,   // kcal por serie
  cardio:     8,   // kcal por minuto de duracion
  calistenia: 5    // kcal por serie
};

// Clave usada para guardar en localStorage
var STORAGE_KEY = "fitnesslog";


// ============================================================
// ESTADO
// ============================================================

// Tipo de entrenamiento seleccionado actualmente en el form
var tipoActual = "pesas";


// ============================================================
// UTILIDADES DE FECHA
// ============================================================

/*
 * Retorna la fecha de hoy en formato "YYYY-MM-DD"
 * Se usa como clave para agrupar ejercicios por dia
 */
function fechaHoy() {
  return new Date().toISOString().split("T")[0];
}

/*
 * Convierte una fecha "YYYY-MM-DD" a texto legible en español
 * Ejemplo: "2026-03-18" -> "miercoles, 18 de marzo de 2026"
 *
 * Se agrega T12:00:00 para evitar desfase de zona horaria
 * que causaria que el dia aparezca un dia antes
 */
function fechaLegible(fecha) {
  var d = new Date(fecha + "T12:00:00");
  return d.toLocaleDateString("es-CO", {
    weekday: "long",
    year:    "numeric",
    month:   "long",
    day:     "numeric"
  });
}


// ============================================================
// MANEJO DE DATOS (localStorage)
// ============================================================

/*
 * Carga y retorna todos los datos guardados
 * Si no hay datos aun, retorna un objeto vacio
 */
function cargarDatos() {
  var raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

/*
 * Guarda el objeto de datos completo en localStorage
 * Sobreescribe el valor anterior
 */
function guardarDatos(datos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(datos));
}

/*
 * Retorna el array de ejercicios del dia de hoy
 * Si no hay ejercicios hoy, retorna array vacio
 */
function ejerciciosHoy() {
  var datos = cargarDatos();
  return datos[fechaHoy()] || [];
}


// ============================================================
// TABS - Navegacion entre secciones
// ============================================================

var tabs    = document.querySelectorAll(".tab");
var contents = document.querySelectorAll(".tab-content");

for (var i = 0; i < tabs.length; i++) {
  tabs[i].addEventListener("click", function() {
    var target = this.getAttribute("data-tab");

    // Desactivar todas las tabs y ocultar todos los contenidos
    for (var j = 0; j < tabs.length; j++)    tabs[j].classList.remove("active");
    for (var k = 0; k < contents.length; k++) {
      contents[k].classList.add("hidden");
      contents[k].classList.remove("active");
    }

    // Activar la tab seleccionada
    this.classList.add("active");
    document.getElementById("tab-" + target).classList.remove("hidden");
    document.getElementById("tab-" + target).classList.add("active");

    // Cada tab tiene su propio render
    if (target === "historial") renderHistorial();
    if (target === "calorias")  renderCalorias();
  });
}


// ============================================================
// SELECTOR DE TIPO DE ENTRENAMIENTO
// ============================================================

var tipoBtns = document.querySelectorAll(".tipo-btn");

for (var t = 0; t < tipoBtns.length; t++) {
  tipoBtns[t].addEventListener("click", function() {
    // Quitar activo de todos y activar el clickeado
    for (var x = 0; x < tipoBtns.length; x++) tipoBtns[x].classList.remove("active");
    this.classList.add("active");

    tipoActual = this.getAttribute("data-tipo");
    mostrarCampos(); // Mostrar los inputs correspondientes
  });
}

/*
 * Oculta todos los grupos de campos y muestra
 * solo los que corresponden al tipo seleccionado
 */
function mostrarCampos() {
  document.getElementById("rowPesas").classList.add("hidden");
  document.getElementById("rowCardio").classList.add("hidden");
  document.getElementById("rowCalistenia").classList.add("hidden");

  if (tipoActual === "pesas")      document.getElementById("rowPesas").classList.remove("hidden");
  if (tipoActual === "cardio")     document.getElementById("rowCardio").classList.remove("hidden");
  if (tipoActual === "calistenia") document.getElementById("rowCalistenia").classList.remove("hidden");
}


// ============================================================
// GUARDAR EJERCICIO
// ============================================================

document.getElementById("btnGuardar").addEventListener("click", function() {
  var nombre = document.getElementById("ejercicioNombre").value.trim();
  var notas  = document.getElementById("notas").value.trim();
  var msg    = document.getElementById("feedbackMsg");

  // Validacion: el nombre es obligatorio
  if (!nombre) {
    msg.style.color   = "#e63946";
    msg.innerHTML     = "Escribe el nombre del ejercicio.";
    return;
  }

  // Construir el objeto base del ejercicio
  var ejercicio = {
    id:     Date.now(), // ID unico basado en timestamp
    tipo:   tipoActual,
    nombre: nombre,
    notas:  notas
  };

  // Agregar campos segun el tipo seleccionado
  if (tipoActual === "pesas") {
    ejercicio.series = document.getElementById("series").value || 0;
    ejercicio.reps   = document.getElementById("reps").value   || 0;
    ejercicio.peso   = document.getElementById("peso").value   || 0;
  }

  if (tipoActual === "cardio") {
    ejercicio.duracion  = document.getElementById("duracion").value  || 0;
    ejercicio.distancia = document.getElementById("distancia").value || 0;
  }

  if (tipoActual === "calistenia") {
    ejercicio.series = document.getElementById("seriesC").value || 0;
    ejercicio.reps   = document.getElementById("repsC").value   || 0;
  }

  // Guardar en localStorage
  var datos = cargarDatos();
  var hoy   = fechaHoy();
  if (!datos[hoy]) datos[hoy] = [];
  datos[hoy].push(ejercicio);
  guardarDatos(datos);

  // Limpiar todos los campos del formulario
  document.getElementById("ejercicioNombre").value = "";
  document.getElementById("notas").value           = "";
  document.getElementById("series").value          = "";
  document.getElementById("reps").value            = "";
  document.getElementById("peso").value            = "";
  document.getElementById("duracion").value        = "";
  document.getElementById("distancia").value       = "";
  document.getElementById("seriesC").value         = "";
  document.getElementById("repsC").value           = "";

  // Mostrar confirmacion y limpiarla despues de 2.5s
  msg.style.color = "#2a9d3f";
  msg.innerHTML   = "Ejercicio guardado correctamente.";
  setTimeout(function() { msg.innerHTML = ""; }, 2500);

  renderHoy(); // Actualizar lista del dia
});


// ============================================================
// RENDER - Lista de ejercicios del dia
// ============================================================

/*
 * Lee los ejercicios de hoy desde localStorage y
 * los renderiza en la seccion de resumen del dia
 */
function renderHoy() {
  var lista     = ejerciciosHoy();
  var container = document.getElementById("ejerciciosHoy");
  var count     = document.getElementById("resumenCount");

  count.innerHTML = lista.length;

  if (lista.length === 0) {
    container.innerHTML = '<p class="empty-msg">Aun no registras nada hoy.</p>';
    return;
  }

  var html = "";

  for (var i = 0; i < lista.length; i++) {
    var e       = lista[i];
    var detalle = armarDetalle(e);

    html +=
      '<div class="ejercicio-item">' +
        '<div class="ejercicio-info">' +
          '<div class="ejercicio-nombre">' + e.nombre + '</div>' +
          '<div class="ejercicio-detalle">' + detalle + '</div>' +
        '</div>' +
        '<span class="ejercicio-tipo">' + e.tipo + '</span>' +
        '<button class="btn-eliminar" data-id="' + e.id + '">X</button>' +
      '</div>';
  }

  container.innerHTML = html;

  // Asignar evento eliminar a cada boton
  var btns = container.querySelectorAll(".btn-eliminar");
  for (var j = 0; j < btns.length; j++) {
    btns[j].addEventListener("click", function() {
      eliminarEjercicio(parseInt(this.getAttribute("data-id")));
    });
  }
}

/*
 * Construye el texto de detalle de un ejercicio
 * segun su tipo (pesas, cardio o calistenia)
 */
function armarDetalle(e) {
  var detalle = "";

  if (e.tipo === "pesas")
    detalle = e.series + " series x " + e.reps + " reps — " + e.peso + " kg";

  if (e.tipo === "cardio")
    detalle = e.duracion + " min — " + e.distancia + " km";

  if (e.tipo === "calistenia")
    detalle = e.series + " series x " + e.reps + " reps";

  if (e.notas) detalle += " · " + e.notas;

  return detalle;
}


// ============================================================
// ELIMINAR EJERCICIO
// ============================================================

/*
 * Elimina un ejercicio del dia de hoy por su ID
 * y vuelve a renderizar la lista
 */
function eliminarEjercicio(id) {
  var datos  = cargarDatos();
  var hoy    = fechaHoy();
  if (!datos[hoy]) return;

  // Filtrar el ejercicio con el ID indicado
  var nuevos = [];
  for (var i = 0; i < datos[hoy].length; i++) {
    if (datos[hoy][i].id !== id) nuevos.push(datos[hoy][i]);
  }

  datos[hoy] = nuevos;
  guardarDatos(datos);
  renderHoy();
}


// ============================================================
// RENDER - Historial
// ============================================================

/*
 * Lee todos los dias guardados y los renderiza
 * ordenados del mas reciente al mas antiguo
 */
function renderHistorial() {
  var datos     = cargarDatos();
  var container = document.getElementById("historialLista");
  var fechas    = Object.keys(datos).sort().reverse();

  if (fechas.length === 0) {
    container.innerHTML = '<p class="empty-msg">Aun no hay historial. Empieza a entrenar.</p>';
    return;
  }

  var html = "";

  for (var f = 0; f < fechas.length; f++) {
    var fecha = fechas[f];
    var lista = datos[fecha];

    html +=
      '<div class="historial-dia">' +
        '<div class="historial-fecha">' +
          fechaLegible(fecha) + ' — ' + lista.length + ' ejercicios' +
        '</div>' +
        '<div class="historial-card">';

    for (var i = 0; i < lista.length; i++) {
      var e = lista[i];
      html +=
        '<div class="ejercicio-item">' +
          '<div class="ejercicio-info">' +
            '<div class="ejercicio-nombre">' + e.nombre + '</div>' +
            '<div class="ejercicio-detalle">' + armarDetalle(e) + '</div>' +
          '</div>' +
          '<span class="ejercicio-tipo">' + e.tipo + '</span>' +
        '</div>';
    }

    html += '</div></div>';
  }

  container.innerHTML = html;
}


// ============================================================
// RENDER - Calorias
// ============================================================

/*
 * Calcula y muestra las calorias estimadas quemadas hoy
 * desglosadas por tipo de entrenamiento
 *
 * Formula:
 *   pesas:      series * 6 kcal
 *   cardio:     duracion (min) * 8 kcal
 *   calistenia: series * 5 kcal
 */
function renderCalorias() {
  var lista         = ejerciciosHoy();
  var calPesas      = 0;
  var calCardio     = 0;
  var calCalistenia = 0;

  for (var i = 0; i < lista.length; i++) {
    var e = lista[i];

    if (e.tipo === "pesas")
      calPesas += (parseInt(e.series) || 0) * CALORIAS.pesas;

    if (e.tipo === "cardio")
      calCardio += (parseInt(e.duracion) || 0) * CALORIAS.cardio;

    if (e.tipo === "calistenia")
      calCalistenia += (parseInt(e.series) || 0) * CALORIAS.calistenia;
  }

  var total = calPesas + calCardio + calCalistenia;

  document.getElementById("calTotal").innerHTML        = total;
  document.getElementById("macroPesas").innerHTML      = calPesas;
  document.getElementById("macroCardio").innerHTML     = calCardio;
  document.getElementById("macroCalistenia").innerHTML = calCalistenia;
}


// ============================================================
// INICIALIZACION
// ============================================================

// Mostrar fecha actual en el header
document.getElementById("headerDate").innerHTML = new Date().toLocaleDateString("es-CO", {
  weekday: "long",
  day:     "numeric",
  month:   "long"
});

// Mostrar los campos correctos segun tipo inicial
mostrarCampos();

// Cargar ejercicios del dia al abrir la app
renderHoy();