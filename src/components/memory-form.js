import { closeImages, decodeImage, validatePhotoFiles } from '../services/image-service.js';
import { isSubmissionServiceConfigured, submitOfrenda } from '../services/submission-service.js';
import { downloadPhotoSession } from '../services/photo-session-download.js';

export function setupMemoryForm({ loadAltar, mountGenerationScene }) {
  const form = document.querySelector('#memoryForm');
  const submitButton = document.querySelector('#submitBtn');
  const status = document.querySelector('#status');
  const fileInput = document.querySelector('#photos');
  const preview = document.querySelector('#preview');
  const photoCount = document.querySelector('#photoCount');
  const photoSessionStatus = document.querySelector('#photoSessionStatus');
  const downloadButton = document.querySelector('#downloadPhotoSession');
  const generationStage = document.querySelector('#generationStage');
  const generationLoader = document.querySelector('#generationLoader');
  const generationMessage = document.querySelector('#generationMessage');
  const generationPercent = document.querySelector('#generationPercent');
  const generationProgress = document.querySelector('#generationProgress');
  const generationProgressFill = document.querySelector('#generationProgressFill');
  const generationClose = document.querySelector('#generationClose');
  const captureLightbox = document.querySelector('#captureLightbox');
  const captureLightboxImage = document.querySelector('#captureLightboxImage');
  const captureLightboxDownload = document.querySelector('#captureLightboxDownload');
  const captureCards = new Map([...document.querySelectorAll('[data-capture-card]')]
    .map(card => [card.dataset.captureCard, card]));
  const wizardSteps = [...document.querySelectorAll('[data-wizard-step]')];
  const wizardStepLabel = document.querySelector('#wizardStepLabel');
  const wizardProgressFill = document.querySelector('#wizardProgressFill');
  const dedicationInput = document.querySelector('#dedication');
  const dedicationCount = document.querySelector('#dedicationCount');
  let loadedImages = [];
  let objectUrls = [];
  let imageGeneration = 0;
  let photoSession = null;
  let altar = null;
  let step = 1;
  const captureCardUrls = new Map();

  function resetCaptureCards() {
    captureCardUrls.forEach(url => URL.revokeObjectURL(url));
    captureCardUrls.clear();
    captureCards.forEach(card => {
      card.classList.remove('is-current');
      const pending = card.querySelector('.capture-card__pending');
      pending.hidden = false;
      pending.querySelector('span').textContent = 'En espera';
      const image = card.querySelector('.capture-card__image');
      image.hidden = true;
      image.removeAttribute('src');
      image.tabIndex = -1;
      const downloadButton = card.querySelector('.capture-card__download');
      downloadButton.hidden = true;
      delete card.dataset.filename;
    });
  }

  function openCaptureLightbox(card) {
    const url = captureCardUrls.get(card.dataset.captureCard);
    if (!url) return;
    const image = card.querySelector('.capture-card__image');
    captureLightboxImage.src = url;
    captureLightboxImage.alt = image.alt;
    captureLightboxDownload.href = url;
    captureLightboxDownload.download = card.dataset.filename || 'ofrenda.jpg';
    document.documentElement.classList.add('is-lightbox-open');
    document.body.classList.add('is-lightbox-open');
    if (captureLightbox.showModal) captureLightbox.showModal();
    else captureLightbox.setAttribute('open', '');
  }

  captureCards.forEach(card => {
    const image = card.querySelector('.capture-card__image');
    const downloadButton = card.querySelector('.capture-card__download');
    image.addEventListener('click', () => openCaptureLightbox(card));
    image.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openCaptureLightbox(card);
      }
    });
    downloadButton.addEventListener('click', () => {
      const url = captureCardUrls.get(card.dataset.captureCard);
      if (!url) return;
      const link = document.createElement('a');
      link.href = url;
      link.download = card.dataset.filename || 'ofrenda.jpg';
      document.body.append(link);
      link.click();
      link.remove();
    });
  });

  document.querySelector('#captureLightboxClose').addEventListener('click', () => captureLightbox.close());
  captureLightbox.addEventListener('click', event => {
    if (event.target === captureLightbox) captureLightbox.close();
  });
  captureLightbox.addEventListener('close', () => {
    document.documentElement.classList.remove('is-lightbox-open');
    document.body.classList.remove('is-lightbox-open');
    captureLightboxImage.removeAttribute('src');
    captureLightboxDownload.removeAttribute('href');
  });

  async function updateCaptureCard(event) {
    const card = captureCards.get(event.view.id);
    if (!card) return;
    if (event.phase === 'start') {
      card.classList.add('is-current');
      card.querySelector('.capture-card__pending span').textContent = 'Generando vista…';
      return;
    }
    if (event.phase !== 'complete' || !event.capture?.blob) return;

    const image = card.querySelector('.capture-card__image');
    const url = URL.createObjectURL(event.capture.blob);
    captureCardUrls.set(event.view.id, url);
    card.dataset.filename = event.capture.filename;
    image.src = url;
    image.hidden = false;
    try {
      await image.decode();
      card.querySelector('.capture-card__pending').hidden = true;
      card.querySelector('.capture-card__download').hidden = false;
      image.tabIndex = 0;
      card.classList.remove('is-current');
    } catch (error) {
      console.error(`No se pudo mostrar la captura ${event.view.id}:`, error);
      image.hidden = true;
      card.querySelector('.capture-card__pending span').textContent = 'Vista no disponible';
      card.classList.remove('is-current');
    }
  }

  function showStep(nextStep) {
    step = nextStep;
    wizardSteps.forEach(section => { section.hidden = Number(section.dataset.wizardStep) !== step; });
    wizardStepLabel.textContent = step === 1 ? 'Paso 1 de 2 · Tus datos' : 'Paso 2 de 2 · Fotografías';
    wizardProgressFill.style.width = step === 1 ? '50%' : '100%';
    status.textContent = '';
    if (step === 2) document.querySelector('#wizardBack').focus({ preventScroll: true });
    else document.querySelector('#wizardNext').focus({ preventScroll: true });
  }

  function setGenerationProgress(value, message) {
    const progress = Math.max(0, Math.min(100, Math.round(value)));
    generationProgress.setAttribute('aria-valuenow', String(progress));
    generationProgressFill.style.width = `${progress}%`;
    generationPercent.textContent = `${progress}%`;
    if (message) generationMessage.textContent = message;
  }

  document.querySelector('#wizardNext').addEventListener('click', () => {
    const firstStep = wizardSteps[0];
    const fields = [...firstStep.querySelectorAll('input,textarea')];
    const invalid = fields.find(field => !field.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return;
    }
    showStep(2);
  });
  document.querySelector('#wizardBack').addEventListener('click', () => showStep(1));
  dedicationInput.addEventListener('input', () => {
    dedicationCount.textContent = String(dedicationInput.value.length);
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
    altar?.setImages();
  }

  fileInput.addEventListener('change', async () => {
    photoSession = null;
    resetCaptureCards();
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
    status.textContent = 'Optimizando y preparando fotografías en este dispositivo…';

    files.forEach(file => {
      const url = URL.createObjectURL(file);
      objectUrls.push(url);
      const card = document.createElement('div');
      card.className = 'photo-preview-card';
      const image = document.createElement('img');
      image.src = url;
      image.alt = 'Fotografía seleccionada';
      image.loading = 'lazy';
      const name = document.createElement('p');
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
      altar?.setImages(loadedImages);
      status.textContent = 'Fotografías listas para la ofrenda.';
    } catch (error) {
      console.error('Error procesando imágenes:', error);
      if (generation === imageGeneration) {
        status.textContent = 'No fue posible procesar alguna fotografía.';
        resetPhotos();
      }
    }
  });

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

  generationClose.addEventListener('click', () => {
    generationStage.hidden = true;
    generationStage.classList.remove('is-complete');
    document.body.classList.remove('is-generating');
    document.body.classList.remove('is-results-view');
    document.querySelector('#backToHome')?.click();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (step !== 2) return;

    const name = document.querySelector('#name').value.trim();
    const email = document.querySelector('#email').value.trim();
    const dedication = dedicationInput.value.trim();
    const consent = document.querySelector('#consent').checked;
    if (!name || !email || !consent) {
      status.textContent = 'Revisa tu nombre, correo y acepta el consentimiento para continuar.';
      return;
    }
    if (loadedImages.length < 1) {
      status.textContent = 'Selecciona al menos una fotografía para el altar.';
      fileInput.focus();
      return;
    }
    if (!isSubmissionServiceConfigured()) {
      status.textContent = 'Configura primero el servicio de envío.';
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Generando…';
    photoSession = null;
    generationStage.classList.remove('is-complete');
    document.body.classList.remove('is-results-view');
    resetCaptureCards();
    downloadButton.hidden = true;
    photoSessionStatus.hidden = true;
    generationClose.hidden = true;
    generationLoader.hidden = false;
    mountGenerationScene?.();
    generationStage.hidden = false;
    document.body.classList.add('is-generating');
    document.querySelector('#generationStage h2').textContent = 'Preparando tu ofrenda';
    setGenerationProgress(2, 'Preparando tus fotografías…');

    try {
      altar = await loadAltar();
      altar.setImages(loadedImages);
      altar.setDedication(dedication);
      setGenerationProgress(8, 'Cargando el altar 3D para esta sesión…');
      await new Promise(requestAnimationFrame);
      await altar.setModelVariant(altar.getModelVariant(), value => {
        setGenerationProgress(value, 'Descargando y preparando el modelo 3D…');
      });
      setGenerationProgress(52, 'El altar está listo. Tomando las vistas…');

      photoSession = await altar.capturePhotoSession(event => {
        updateCaptureCard(event);
        if (event.phase === 'start') {
          setGenerationProgress(52 + (event.index / event.total) * 36, `Generando vista ${event.index + 1} de ${event.total}…`);
        } else if (event.phase === 'complete') {
          setGenerationProgress(52 + event.completion * 36, `Vista ${event.index + 1} de ${event.total} lista.`);
        }
      });
      generationStage.classList.add('is-complete');
      document.body.classList.add('is-results-view');
      downloadButton.hidden = false;
      photoSessionStatus.hidden = false;
      photoSessionStatus.textContent = 'Las cinco vistas están listas; preparando el envío al correo…';
      document.querySelector('#generationStage h2').textContent = 'Tu ofrenda está lista';
      setGenerationProgress(91, 'Enviando las capturas a tu correo…');

      await submitOfrenda({
        name,
        email,
        dedication,
        status: 'PENDIENTE',
        message: '',
        captures: photoSession
      });
      setGenerationProgress(100, 'Listo. Las capturas se enviaron para entrega por correo.');
      photoSessionStatus.textContent = `Solicitud enviada al servicio de correo para ${email}. También puedes descargar el ZIP aquí.`;
      status.textContent = 'Tu ofrenda fue generada correctamente.';
    } catch (error) {
      console.error('Error generando o enviando la ofrenda:', error);
      photoSessionStatus.hidden = false;
      photoSessionStatus.textContent = photoSession
        ? 'Se generaron las capturas, pero el envío no se completó. Puedes descargar el ZIP.'
        : 'No se pudo completar la generación. Revisa tu conexión e inténtalo nuevamente.';
      if (photoSession) downloadButton.hidden = false;
      setGenerationProgress(0, 'Ocurrió un problema al generar o enviar tu ofrenda.');
      status.textContent = error.message || 'No se pudo generar la ofrenda.';
      document.querySelector('#generationStage h2').textContent = 'No se completó el envío';
    } finally {
      generationLoader.hidden = true;
      generationClose.hidden = false;
      generationClose.textContent = 'Volver al inicio';
      submitButton.disabled = false;
      submitButton.textContent = 'Empezar generación ✨';
    }
  });
}
