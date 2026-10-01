# Generador Automático de Certificados — Documentación

Esta carpeta es el **contexto oficial del proyecto** para el equipo de desarrollo y para agentes de IA. Léela en el orden indicado.

## Resumen en una frase

Aplicación web estática (sin servidor propio y sin costo) en la que el usuario sube una plantilla de certificado (PDF/imagen), marca dónde va el nombre, sube una lista (CSV/Excel/TXT) y obtiene todos los certificados en PDF, listos para descargar en un ZIP o enviar por correo.

## Índice

| # | Archivo | Contenido |
|---|---|---|
| 01 | [vision-y-alcance.md](01-vision-y-alcance.md) | Problema, usuarios, objetivos, requisitos funcionales y no funcionales |
| 02 | [arquitectura.md](02-arquitectura.md) | Capas, módulos, estructura de carpetas, flujo de datos |
| 03 | [stack-tecnologico.md](03-stack-tecnologico.md) | Tecnologías elegidas y su justificación |
| 04 | [fase-1-mvp.md](04-fase-1-mvp.md) | Plantilla + lista + ZIP de PDFs |
| 05 | [fase-2-envio-correo.md](05-fase-2-envio-correo.md) | Envío automático por correo (Google Apps Script) |
| 06 | [fase-3-avanzado.md](06-fase-3-avanzado.md) | Múltiples campos, QR, verificación, otros proveedores |
| 07 | [modelo-de-datos-y-formatos.md](07-modelo-de-datos-y-formatos.md) | Tipos, formatos de entrada, validaciones, coordenadas |
| 08 | [ux-ui-y-responsive.md](08-ux-ui-y-responsive.md) | Flujo de pantallas, diseño responsive, accesibilidad |
| 09 | [buenas-practicas-y-patrones.md](09-buenas-practicas-y-patrones.md) | Patrones de diseño, convenciones de código |
| 10 | [seguridad-y-privacidad.md](10-seguridad-y-privacidad.md) | Datos personales, token, CSP, riesgos |
| 11 | [testing-calidad-y-despliegue.md](11-testing-calidad-y-despliegue.md) | Pruebas, CI/CD, hosting gratuito |
| 12 | [decisiones-adr.md](12-decisiones-adr.md) | Registro de decisiones técnicas y alternativas descartadas |
| 13 | [guia-para-agentes.md](13-guia-para-agentes.md) | Reglas de trabajo para agentes de IA y desarrolladores |

## Decisiones ya tomadas (no reabrir sin motivo)

1. **100 % en el navegador**: no hay backend propio.
2. **Plantilla preferida: PDF** (calidad vectorial); imagen PNG/JPG también soportada.
3. **Correo (Fase 2): Google Apps Script con el Gmail de cada organizador.** Es gratis, simple y los correos salen de una cuenta real.
4. **Proveedores alternativos (Brevo, Resend)** quedan para la Fase 3 detrás de una interfaz común.
5. **Stack**: Vite + React + TypeScript + Tailwind.

> Los límites de servicios externos citados en estos documentos se verificaron en septiembre de 2026 y pueden cambiar. Reconfirmar en la documentación oficial antes de lanzar.
