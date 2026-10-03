# Despliegue de Google Apps Script (Envío con Gmail)
 
Sigue estos 3 pasos rápidos para conectar tu cuenta de Gmail al Generador de Certificados:
 
### Paso 1: Crear el proyecto
1. Ve a [script.google.com](https://script.google.com) con tu cuenta de Google.
2. Haz clic en el botón superior **"Nuevo proyecto"**.
3. Cambia el título a `Despachador de Certificados`.
 
### Paso 2: Pegar el código
1. Borra lo que haya en el editor y pega todo el contenido del archivo [`Code.gs`](Code.gs).
2. Guarda los cambios presionando `Ctrl + S` (o el icono de disco).
 
### Paso 3: Implementar como Aplicación Web
1. Haz clic en el botón azul superior **Implementar** > **Nueva implementación**.
2. Haz clic en el engranaje ⚙️ junto a "Seleccionar tipo" y elige **"Aplicación web"**.
3. Completa los campos:
   - **Descripción**: `v1`
   - **Ejecutar como**: `Yo (tu_correo@gmail.com)`
   - **Quién tiene acceso**: `Cualquier persona` *(Anyone)* — Google te pedirá autorizar permisos la primera vez.
4. Haz clic en **Implementar**.
5. Copia la **URL de la aplicación web** (termina en `/exec`).
 
### ¡Listo!
Pega esa URL en la pantalla de la aplicación y ya podrás enviar tus certificados directamente desde tu cuenta de Gmail.

