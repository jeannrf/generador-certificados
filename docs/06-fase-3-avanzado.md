# 06 · Fase 3 — Funciones avanzadas

**Meta**: convertir el MVP en una herramienta completa y reutilizable. Las piezas son independientes y pueden priorizarse por separado.

## 3.1 Campos múltiples (RF-15)

- Varios `FieldBox` por plantilla: nombre, curso, fecha, horas, ID, etc.
- Cada campo se vincula a una columna del CSV/Excel o a un valor fijo.
- Reutiliza el motor de autoajuste de la Fase 1; el dominio ya debe modelar `fields: FieldBox[]` desde el inicio.

## 3.2 Proyectos guardables (RF-17)

- Autoguardado en IndexedDB (plantilla, campos, textos de correo; **sin** la lista de personas salvo que el usuario lo pida).
- Exportar/importar `proyecto.certgen.json` (plantilla en base64 + configuración), validado con Zod y con campo `version` para migraciones.

## 3.3 ID único, QR y verificación (RF-16)

- Cada certificado recibe un ID corto y no adivinable (p. ej. 10 caracteres base32 criptográficamente aleatorios).
- Se estampa como texto y/o QR (librería `qrcode` o `qr-code-styling`, en navegador).
- **Verificación pública** — opciones, de menor a mayor complejidad:
  1. **Lista estática**: se publica un archivo con los *hashes* de los IDs en el mismo hosting; la página `/verificar` consulta ese archivo. Sin backend; requiere re-publicar por evento.
  2. **Cloudflare Workers + KV/D1** (plan gratuito): API mínima de verificación. Verificar límites vigentes antes de adoptarla.
- Nunca publicar nombres ni correos en la verificación sin consentimiento; mostrar solo "válido / no válido" y datos mínimos.

## 3.4 Proveedores de correo adicionales (RF-18)

Se implementa una interfaz común (`MailProvider`) y se añaden adaptadores:

| Proveedor | Plan gratuito (verificado sept. 2026, fuentes secundarias) | Notas |
|---|---|---|
| **Brevo** | ~300 correos/día | Su plan gratuito suele añadir una marca "Sent with Brevo" |
| **Resend** | 3.000/mes, tope de 100/día, 1 dominio | Requiere verificar dominio (SPF/DKIM) |

- **La API key nunca debe ir en el navegador.** Estos proveedores exigen un proxy mínimo (Cloudflare Worker, plan gratuito) que guarde la clave como secreto y valide el origen.
- Reconfirmar límites, soporte de adjuntos y condiciones en la documentación oficial antes de implementar.

## 3.5 Calidad y producto

- Internacionalización (es / en) con `i18next` o similar.
- PWA instalable y funcionamiento offline para la generación (sin el envío).
- Plantillas de ejemplo descargables y lista de ejemplo CSV.
- Modo oscuro.
- Dividir nombres largos en dos líneas.
- Analítica **opcional y respetuosa** (sin datos personales), p. ej. contadores agregados.

## Orden sugerido

1. Campos múltiples + proyectos guardables.
2. ID/QR + verificación por lista estática.
3. i18n + PWA.
4. Proveedores alternativos con proxy.
5. Verificación con Workers + KV/D1 si el volumen lo justifica.

## Definición de terminado (por sub-fase)

Cada sub-fase se cierra con: criterios de aceptación escritos antes de programar, pruebas automatizadas, actualización de esta documentación y una entrada en `12-decisiones-adr.md` si introduce una decisión técnica nueva.
