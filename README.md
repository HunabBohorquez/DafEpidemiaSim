# EpidemiaSim — Simulador Espacial de Contagios (Modelo SIR)

> **Enlaces del proyecto**

**Link:** ` `

**Repositorio en GitHub:** ` `

> 📝 **Nota:** este proyecto tiene los **mismos archivos** que el repositorio de GitLab
> (`index.html`, `styles.css`, `app.js`, `README.md`). Solo cambia la plataforma de alojamiento.

---

## Descripción del Proyecto
EpidemiaSim es una aplicación web interactiva desarrollada completamente en HTML5, CSS3 y Vanilla JavaScript que simula la propagación de una enfermedad contagiosa en un entorno cerrado mediante el modelo SIR adaptado a un sistema multi-agente espacial (partículas con movimiento continuo).

## El Modelo SIR Espacial por Agentes
A diferencia de los modelos SIR tradicionales basados en ecuaciones diferenciales, este simulador modela cada individuo como un agente independiente con físicas 2D:
* **Susceptibles (Azul):** Individuos sanos que pueden ser contagiados si entran en el radio de infección de un portador.
* **Infectados (Rojo):** Portadores activos que contagian probabilísticamente a los susceptibles cercanos. Muestran un halo tenue que delimita su radio de contagio.
* **Recuperados (Verde):** Individuos que han superado la enfermedad y no pueden volver a contagiarse ni transmitirla.
* **Inmunes / Vacunados (Morado):** Individuos con protección inicial frente a la enfermedad.

## Instrucciones de Ejecución
Al ser una aplicación *front-end* pura sin dependencias de Node ni compiladores, la ejecución es inmediata:
1. Guarda los 4 archivos en la misma carpeta (`index.html`, `styles.css`, `app.js`, `README.md`).
2. Haz doble clic en el archivo `index.html` para abrirlo en cualquier navegador web moderno (Chrome, Firefox, Edge, Safari).
3. Selecciona un *Preset* o ajusta los controles manualmente y presiona "Iniciar".

## Pruebas Verificables
El simulador incorpora un generador de números pseudoaleatorios (PRNG) con semilla (por defecto 42), lo que permite que las ejecuciones sean deterministas y comparables.

### Comparación de Presets (Población 200)
* **Preset "Sin Medidas":** 
  * Resultado esperado: Propagación exponencial rápida. El pico de infección superará la línea de capacidad hospitalaria (25%) provocando el colapso del sistema. Casi la totalidad de los susceptibles terminarán en el estado Recuperado tras infectarse.
* **Preset "Inmunidad de Rebaño (75% Vacunados)":** 
  * Resultado esperado: Debido a que la mayoría de los agentes son barreras biológicas (Inmunes), la probabilidad de que el paciente cero encuentre una cadena ininterrumpida de susceptibles cae drásticamente. El pico de infectados se mantiene muy bajo y la curva epidemiológica nunca llega a cruzar el umbral de capacidad hospitalaria, protegiendo al 25% de susceptibles sin necesidad de que todos enfermen.
