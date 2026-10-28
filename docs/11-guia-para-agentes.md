# 11 · Guía para agentes de IA y desarrolladores

Lee este archivo **antes de escribir código**. Resume cómo trabajar en este repositorio.

## Orden de lectura

1. `docs/README.md` → panorama y decisiones ya tomadas.
2. `04-historial-y-roadmap.md` → qué existe y qué falta.
3. `02-arquitectura.md` y `07-buenas-practicas-y-patrones.md` → cómo está organizado el código.
4. Según la tarea: `05` (datos y formatos), `06` (UX), `08` (seguridad), `09` (pruebas y despliegue), `10` (ADR), `12` (Drive y QR).

## Diseño de interfaz: skill `impeccable`

Para cualquier trabajo visual (pantallas nuevas, rediseños, pulido, auditorías de UX, tipografía, color, responsive) usa la skill **impeccable**, en `.claude/skills/impeccable/`. Claude Code la carga sola; otros agentes pueden leer su `SKILL.md`.

- Empieza con `.claude/skills/impeccable/scripts/impeccable context` (descarga una vez su motor verificado con SHA-256 en `~/.impeccable/`).
- Al terminar un cambio de UI, pasa el detector: `.claude/skills/impeccable/scripts/impeccable detect --json <archivos>`.
- El proyecto aún no tiene `PRODUCT.md` ni `DESIGN.md`. Para trabajos grandes, crea primero `PRODUCT.md` con `/impeccable init`; para ajustes pequeños, la interfaz actual es la referencia.
- Respeta el estilo existente: verde `#208077`, Plus Jakarta Sans, interfaz minimalista con pocos textos.

## Reglas de oro

1. **El dominio no conoce el navegador ni las librerías.** Nada de React, DOM, pdf-lib ni `fetch` dentro de `src/domain`.
2. **TypeScript estricto.** Evita `any`; valida los datos externos.
3. **Datos personales**: nunca en logs ni en servicios distintos de Gmail (envío) y el Drive del organizador.
4. **Secretos**: nunca con prefijo `VITE_` ni en el código. `.env.local` no se sube.
5. **Escribe pruebas junto con el código**, sobre todo en `domain` e `infra`.
6. **Textos de la interfaz en español y cortos.**
7. **Accesibilidad y responsive (360 px) en todo componente nuevo.**
8. **No inventes límites ni precios de servicios externos**: verifícalos en su documentación oficial.

## Flujo de trabajo

1. Proponer un plan breve (archivos a crear/modificar).
2. Implementar en cambios pequeños.
3. Ejecutar `npx tsc -b`, `npm run test:run`, `npm run build` y `npm run test:e2e`.
4. Actualizar la documentación (y el ADR) si cambia el comportamiento o una decisión.
5. Commit con Conventional Commits en una rama propia; nunca directo a `main`.

## Definición de "terminado"

- [ ] Pruebas nuevas o actualizadas en verde
- [ ] Sin errores de tipos
- [ ] Revisado en 360 px y escritorio
- [ ] Estados vacío / cargando / error / éxito cubiertos
- [ ] Docs y ADR actualizados si corresponde

## Puntos de riesgo conocidos

- **Coordenadas**: la UI usa arriba-izquierda y el PDF abajo-izquierda (doc 05).
- **Fuentes**: la vista previa (Google Fonts) y el PDF (TTF de Fontsource) deben coincidir; comprobar tildes y ñ.
- **Drive**: el QR depende de IDs reservados antes de generar; nunca subir dos veces el mismo ID.
- **Correo**: nunca reenviar a un destinatario ya `enviado`; el cupo diario de Gmail es compartido.
- **Puerto de E2E**: Playwright usa el 5174; no detener el servidor de desarrollo del 5173.

## Cuando falte información

Elige la opción **más simple y gratuita** que cumpla el objetivo, documéntala como ADR y continúa.
