# 12 · Registro de decisiones (ADR)

Formato: contexto → decisión → consecuencias. Añadir una entrada nueva por cada decisión técnica relevante; no editar las antiguas, sino marcarlas como *Reemplazada por ADR-XXX*.

---

## ADR-001 · Aplicación 100 % cliente (sin backend propio)
- **Estado**: Aceptada
- **Contexto**: se exige costo cero y buena privacidad.
- **Decisión**: SPA estática; PDFs generados en el navegador.
- **Consecuencias**: sin costo de servidor ni custodia de datos; el rendimiento depende del equipo del usuario (mitigado con Web Workers); el envío de correo requiere una pieza externa.

## ADR-002 · pdf-lib + pdf.js para PDF
- **Estado**: Aceptada
- **Decisión**: pdf.js para la vista previa; pdf-lib (+ fontkit) para componer el PDF final.
- **Consecuencias**: se conserva la calidad vectorial y se embeben fuentes con tildes y ñ. Se descartó dibujar en canvas y exportar como imagen por pérdida de calidad y mayor peso.

## ADR-003 · Coordenadas normalizadas (0–1)
- **Estado**: Aceptada
- **Decisión**: los recuadros se guardan normalizados desde arriba-izquierda; conversión a puntos PDF en un único módulo.
- **Consecuencias**: la vista previa coincide con el PDF en cualquier tamaño de pantalla; se evita un tipo común de error.

## ADR-004 · Correo mediante Google Apps Script del usuario
- **Estado**: Aceptada
- **Contexto**: un navegador no puede enviar correo; se busca opción gratuita, simple y con buena entregabilidad.
- **Decisión**: cada organizador despliega su propio script y la app lo invoca con URL + token. Se envía un correo por solicitud, con el PDF adjunto.
- **Consecuencias**:
  - (+) Gratis, sin dominio ni SPF/DKIM, remitente real.
  - (−) Cuota de 100/día en Gmail personal y 1.500/día en Workspace (oficial, sujeta a cambio); requiere configuración inicial; hay que validar CORS con un *spike* (ver doc 05).
- **Alternativas descartadas**: Nodemailer con Gmail (exige servidor); Brevo/Resend desde el inicio (exigen proxy para ocultar la clave y/o verificar dominio) → pasan a la Fase 3.

## ADR-005 · Interfaz `MailProvider` desde el día uno
- **Estado**: Aceptada
- **Decisión**: el dominio depende de una interfaz; Apps Script es el primer adaptador.
- **Consecuencias**: añadir Brevo/Resend en la Fase 3 no obliga a reescribir la cola ni la UI.

## ADR-006 · Cola de envío persistente en IndexedDB
- **Estado**: Aceptada
- **Decisión**: cada destinatario tiene estado; la cola se guarda y puede reanudarse.
- **Consecuencias**: tolera cierres de pestaña y agotamiento de cuota; requiere cuidado para no reenviar.

## ADR-007 · Stack: Vite + React + TypeScript + Tailwind + Zustand
- **Estado**: Aceptada
- **Decisión**: ver `03-stack-tecnologico.md`.
- **Consecuencias**: ecosistema amplio, curva de aprendizaje baja. Next.js descartado por no necesitar SSR.

## ADR-008 · Generación en Web Worker con flujo hacia ZIP
- **Estado**: Aceptada
- **Decisión**: el Worker genera de a un PDF y lo entrega al empaquetador; no se acumulan todos en memoria.
- **Consecuencias**: la interfaz permanece fluida y se soportan lotes grandes.

## Plantilla para nuevas ADR

```
## ADR-XXX · Título
- Estado: Propuesta | Aceptada | Reemplazada por ADR-YYY
- Contexto:
- Decisión:
- Consecuencias (+/−):
- Alternativas descartadas:
```
