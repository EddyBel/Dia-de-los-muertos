# Envío de correo y registro con Apps Script

La página de GitHub Pages envía las cinco capturas al Apps Script. El Apps
Script usa `MailApp` para enviar el correo desde la cuenta Google propietaria
del script y guarda el resultado en `Hoja 1`. No requiere dominio propio, API
key de Resend ni EmailJS.

## Activar MailApp

1. En el proyecto de Apps Script, reemplaza el contenido de `Code.gs` con este
   archivo.
2. En el editor, selecciona `authorizeMailApp` y pulsa **Ejecutar**. Acepta el
   permiso para enviar correo desde la cuenta propietaria.
3. Confirma que la pestaña se llame exactamente `Hoja 1`.
   El registro añadirá la columna `Dedicatoria` después de `Message` si la
   fila de encabezados ya existía.
4. Abre **Implementar → Administrar implementaciones**, edita la aplicación
   web, selecciona **Nueva versión** y pulsa **Implementar**. Mantén la
   configuración para ejecutar como tú y permitir acceso a quienes usan la
   página.
5. Publica también la actualización de la página en GitHub Pages.

Los mensajes saldrán desde la cuenta Google que ejecuta la implementación. El
nombre visible será “Memoria Viva”; la cuenta Gmail real seguirá siendo el
remitente. `MailApp` permite hasta 100 destinatarios al día en cuentas personales
y los adjuntos tienen un límite total de 25 MB por mensaje. Este script aplica
un margen preventivo de 20 MB y limita a un envío por dirección cada 60
segundos. Las cuotas pueden variar; el registro de la hoja guarda los errores.

El correo muestra las cinco imágenes inline junto con la dedicatoria. El HTML se construye en `Code.gs`;
`template-email.html` se conserva como referencia visual.
