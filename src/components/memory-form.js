import { closeImages, decodeImage, validatePhotoFiles } from '../services/image-service.js';
import { isSubmissionServiceConfigured, submitOfrenda } from '../services/submission-service.js';
import { downloadPhotoSession } from '../services/photo-session-download.js';

export function setupMemoryForm({ altar }) {
  const form = document.querySelector('#memoryForm');
  const submitButton = document.querySelector('#submitBtn');
  const status = document.querySelector('#status');
  const fileInput = document.querySelector('#photos');
  const preview = document.querySelector('#preview');
  const photoCount = document.querySelector('#photoCount');
  const downloadButton = document.querySelector('#downloadPhotoSession');
  const photoSessionStatus = document.querySelector('#photoSessionStatus');
  let loadedImages = [];
  let objectUrls = [];
  let imageGeneration = 0;
  let photoSession = null;

  downloadButton.addEventListener('click', async () => {
    if (!photoSession) return;
    downloadButton.disabled = true;
    downloadButton.textContent = 'Preparando ZIP…';
    try {
      await downloadPhotoSession(photoSession);
      photoSessionStatus.textContent = 'La descarga de la sesión comenzó.';
    } catch (error) {
      console.error('No se pudo descargar la sesión de fotos:', error);
      photoSessionStatus.textContent = 'No se pudo preparar la descarga. Intenta nuevamente.';
    } finally {
      downloadButton.disabled = false;
      downloadButton.textContent = 'Descargar sesión de fotos';
    }
  });

  function clearPreview() {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    objectUrls = [];
    preview.replaceChildren();
  }

  function resetPhotos() {
    imageGeneration++;
    clearPreview();
    closeImages(loadedImages);
    loadedImages = [];
    fileInput.value = '';
    photoCount.textContent = '0 / 5';
    altar.setImages();
  }

  fileInput.addEventListener('change', async () => {
    photoSession = null;
    downloadButton.hidden = true;
    photoSessionStatus.hidden = true;
    photoSessionStatus.textContent = '';
    const generation = ++imageGeneration;
    const files = Array.from(fileInput.files || []);
    const validationMessage = validatePhotoFiles(files);
    if (validationMessage) {
      status.textContent = validationMessage;
      fileInput.value = '';
      return;
    }

    clearPreview();
    closeImages(loadedImages);
    loadedImages = [];
    status.textContent = 'Procesando fotografías…';

    files.forEach(file => {
      const url = URL.createObjectURL(file);
      objectUrls.push(url);
      const card = document.createElement('div');
      card.className = 'overflow-hidden rounded-xl border border-amber-100/10 bg-[#2a1b2b]';
      const image = document.createElement('img');
      image.src = url;
      image.alt = 'Fotografía seleccionada';
      image.className = 'h-28 w-full object-cover';
      const name = document.createElement('p');
      name.className = 'truncate px-2 py-2 text-xs text-rose-100/70';
      name.textContent = file.name;
      card.append(image, name);
      preview.append(card);
    });
    photoCount.textContent = `${files.length} / 5`;

    try {
      const images = await Promise.all(files.map(decodeImage));
      if (generation !== imageGeneration) {
        closeImages(images);
        return;
      }
      loadedImages = images;
      altar.setImages(loadedImages);
      status.textContent = 'Fotografías cargadas correctamente.';
    } catch (error) {
      console.error('Error procesando imágenes:', error);
      if (generation === imageGeneration) {
        status.textContent = 'No fue posible procesar alguna fotografía.';
        resetPhotos();
      }
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const name = document.querySelector('#name').value.trim();
    const email = document.querySelector('#email').value.trim();
    const consent = document.querySelector('#consent').checked;

    if (!name || !email || !consent) {
      status.textContent = 'Completa los datos y acepta el consentimiento.';
      return;
    }
    if (!isSubmissionServiceConfigured()) {
      status.textContent = 'Configura primero el servicio de envío.';
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Preparando sesión…';
    photoSession = null;
    downloadButton.hidden = true;

    try {
      let deliveryStatus = 'ERROR_CAPTURA';
      let deliveryMessage = '';
      photoSessionStatus.hidden = false;
      photoSessionStatus.textContent = 'Generando cinco vistas en alta calidad…';

      try {
        photoSession = await altar.capturePhotoSession();
        downloadButton.hidden = false;
        deliveryStatus = 'PENDIENTE';
        photoSessionStatus.textContent = 'Capturas listas. Enviando las cinco vistas al correo…';
      } catch (captureError) {
        console.error('No se pudo generar la sesión de fotos:', captureError);
        deliveryStatus = 'ERROR_CAPTURA';
        deliveryMessage = captureError.message || 'No se pudieron generar las capturas.';
        photoSessionStatus.textContent = 'No se pudieron generar las capturas; guardaré este resultado en el registro.';
      }

      status.textContent = 'Enviando las capturas y guardando el resultado…';
      await submitOfrenda({
        name,
        email,
        status: deliveryStatus,
        message: deliveryMessage,
        captures: photoSession || []
      });
      if (photoSession) {
        photoSessionStatus.textContent = `Solicitud enviada al servidor de correo para ${email}. Las capturas también están disponibles para descargar.`;
      } else {
        photoSessionStatus.textContent = 'Se registró el error al generar las capturas.';
      }

      // Conserva las fotos en Three.js para que la persona siga viendo
      // la ofrenda después de registrar sus datos.
      document.querySelector('#name').value = '';
      document.querySelector('#email').value = '';
      document.querySelector('#consent').checked = false;
      submitButton.textContent = 'Solicitud enviada ✓';
      document.querySelector('#altarExperience')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    } catch (error) {
      console.error('Error completando el registro:', error);
      status.textContent = 'No se pudo enviar la solicitud al servidor. Revisa tu conexión antes de volver a intentarlo.';
      photoSessionStatus.hidden = false;
      if (photoSession) {
        downloadButton.hidden = false;
        photoSessionStatus.textContent += ' Las capturas siguen disponibles para descargar.';
      }
      submitButton.textContent = 'Registrar mi participación';
    } finally {
      submitButton.disabled = false;
    }
  });
}
