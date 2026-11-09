# Plan de optimización de la escena 3D en Android

## Objetivo

Mantener la apariencia cálida de la ofrenda y la posibilidad de generar las cinco capturas, reduciendo el uso de GPU, memoria, batería y datos móviles durante la escena interactiva.

## Diagnóstico del código y los recursos actuales

- La escena se crea bajo demanda y el hero ya es una imagen WebP de aproximadamente **131 KiB**. Los modelos no se descargan al abrir la página.
- El modelo predeterminado es OBJ: aproximadamente **2.52 MB** y **20,000 triángulos**. La variante detallada es STL binario: **104.7 MB** y **2,093,892 triángulos**; permanece detrás de las herramientas de desarrollo.
- El OBJ carga tres mapas de **2048 × 2048**: diffuse RGB (4.32 MB), normal RGB (2.53 MB) y roughness en escala de grises (1.90 MB). Aunque comprimidos ocupan cerca de 8.7 MB, las texturas decodificadas pueden usar del orden de **48 MiB** en GPU más mipmaps, según el dispositivo y el formato interno.
- El renderer permite hasta DPR 2, usa antialiasing, sombras PCF suaves y `preserveDrawingBuffer`. En un teléfono con DPR alto, DPR 2 puede multiplicar por cuatro los píxeles renderizados frente a DPR 1.
- El bucle `requestAnimationFrame` renderiza continuamente, actualiza cuatro luces de vela en cada frame y rota automáticamente el escenario, incluso cuando la persona no lo está manipulando.
- Cada captura usa un canvas de **1600 × 1600** y JPEG de calidad `.94`. Las cinco imágenes se conservan para la descarga y después se convierten a data URLs para enviar el JSON; esto puede elevar el pico de memoria en teléfonos con poca RAM.

## Orden recomendado

### 1. Medir antes de cambiar la apariencia

Crear una referencia en Chrome Android con al menos un teléfono de gama media y uno de gama baja. Medir:

- FPS y tiempo de frame al abrir la escena, al rotarla y cuando queda quieta.
- Tiempo y datos descargados desde “Empezar generación” hasta que aparece el modelo.
- Memoria/GPU durante la escena y pico de memoria al generar cinco capturas.
- Tiempo total de las cinco capturas y tamaño combinado de los JPEG.
- Temperatura o caída sostenida de FPS en una sesión de 1–2 minutos.

Usar Chrome DevTools Remote Debugging y `renderer.info` para registrar triángulos y llamadas de dibujo. Anotar teléfono, versión de Android/Chrome y tamaño del viewport para comparar iteraciones.

### 2. Añadir un perfil de renderizado móvil (primer cambio)

En `src/components/altar-scene.js`, elegir calidad al crear el renderer y al redimensionar:

- En móviles, limitar DPR a **1** inicialmente; permitir como máximo **1.25** en dispositivos que mantengan el presupuesto de frame. Conservar hasta DPR 2 en escritorio.
- Desactivar antialiasing por hardware en el perfil móvil; compensar con la resolución del canvas y evaluar el resultado visual.
- Mantener el render de la captura a resolución fija independiente del DPR del viewport.
- Usar `matchMedia` para el perfil móvil y, cuando exista, `navigator.deviceMemory` como señal adicional. Si la señal no está disponible, usar el perfil móvil conservador.

**Meta:** reducir el coste de render del canvas interactivo sin cambiar el tamaño de las capturas.

### 3. Reducir el trabajo por frame

- Detener el bucle cuando `document.hidden` o la escena no esté visible (`IntersectionObserver`); reanudarlo al volver.
- Evitar recalcular y renderizar a 60 FPS cuando no hay interacción. Mantener la rotación automática solicitada, pero limitarla a **24–30 FPS** en móvil; pausar la rotación y el render continuo mientras la persona lee o completa el formulario.
- Cambiar el parpadeo de las cuatro luces por una iluminación cálida casi estática en móvil; actualizar una sola luz lentamente si se conserva el efecto de vela.
- Renderizar inmediatamente después de cambios de cámara, fotos, modelo o tamaño, y usar el bucle limitado solo mientras haya animación.

**Meta:** que una escena quieta no consuma GPU de forma constante y que la rotación siga siendo fluida.

### 4. Simplificar sombras e iluminación en móviles

- Probar primero el perfil móvil sin `shadowMap` dinámico y sin `keyLight.castShadow`.
- Mantener la sombra de contacto como textura/plano suave y el oscurecimiento radial del piso, que son más baratos que volver a calcular sombras cada frame.
- Reducir los cuatro `PointLight` animados a una o dos luces cálidas estáticas más la luz ambiental. Mantener la configuración completa en escritorio.
- Revisar el resultado en tres cuartos y contrapicado para asegurar que los escalones sigan separados visualmente.

**Meta:** reducir fragmentos y pasadas de sombra sin perder el volumen del altar.

### 5. Crear texturas ligeras para móviles

- Conservar los mapas actuales para escritorio y crear una variante móvil de **1024 × 1024**. Solo la reducción de resolución puede bajar cerca de cuatro veces la memoria de cada mapa.
- Comprimir diffuse y roughness como WebP; probar el mapa normal con compresión sin pérdida o empaquetar los mapas en **KTX2/Basis** para aprovechar compresión de GPU cuando sea compatible.
- Seleccionar la variante según el perfil antes de iniciar la carga; no descargar los mapas grandes en Android si se eligió la variante ligera.
- Comparar color, detalle de flores, papel picado y marcos en los cinco ángulos. Mantener fallback PNG si falla el decoder/formato.

**Meta:** apuntar a menos de **20 MiB de memoria GPU para los mapas** del perfil móvil y reducir los bytes de transferencia del OBJ texturizado.

### 6. Mantener la malla detallada fuera del flujo normal

- Dejar el STL de 104.7 MB exclusivamente para desarrollo; no ofrecerlo al usuario final desde móvil.
- Si se necesita el detalle STL en producción, crear un modelo móvil optimizado (menos polígonos) y una versión de escritorio de mayor calidad, exportados como GLB/GLTF.
- Para el OBJ predeterminado, convertir a GLB con geometría indexada y materiales/mapas incluidos. La malla actual tiene 20,000 triángulos, así que esta conversión ayuda sobre todo al parseo, inicio y solicitudes de archivos, no tanto al coste por frame.
- Confirmar que el mapeo de los marcos y las coordenadas de las fotos se conserva tras la conversión.

### 7. Reducir el pico de memoria al generar fotos

- Probar **1280 × 1280** en móviles y conservar 1600 × 1600 en escritorio; medir legibilidad y detalle antes de fijarlo.
- Evaluar JPEG entre `.86` y `.90` en móvil frente al `.94` actual. Mantener el límite de adjuntos de Apps Script y medir el tamaño total real de las cinco imágenes.
- Liberar cada canvas temporal, texturas temporales y referencias a blobs/data URLs tan pronto como ya no se necesiten. Conservar solo las capturas necesarias para el ZIP y el envío.
- Reducir copias de memoria al codificar las imágenes para Apps Script; si los data URLs siguen elevando el pico, planear un transporte de archivos que no requiera base64 en un único JSON.
- Si el teléfono se queda sin memoria, permitir generar y descargar las capturas de forma secuencial por vista como fallback.

## Criterios de aceptación

- En un Android de gama media, mantener al menos **30 FPS durante la rotación** y detener el render continuo cuando la escena esté quieta o fuera de pantalla.
- El perfil móvil no descarga el STL detallado ni los mapas de resolución de escritorio.
- La escena se siente claramente más fluida y no se degrada de forma sostenida tras 1–2 minutos.
- Las cinco fotos mantienen el encuadre, las coordenadas de marcos y la dedicatoria; el ZIP y el envío por correo siguen funcionando.
- El peso combinado de los adjuntos se mantiene por debajo del límite preventivo de **20 MB** de Apps Script.
- El perfil de escritorio conserva iluminación, resolución y calidad actuales.

## Secuencia de implementación sugerida

1. Registrar la referencia de rendimiento.
2. Aplicar DPR 1 + antialiasing apagado + pausa/throttle del bucle en móvil.
3. Desactivar sombras dinámicas y reducir luces en móvil.
4. Generar mapas de 1024 y evaluar formatos comprimidos.
5. Ajustar resolución/calidad de capturas y observar memoria pico.
6. Convertir la malla predeterminada a GLB y validar marcos/fotos.
7. Repetir las mediciones y comparar antes/después; revertir cualquier cambio que afecte claramente la fidelidad visual.

## Perfil móvil aplicado

La escena ahora selecciona el perfil móvil si el viewport mide hasta 768 px o el dispositivo reporta puntero táctil grueso. Ese perfil aplica DPR 1, desactiva antialiasing y sombras dinámicas, usa una luz cálida estable, limita el render a 24 FPS, pausa fuera de pantalla o cuando la pestaña está oculta y evita el bump map duplicado del piso.

El primer perfil móvil de GLB y mapas de 1024 px redujo el peso, pero la textura se veía degradada en algunos teléfonos. Se cambió a la malla OBJ original para conservar exactamente el UV atlas y a mapas WebP de 2048 px (diffuse calidad 96; normal y roughness sin pérdida), con un peso conjunto cercano a **6.2 MiB**. El escritorio conserva OBJ y PNG. Las capturas móviles usan 1280 px y calidad JPEG `.88`, o 1024 px y `.84` cuando el dispositivo reporta 4 GB de memoria o menos, o cuatro núcleos o menos. También se usa un fondo móvil con el desenfoque aplicado previamente.

La variante STL detallada sigue disponible únicamente en las herramientas de desarrollo. El bucle interactivo conserva la rotación automática móvil a 24 FPS y deja de programar frames cuando la escena no está visible. En móvil la ofrenda se escala a 72%, con cámara y encuadre ajustados; se añade niebla negra suave en Three.js y oscurecimiento en el fondo CSS para crear una sensación de escala reducida y ocultar los límites del escenario. Escritorio no recibe estos cambios de escala ni niebla.

**Pendiente de validar en dispositivos físicos:** medir FPS sostenidos, memoria máxima durante las cinco capturas, temperatura y calidad percibida de las fotos. Los objetivos de aceptación anteriores siguen aplicando; la reducción de recursos no sustituye una medición en Android real.
