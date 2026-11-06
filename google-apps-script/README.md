# Apps Script y Resend

GitHub Pages no tiene un servidor privado donde guardar la clave de Resend. El
Apps Script desplegado funciona como intermediario: recibe las cinco capturas,
las manda a Resend y escribe en `Hoja 1` el estado final (`ENVIADO` o
`ERROR_ENVIO`) y su mensaje.

## Configuración de Resend

1. En Resend, verifica un dominio de envío y crea una API key con permiso de
   envío. El remitente debe usar el dominio verificado, por ejemplo:
   `Ofrenda de recuerdos <recuerdos@tudominio.mx>`.
2. En el proyecto de Apps Script, abre **Configuración del proyecto →
   Propiedades del script** y crea estas propiedades:
   - `RESEND_API_KEY`: la API key de Resend (`re_...`).
   - `RESEND_FROM`: el remitente completo, con el dominio verificado.
3. Reemplaza el contenido del archivo `Code.gs` del proyecto de Apps Script con
   este `Code.gs`.
4. En el editor, selecciona `authorizeExternalRequests` y pulsa **Ejecutar**.
   Acepta la autorización de solicitudes externas. No compartas ni pegues la API
   key en el código ni en GitHub.
5. Confirma que la pestaña se llame exactamente `Hoja 1` y que la implementación
   esté configurada para ejecutarse como tú y permitir acceso a quienes usan la
   página.
6. Abre **Implementar → Administrar implementaciones**, edita la aplicación
   web, selecciona **Nueva versión** y pulsa **Implementar**. La web ya apunta
   a la URL `/exec` de esa implementación.

## Envíos

La página manda el nombre, el correo y las cinco imágenes JPEG como un POST
JSON de texto plano. Apps Script guarda las imágenes solo durante la ejecución,
las adjunta al correo mediante Resend y registra el resultado en la hoja. El
límite local de este endpoint es 30 MB de contenido Base64; la API de Resend
admite hasta 40 MB de adjuntos codificados por correo.

El HTML del correo se genera en `Code.gs` y muestra las cinco vistas inline; las
imágenes también quedan adjuntas. `template-email.html` se conserva como la
referencia visual original.

El endpoint es público porque lo llama la página estática. Incluye un límite
básico de un envío por correo cada 60 segundos; revisa la hoja y el panel de
Resend para monitorear resultados y uso.
