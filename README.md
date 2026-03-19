# FitnessLog

App para registrar entrenamientos diarios con historial y estimacion de calorias quemadas. No requiere backend ni instalacion — todo corre en el navegador.

## Funcionalidades

- Registro de ejercicios de pesas, cardio y calistenia
- Historial organizado por fecha
- Estimacion de calorias quemadas por tipo de entrenamiento
- Persistencia de datos via localStorage (los datos se mantienen al cerrar el navegador)

## Tecnologias

- HTML5
- CSS3 (variables, grid, animaciones)
- JavaScript vanilla
- localStorage

## Estructura del proyecto

```
fitness-log/
├── index.html        - Estructura principal y tabs de navegacion
├── css/
│   └── styles.css    - Estilos, variables y responsive
├── js/
│   └── app.js        - Logica, localStorage y renderizado
├── .gitignore
└── README.md
```

## Estructura de datos (localStorage)

Los datos se guardan bajo la clave `fitnesslog` con este formato:

```json
{
  "2026-03-18": [
    {
      "id": 1710000000000,
      "tipo": "pesas",
      "nombre": "Sentadilla",
      "series": "4",
      "reps": "12",
      "peso": "80",
      "notas": "Sin dolor en rodilla"
    }
  ]
}
```

## Estimacion de calorias

| Tipo | Formula |
|---|---|
| Pesas | series x 6 kcal |
| Cardio | minutos x 8 kcal |
| Calistenia | series x 5 kcal |

Valores basados en promedios generales. El resultado real varia segun peso corporal e intensidad.

## Como correrlo

1. Clona el repo:
   ```bash
   git clone https://github.com/eliasgdev/fitness-log.git
   ```
2. Abre `index.html` en tu navegador o usa Live Server en VS Code

No necesita dependencias ni instalacion adicional.

## Autor

**Elias Gutierrez** — [github.com/eliasgdev](https://github.com/eliasgdev)
