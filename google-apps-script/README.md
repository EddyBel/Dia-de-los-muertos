# Envío de correo y registro con Apps Script

La página de GitHub Pages envía las cinco capturas al Apps Script. El Apps
Script usa `MailApp` para enviar el correo desde la cuenta Google propietaria
del script y guarda el resultado en `RESPUESTAS`. No requiere dominio propio, API
key de Resend ni EmailJS.

El Hero consulta `?action=count` para obtener el número de registros. El Apps
Script devuelve únicamente el total mediante JSONP; no expone nombres ni
correos. El conteo se refresca al volver al Hero y cada minuto mientras está
visible. La escena de generación y las capturas mantienen 100 flores. El Hero
usa una flor por registro, con un máximo visible de 200 según el modelo
precargado.

Cuando empieza a reproducirse un MP3 de `public/musica`, la página envía el
nombre del archivo al Apps Script como título de la canción. Este busca primero
en la pestaña `CANCIONES`; si no hay
un resultado previo, consulta LRCLIB y guarda el resultado. Las letras nunca se
devuelven al navegador ni se muestran en la web. Los hallazgos se guardan en
`E` como `syncedLyrics` LRC y en `G` como `plainLyrics`; `F` registra el estado.
Los estados sin letra o con error evitan otra llamada a LRCLIB por 24 horas.
El Apps Script crea `CANCIONES` y sus encabezados automáticamente. Si el nombre
del archivo viene como `Artista - Canción`, separa ambas partes para buscar el
intérprete; la columna `H` oculta guarda la clave para reutilizar el resultado.
Los fallos de conexión incluyen su detalle
en `Status` para facilitar el diagnóstico.

Si el conteo no actualiza, abre la URL de implementación con
`?action=count&debug=1` para ver el error de acceso a la hoja. Sin `debug=1`,
el endpoint devuelve un mensaje genérico.

## Activar MailApp

1. En el proyecto de Apps Script, reemplaza el contenido de `Code.gs` con este
   archivo.
2. En el editor, selecciona `authorizeMailApp` y pulsa **Ejecutar**. Acepta el
   permiso para enviar correo desde la cuenta propietaria.
3. Selecciona `authorizeLyricsLookup` y pulsa **Ejecutar**. Acepta el permiso
   para consultar LRCLIB y crear la pestaña `CANCIONES`.
   Si Google no muestra el permiso externo, activa en **Configuración del
   proyecto** la opción **Mostrar el archivo de manifiesto `appsscript.json`**
   y copia el manifiesto de esta carpeta. Incluye el alcance
   `https://www.googleapis.com/auth/script.external_request` que requiere
   `UrlFetchApp.fetch`. Después vuelve a ejecutar `authorizeLyricsLookup` y
   acepta el permiso desde la cuenta propietaria del Apps Script.
4. Confirma que la pestaña de registros se llame exactamente `RESPUESTAS`.
   El registro añadirá la columna `Dedicatoria` después de `Message` si la
   fila de encabezados ya existía.
5. Abre **Implementar → Administrar implementaciones**, edita la aplicación
   web, selecciona **Nueva versión** y pulsa **Implementar**. Este paso es
   necesario para activar el conteo y el registro de letras; los cambios de
   `Code.gs` no se publican automáticamente. Mantén la configuración para ejecutar
   como tú y permitir acceso a quienes usan la página.
6. Publica también la actualización de la página en GitHub Pages.

Los mensajes saldrán desde la cuenta Google que ejecuta la implementación. El
nombre visible será “Memoria Viva”; la cuenta Gmail real seguirá siendo el
remitente. `MailApp` permite hasta 100 destinatarios al día en cuentas personales
y los adjuntos tienen un límite total de 25 MB por mensaje. Este script aplica
un margen preventivo de 20 MB y limita a un envío por dirección cada 60
segundos. Las cuotas pueden variar; el registro de la hoja guarda los errores.

El correo muestra las cinco imágenes inline junto con la dedicatoria. El HTML se construye en `Code.gs`;
`template-email.html` se conserva como referencia visual.

## Metadatos y eventos de uso

Los eventos y metadatos técnicos quedan en memoria del navegador hasta que la
persona acepta el consentimiento del primer paso; en ese momento se envía el
`page_view` con su hora original y los eventos posteriores. Si no acepta, no se
envía telemetría. Al completar una participación, el backend añade estas columnas a
`RESPUESTAS`: `Dedicatoria`, `Session ID`, duración, zona horaria, idioma,
idiomas preferidos, sistema operativo aproximado, navegador, User-Agent,
Client Hints, resolución, viewport, conexión, estado online, referencia y URL
de origen. La dedicatoria se limita a 180 caracteres; los campos técnicos se
recortan antes de guardarse.

Los eventos se guardan en una pestaña separada llamada `EVENTOS`, que se crea
automáticamente. Incluye `page_view`, `form_started`, `step_completed`,
`photo_added`, `photo_removed`, `form_abandoned`, `submission_success`,
`submission_error` y `session_duration`, con hora del servidor y del navegador,
un ID de sesión aleatorio, contadores de fotos, bytes, duración y metadatos
técnicos. No se envían las fotografías originales en estos eventos. Las URLs
conservan parámetros de campaña, pero omiten parámetros comunes de autenticación
y datos sensibles como `token`, `email`, `code` o `session`.

Para activar el registro, copia la versión actualizada de `Code.gs`, guarda el
proyecto y despliega una **nueva versión** de la aplicación web. La pestaña
`EVENTOS` se crea cuando llega el primer evento; las columnas nuevas de
`RESPUESTAS` aparecen al guardar la siguiente participación.
