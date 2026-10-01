# 13 · Guía para agentes de IA y desarrolladores

Lee este archivo **antes de escribir código**. Resume cómo trabajar en este repositorio.

## Orden de lectura

1. `README.md` → panorama y decisiones ya tomadas.
2. `01-vision-y-alcance.md` → qué construimos y qué no.
3. `02-arquitectura.md` y `09-buenas-practicas-y-patrones.md` → cómo estructurar el código.
4. El documento de la fase que vas a implementar (`04`, `05` o `06`).
5. `07`, `08`, `10`, `11` según la tarea.

## Reglas de oro

1. **Una fase a la vez.** No implementes funciones de fases futuras, pero deja los puntos de extensión descritos (p. ej. `fields: FieldBox[]`, `MailProvider`).
2. **El dominio no conoce el navegador ni las librerías.** Nada de React, DOM, pdf-lib ni fetch dentro de `src/domain`.
3. **Respeta las capas** definidas en `02-arquitectura.md`. Si necesitas romperlas, escribe un ADR primero.
4. **TypeScript estricto, sin `any`.** Valida datos externos con Zod.
5. **Datos personales:** nunca registrarlos en logs, nunca enviarlos a servicios propios ni de terceros distintos del script del usuario.
6. **Cada requisito tiene criterios de aceptación** en su documento de fase. Implementa exactamente eso y verifica cada criterio.
7. **Escribe pruebas junto con el código**, especialmente en dominio y parsers.
8. **Textos de UI en español** desde archivos de recursos, no en línea.
9. **Accesibilidad y responsive no son opcionales**: aplican a todo componente nuevo.
10. **No inventes límites ni precios de servicios externos.** Si dependes de uno, verifícalo en su documentación oficial y anótalo.

## Flujo de trabajo para cada tarea

1. Identificar los RF/historias afectados.
2. Proponer un plan breve (archivos a crear/modificar, interfaces nuevas).
3. Implementar en cambios pequeños y revisables.
4. Ejecutar `lint`, `typecheck`, `test` y `build` localmente.
5. Actualizar la documentación si cambia el comportamiento o una decisión.
6. Describir el cambio con Conventional Commits.

## Definición de "terminado" de una tarea

- [ ] Criterios de aceptación cumplidos
- [ ] Pruebas nuevas o actualizadas en verde
- [ ] Sin errores de lint ni de tipos
- [ ] Revisado en 360 px y escritorio
- [ ] Estados vacío / cargando / error / éxito cubiertos
- [ ] Docs y ADR actualizados si corresponde

## Puntos de riesgo conocidos (prestar atención)

- **Coordenadas**: UI arriba-izquierda vs PDF abajo-izquierda (ver doc 07).
- **CORS con Apps Script**: validar con el spike antes de construir la cola (doc 05).
- **Fuentes**: usar TTF/OTF con subsetting; comprobar tildes y ñ.
- **Memoria**: no acumular cientos de PDFs sin empaquetar.
- **Cuota de correo**: nunca asumir un valor fijo; consultar al script.
- **Idempotencia del envío**: jamás reenviar a un destinatario ya `enviado`.

## Cuando falte información

No bloquees el trabajo: elige la opción **más simple y gratuita** que cumpla los criterios, documéntala como ADR y continúa.
