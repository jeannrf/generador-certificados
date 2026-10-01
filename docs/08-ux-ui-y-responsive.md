# 08 · UX, UI y responsive

## Principios

1. **Un paso, una decisión.** Wizard lineal con progreso visible.
2. **Mostrar, no explicar.** Vista previa en vivo en cada paso.
3. **Prevenir errores antes que corregirlos.** Validar al subir, no al final.
4. **Nada se pierde.** Volver atrás conserva todo.
5. **Lenguaje claro**, sin términos técnicos.

## Flujo de pantallas

| Paso | Pantalla | Acción principal |
|---|---|---|
| 1 | Plantilla | Arrastrar/soltar o elegir archivo |
| 2 | Campo del nombre | Dibujar recuadro y elegir estilo |
| 3 | Lista | Subir archivo y confirmar columnas |
| 4 | Revisión | Corregir filas y ver vista previa |
| 5 | Generar | Descargar ZIP |
| 6 | Enviar (Fase 2) | Conectar, probar y enviar |

Encabezado fijo con *stepper* (1–6). Botones "Atrás" y "Continuar" siempre en la misma posición; "Continuar" deshabilitado con explicación si falta algo.

## Estados que toda pantalla debe cubrir

Vacío · Cargando · Éxito · Error · Parcial (con advertencias). Ninguna pantalla se entrega sin los cinco.

## Responsive

Enfoque **mobile-first**, puntos de quiebre de Tailwind (`sm 640`, `md 768`, `lg 1024`, `xl 1280`).

| Ancho | Diseño |
|---|---|
| < 640 px | Una columna; panel de controles debajo de la vista previa o en *bottom sheet*; tabla de revisión como tarjetas |
| 640–1024 px | Vista previa arriba, controles en dos columnas |
| ≥ 1024 px | Dos paneles: vista previa (izquierda, ~65 %) y controles (derecha) |

- Editor del recuadro: soportar **ratón y táctil** (Pointer Events), con tiradores de al menos 24 px en móvil.
- Tablas largas con virtualización (`@tanstack/react-virtual`) a partir de 200 filas.
- Probar mínimo en 360×640, 768×1024 y 1440×900.

## Accesibilidad (WCAG 2.1 AA)

- Navegación completa por teclado y foco visible.
- Contraste mínimo 4,5:1 en texto.
- Etiquetas y `aria-*` en todos los controles; el editor del recuadro tiene alternativa por teclado y campos numéricos (x, y, ancho, alto).
- Mensajes de estado con `aria-live` (progreso, errores).
- Respetar `prefers-reduced-motion` y `prefers-color-scheme`.

## Sistema de diseño

- Tokens en Tailwind (`colors`, `spacing`, `radius`, `fontSize`) en un único archivo de configuración.
- Componentes base en `src/ui/`: `Button`, `Input`, `Select`, `Dropzone`, `Stepper`, `Modal`, `Toast`, `ProgressBar`, `Table`, `Alert`.
- Estilo visual sobrio y profesional (el producto genera documentos formales). Paleta neutra con un color de acento.

## Textos y mensajes

- Español neutro, trato de "tú".
- Errores con **qué pasó + qué hacer**: "El archivo no tiene una columna de nombres. Selecciona cuál contiene los nombres."
- Todos los textos en archivos de recursos (`shared/i18n/es.ts`), nunca en línea dentro de los componentes.
