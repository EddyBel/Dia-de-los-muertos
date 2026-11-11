<h1 align="center">Memoria Viva</h1>

<p align="center">Una ofrenda digital para recordar a quienes siguen viviendo en nuestra memoria</p>

<p align="center">
  <img alt="Último commit" src="https://img.shields.io/github/last-commit/EddyBel/Dia-de-los-muertos?color=%23F9D65C&style=for-the-badge" />
  <img alt="Licencia" src="https://img.shields.io/github/license/EddyBel/Dia-de-los-muertos?color=%23EAECEE&style=for-the-badge" />
  <img alt="Lenguaje principal" src="https://img.shields.io/github/languages/top/EddyBel/Dia-de-los-muertos?color=%23F1948A&style=for-the-badge" />
  <img alt="GitHub Pages" src="https://img.shields.io/badge/GitHub%20Pages-publicado-ABEBC6?style=for-the-badge&logo=github" />
</p>

**Memoria Viva** es una experiencia web interactiva inspirada en el Día de Muertos. Cada persona puede crear una ofrenda personalizada con fotografías y una dedicatoria, recorrerla en 3D y guardar una sesión de imágenes con distintos ángulos.

La página está diseñada para funcionar como sitio estático en GitHub Pages. Three.js dibuja la escena en el navegador y Google Apps Script se encarga de registrar las participaciones, consultar el número de personas y enviar las capturas por correo.

## Propósito

La idea del proyecto es llevar una tradición de memoria y homenaje a un espacio digital compartido.

La escena reúne el altar, fotografías, flores de cempasúchil y una dedicatoria. Cada participación queda registrada y suma flores a la escena principal del Hero.

## Funciones

### Ofrenda 3D

- [x] **Escena interactiva** — El Hero muestra el altar 3D y permite explorarlo con el mouse o con gestos táctiles.
- [x] **Modelos alternativos** — Incluye una versión texturizada optimizada para la escena y un modelo detallado disponible para desarrollo.
- [x] **Escena para móviles** — Ajusta recursos gráficos y modelos de flores para reducir el costo de renderizado en teléfonos.
- [x] **Flores según participaciones** — El Hero empieza sin flores y actualiza su cantidad al recibir el conteo de Google Sheets.
- [x] **Lluvia de pétalos** — Añade partículas ligeras a la escena.
- [x] **Música ambiental local** — Reproduce aleatoriamente los MP3 de `public/musica`, muestra el nombre del archivo y permite silenciarla.
- [x] **Pantalla completa** — Permite ampliar la escena para verla con más detalle.

### Crear y compartir un homenaje

- [x] **Formulario por pasos** — Solicita nombre, correo, dedicatoria opcional y hasta tres fotografías.
- [x] **Marcos completos** — Si se suben dos fotos, la primera se repite en el tercer marco; si se sube una, ocupa el marco central.
- [x] **Imágenes optimizadas en el dispositivo** — Prepara las fotos en el navegador antes de incorporarlas al altar.
- [x] **Dedicatoria en la escena** — Muestra las palabras elegidas junto al modelo 3D.
- [x] **Sesión de cinco capturas** — Genera vistas frontal, tres cuartos derecha, tres cuartos izquierda, picada y contrapicada.
- [x] **Galería y descarga** — Permite ampliar y descargar cada imagen, o bajar la sesión completa como ZIP.
- [x] **Envío por correo** — Apps Script envía las capturas a la dirección indicada y registra el resultado.

### Herramientas de desarrollo

Abre la página con `?dev=1` para mostrar el panel de herramientas. Incluye información técnica de los modelos, controles de escena y calibración de las fotografías en los marcos.

## Estructura del proyecto

```text
.
├── index.html                    # Vistas y estructura de la página
├── src/
│   ├── main.js                   # Arranque y coordinación de la aplicación
│   ├── config.js                 # Apps Script y configuración de audio
│   ├── components/               # Formulario, escena, controles y navegación
│   ├── services/                 # Envíos, conteo, letras e imágenes
│   └── styles/main.css           # Estilos y comportamiento responsive
├── public/
│   ├── backgrounds/              # Fondos del sitio y de la escena
│   ├── hero/                     # Recursos visuales del Hero
│   ├── images/                   # Loader y recursos de interfaz
│   ├── musica/                   # MP3 ambientales y manifiesto de pistas
│   ├── models/                   # Modelos 3D y variantes de flores
│   └── textures/                 # Texturas del piso y del altar
├── google-apps-script/
│   ├── Code.gs                   # API web, registro, correo y consulta LRCLIB
│   ├── appsscript.json           # Permisos y configuración de Apps Script
│   └── README.md                 # Instalación y autorización del backend
├── scripts/                      # Generación offline de recursos 3D
├── docs/                         # Notas y planes técnicos
└── .github/workflows/            # Publicación automática en GitHub Pages
```

## Requisitos

- Un navegador moderno con soporte WebGL para ver la escena 3D.
- Python 3 para servir localmente los archivos estáticos, o cualquier servidor HTTP equivalente.
- Un proyecto de Google Apps Script conectado a la hoja de cálculo para guardar registros y enviar correos.

No se necesita Node.js, `npm install` ni un paso de compilación para ejecutar o publicar el sitio. Three.js y Anime.js se cargan desde CDN mediante el import map de `index.html`.

## Ejecutar localmente

Genera la lista de canciones y después inicia un servidor estático:

```bash
python3 scripts/build-music-manifest.py
python3 -m http.server 8000
```

Abre [http://localhost:8000](http://localhost:8000). Conviene usar un servidor HTTP en lugar de abrir `index.html` directamente, ya que el sitio utiliza módulos JavaScript.

La escena y el formulario pueden abrirse localmente, pero el registro, el conteo, el envío de correo y la consulta de letras dependen de la implementación activa de Apps Script configurada en `src/config.js`.

## Configuración

### Apps Script

`src/config.js` contiene la URL pública de la aplicación web de Apps Script y la ruta del manifiesto de música. El endpoint se usa para registrar formularios, consultar el número de participaciones y almacenar letras de canciones.

Para conectar o actualizar el backend:

1. Copia `google-apps-script/Code.gs` y `google-apps-script/appsscript.json` al proyecto de Apps Script.
2. Ejecuta `authorizeMailApp` y `authorizeLyricsLookup` desde el editor y acepta los permisos solicitados.
3. Publica una **nueva versión** de la aplicación web, ejecutándose como su propietario y permitiendo el acceso necesario a los visitantes.
4. Comprueba que `src/config.js` apunte a la URL `/exec` de esa implementación.

La guía del backend está en [google-apps-script/README.md](./google-apps-script/README.md).

### Música

Agrega archivos `.mp3` a `public/musica/`. El manifiesto se genera automáticamente durante el despliegue; al probar localmente, vuelve a ejecutar `python3 scripts/build-music-manifest.py` después de agregar canciones. El nombre del archivo, sin la extensión, es el título que aparece en el reproductor. La selección se hace aleatoriamente y evita repetir la canción anterior cuando hay más de una.

El volumen y la reproducción automática están definidos en `ambientMusicConfig`, en [src/config.js](./src/config.js). En móviles el reproductor espera a que termine de cargar el altar. El navegador puede bloquear el autoplay; si ocurre, inicia la música desde su control.

## Publicar en GitHub Pages

El workflow [deploy-pages.yml](./.github/workflows/deploy-pages.yml) publica el sitio cuando hay cambios en la rama `main`, o cuando se ejecuta manualmente desde GitHub Actions. En cada despliegue genera el manifiesto con todos los MP3 que encuentre en `public/musica/`.

Para habilitarlo:

1. En el repositorio, abre **Settings → Pages**.
2. Selecciona **GitHub Actions** como origen de publicación.
3. Envía los cambios a `main` o ejecuta el workflow **Publish website to GitHub Pages**.

El workflow prepara el sitio, copia los recursos usados y genera el manifiesto de audio antes de publicarlo.

## Datos y servicios

- **Google Sheets / Apps Script** — Guarda los registros y su estado, devuelve solo el conteo público de participaciones y envía la sesión de fotos mediante `MailApp`.
- **Metadatos y eventos** — `RESPUESTAS` conserva la dedicatoria y los metadatos técnicos de la sesión; `EVENTOS` registra visitas, pasos del wizard, cambios en las fotos, resultado del envío, abandonos y duración aproximada.
- **Música local** — Los MP3 se sirven desde `public/musica/`; el reproductor no carga el iframe ni la API de YouTube.
- **LRCLIB** — Cuando empieza una canción, Apps Script busca primero en la pestaña `CANCIONES`; si no encuentra una consulta previa válida, solicita las letras a LRCLIB y guarda tanto las marcas de tiempo como el texto plano. Los nombres con formato `Artista - Canción` permiten buscar el artista; las letras no se muestran en la web.

Las fotografías originales se procesan en el navegador; las capturas generadas se envían al backend para el correo y permanecen disponibles en la sesión para su descarga. Los eventos técnicos se mantienen en memoria hasta que la persona acepta el consentimiento antes de subir fotos; si no acepta, no se envían a la hoja. El sitio no incluye una base de datos propia ni almacenamiento permanente de las fotografías.

## Créditos y licencias

El código del proyecto está bajo licencia [MIT](./LICENSE).

El modelo “Altar de Día de Muertos | Ofrenda Mexicana Decorativa” es de TNTNetta y se adapta bajo licencia [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/), según el crédito mostrado en la página. Los modelos, imágenes y recursos externos pueden tener licencias distintas a la del código.

## Contribuir

Las sugerencias, reportes de errores y contribuciones son bienvenidos. Para reportar un problema, incluye el navegador y dispositivo utilizados, los pasos para reproducirlo y, si aplica, la información relevante de la consola o de la hoja `RESPUESTAS`.

---

<p align="center">
  <a href="https://github.com/EddyBel" target="_blank" rel="noreferrer">
    <img alt="GitHub" src="https://img.shields.io/badge/GitHub-%2312100E.svg?style=for-the-badge&logo=github&logoColor=white" />
  </a>
  <a href="https://www.linkedin.com/in/eduardo-rangel-eddybel/" target="_blank" rel="noreferrer">
    <img alt="LinkedIn" src="https://img.shields.io/badge/LinkedIn-%230077B5.svg?style=for-the-badge&logo=linkedin&logoColor=white" />
  </a>
</p>
