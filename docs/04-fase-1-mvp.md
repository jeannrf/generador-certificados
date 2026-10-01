# 04 · Fase 1 — MVP: plantilla + lista + ZIP de PDFs

**Meta**: un producto útil sin backend y sin costo. El usuario descarga un ZIP con todos los certificados.

## Alcance

RF-01 a RF-09 (ver `01-vision-y-alcance.md`).

## Entregables

1. Proyecto base (Vite + React + TS + Tailwind + lint + tests + CI).
2. Wizard de 5 pasos con diseño responsive.
3. Carga y vista previa de plantilla (PDF/PNG/JPG).
4. Editor del campo nombre (arrastrar y redimensionar).
5. Carga de lista (CSV/XLSX/TXT), mapeo de columnas y validación.
6. Motor de generación en Web Worker.
7. Descarga de ZIP con nombres de archivo seguros.

## Historias de usuario y criterios de aceptación

### H1 · Subir plantilla
- Acepta `.pdf`, `.png`, `.jpg/.jpeg`. Rechaza otros con mensaje claro.
- Límite sugerido: 15 MB. Si es imagen mayor a 2480×1754 px, se ofrece reducirla.
- PDFs de varias páginas: se usa la primera (aviso visible).
- Muestra vista previa fiel.

### H2 · Marcar el área del nombre
- El usuario dibuja y mueve un rectángulo sobre la vista previa.
- Controles: fuente, tamaño máximo, tamaño mínimo, color, alineación (izq/centro/der), alineación vertical, transformación (original / Título / MAYÚSCULAS).
- Texto de ejemplo editable para ver el resultado en vivo.
- Teclas de flecha mueven el recuadro 1 px (Shift = 10 px).

### H3 · Subir lista
- Acepta `.csv`, `.xlsx`, `.xls`, `.txt`.
- CSV: detecta delimitador `,` `;` o tabulador y codificación UTF-8 (con o sin BOM).
- TXT: un nombre por línea; si hay coma o punto y coma, se interpreta como `nombre,correo`.
- Excel: se lee la primera hoja (selector si hay varias).
- Detección automática de columnas por encabezado (`nombre`, `name`, `correo`, `email`, `e-mail`…); el usuario puede corregir.

### H4 · Revisar datos
- Tabla con estado por fila: ✔ válida · ⚠ advertencia · ✖ error.
- Detecta: nombre vacío, correo inválido (si hay columna de correo), duplicados, espacios sobrantes.
- Acciones: eliminar fila, corregir en línea, descartar todas las inválidas.
- Resumen: total, válidas, con advertencia, con error.

### H5 · Vista previa final
- Muestra el primer nombre y el **más largo** de la lista.
- Permite navegar por cualquier destinatario.

### H6 · Generar y descargar
- Progreso real (n de N) y botón cancelar.
- ZIP con `Certificado - {nombre}.pdf`, nombres saneados (sin `/ \ : * ? " < > |`), con sufijo numérico si hay repetidos.
- Resumen final y opción de volver a generar.

## Algoritmo de texto (referencia)

1. Normalizar nombre según la opción elegida.
2. Calcular `ancho = font.widthOfTextAtSize(texto, tamaño)`.
3. Si `ancho > anchoCaja`, reducir el tamaño de a 0,5 pt hasta caber o llegar al mínimo.
4. Si aún no cabe en el mínimo: advertencia en la revisión; opción de dividir en dos líneas.
5. Posicionar según alineación horizontal y vertical dentro de la caja.

## Definición de terminado (DoD)

- Todos los criterios de aceptación cumplidos.
- Pruebas unitarias de dominio (≥ 80 % de cobertura) y un e2e del flujo completo.
- 500 certificados generados en menos de 60 s sin congelar la interfaz.
- Probado en móvil (360 px), tablet y escritorio.
- Sin errores de lint ni advertencias de accesibilidad críticas.
- Desplegado en hosting gratuito.
