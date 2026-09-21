# Asesor de Autoevaluación AWS — Contexto del Proyecto

## Descripción
Aplicación web estática (HTML/CSS/JS puro, sin frameworks ni build step) que permite
cargar un cuestionario de competencias AWS, registrar respuestas por criterio,
identificar gaps y exportar un reporte de evidencia en Markdown y JSON.

Se desarrolla como proyecto final del **Kiro University Challenge 2026**.

## Stack técnico
- **Frontend:** HTML5 + CSS3 + JavaScript ES2020 vanilla (sin frameworks)
- **Hosting:** Serverless / S3 Static Website o similar
- **Sin backend:** toda la lógica corre en el navegador del cliente
- **Sin bundler:** los archivos se sirven directamente, sin Webpack, Vite ni similares

## Estructura del proyecto
```
Kiro University Challenge/
├── index.html              # Punto de entrada único
├── css/
│   └── styles.css          # Estilos con variables CSS, diseño dark
├── js/
│   └── app.js              # Lógica completa de la app
└── data/
    └── questionnaire.json  # Cuestionario AWS con 6 categorías y 24 criterios
```

## Convenciones de código
- **JavaScript:** ES2020, sin TypeScript. Funciones nombradas (no arrow functions en el nivel raíz).
  Variables de estado en el objeto `state`. Referencias DOM en el objeto `elements`.
- **CSS:** Variables CSS en `:root`. BEM-lite para nombres de clases. Mobile-first con media queries.
  Paleta dark: `--color-bg: #0f1117`, superficie `#1a1d27`.
- **HTML:** Semántico, con atributos ARIA. Idioma `lang="es"`.
- **Idioma:** Toda la interfaz y los mensajes al usuario en **español**.

## Requisitos funcionales (EARS)
- **R1** — Carga del cuestionario desde `data/questionnaire.json`. Error claro si el JSON es inválido.
- **R2** — Respuesta por criterio: "Cumple", "Parcial" o "No cumple" + nota de evidencia opcional.
- **R3** — Análisis de gaps: lista criterios Parcial/No cumple y porcentaje de cumplimiento global.
- **R4** — Reporte exportable en Markdown (`.md`) y JSON (`.json`) con criterio, estado, evidencia y resumen.
- **R5** — Interfaz completamente en español.

## Patrón de estado
El estado vive en el objeto global `state`:
```js
const state = {
  cuestionario: null,     // datos del JSON cargado
  respuestas: {},         // { [critId]: { estado, nota } }
};
```

## Lo que NO hacer
- No agregar frameworks (React, Vue, etc.) sin pedido explícito del usuario.
- No introducir un bundler o proceso de build.
- No usar `innerHTML` con datos sin sanitizar (usar `escapeHtml()`).
- No agregar dependencias externas (npm, CDN) sin aprobación.
- No cambiar el idioma de la interfaz a inglés.
