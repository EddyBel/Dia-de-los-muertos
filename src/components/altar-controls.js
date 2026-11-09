export function setupAltarControls({ altar } = {}) {
  const viewport = document.querySelector('#altarViewport');
  const fullscreenButton = document.querySelector('#altarFullscreen');
  const modelVariantControls = document.querySelector('#modelVariantControls');
  const texturedButton = document.querySelector('#texturedModelButton');
  const detailedButton = document.querySelector('#detailedModelButton');
  const photoCalibrationControls = document.querySelector('#photoCalibrationControls');
  const calibrationFrame = document.querySelector('#calibrationFrame');
  const calibrationInputs = [...document.querySelectorAll('[data-calibration]')];
  const calibrationOutput = document.querySelector('#photoCalibrationOutput');
  const calibrationStatus = document.querySelector('#photoCalibrationStatus');
  const modelDimensions = document.querySelector('#modelDimensions');
  const developerTools = document.querySelector('#developerTools');
  const developerToolsToggle = document.querySelector('#developerToolsToggle');
  const developerToolsPanel = document.querySelector('#developerToolsPanel');
  const developerToolsClose = document.querySelector('#developerToolsClose');
  const developerMode = new URLSearchParams(window.location.search).get('dev') === '1';

  if (modelVariantControls) modelVariantControls.hidden = !developerMode;
  if (photoCalibrationControls) photoCalibrationControls.hidden = !developerMode;
  if (modelDimensions) modelDimensions.hidden = !developerMode;
  if (developerTools) developerTools.hidden = !developerMode;

  function setDeveloperPanelOpen(open) {
    if (!developerToolsPanel || !developerToolsToggle) return;
    developerToolsPanel.hidden = !open;
    developerToolsToggle.setAttribute('aria-expanded', String(open));
    if (open) developerToolsClose?.focus();
    else developerToolsToggle.focus();
  }

  developerToolsToggle?.addEventListener('click', () => {
    setDeveloperPanelOpen(developerToolsPanel?.hidden ?? true);
  });
  developerToolsClose?.addEventListener('click', () => setDeveloperPanelOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && developerToolsPanel && !developerToolsPanel.hidden) {
      setDeveloperPanelOpen(false);
    }
  });

  function showModelDimensions(dimensions) {
    if (!developerMode || !modelDimensions || !dimensions) return;
    const format = value => Number(value).toFixed(2);
    modelDimensions.textContent = `Modelo · ${format(dimensions.width)} × ${format(dimensions.height)} × ${format(dimensions.depth)} u (ancho × alto × fondo)`;
  }

  if (developerMode) {
    window.addEventListener('altar:modelchange', event => showModelDimensions(event.detail?.dimensions));
    showModelDimensions(altar?.getModelDimensions?.());
  }

  if (viewport && fullscreenButton) {
    if (!viewport.requestFullscreen || !document.exitFullscreen) {
      fullscreenButton.hidden = true;
    } else {
      const label = fullscreenButton.querySelector('.altar-fullscreen-button__label');

      function updateFullscreenButton() {
        const isFullscreen = document.fullscreenElement === viewport;
        label.textContent = isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa';
        fullscreenButton.setAttribute(
          'aria-label',
          isFullscreen ? 'Salir de pantalla completa' : 'Ver la ofrenda en pantalla completa'
        );
        fullscreenButton.title = isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa';
      }

      fullscreenButton.addEventListener('click', async () => {
        try {
          if (document.fullscreenElement === viewport) {
            await document.exitFullscreen();
          } else {
            await viewport.requestFullscreen();
          }
        } catch (error) {
          console.error('No fue posible abrir la ofrenda en pantalla completa:', error);
        }
      });

      document.addEventListener('fullscreenchange', updateFullscreenButton);
      updateFullscreenButton();
    }
  }

  if (developerMode && altar && texturedButton && detailedButton) {
    const buttons = new Map([
      ['textured', texturedButton],
      ['detailed', detailedButton]
    ]);

    function updateModelButtons(kind) {
      buttons.forEach((button, name) => {
        button.setAttribute('aria-pressed', String(name === kind));
      });
      calibrationInputs.forEach(input => { input.disabled = kind !== 'textured'; });
      if (calibrationFrame) calibrationFrame.disabled = kind !== 'textured';
      const description = photoCalibrationControls?.querySelector('.photo-calibration__heading p');
      if (description) {
        description.textContent = kind === 'textured'
          ? 'Elige un marco y edita su posición y tamaño en coordenadas del modelo.'
          : 'Cambia al modelo texturizado para ajustar las fotos de sus marcos.';
      }
    }

    function refreshCalibrationOutput() {
      calibrationOutput.value = JSON.stringify(altar.getAllPhotoCalibrations(), null, 2);
    }

    function showCalibration(frameId) {
      const calibration = altar.getPhotoCalibration(frameId);
      if (!calibration) return;
      calibrationInputs.forEach(input => {
        const value = calibration[input.dataset.calibration];
        input.value = Number(value).toFixed(4);
      });
    }

    calibrationFrame?.addEventListener('change', () => showCalibration(calibrationFrame.value));
    calibrationInputs.forEach(input => {
      input.addEventListener('change', () => {
        const key = input.dataset.calibration;
        if (!input.value || !Number.isFinite(input.valueAsNumber)) return;
        const updated = altar.setPhotoCalibration(calibrationFrame.value, {
          [key]: input.valueAsNumber
        });
        if (!updated) return;
        input.value = Number(updated[key]).toFixed(4);
        refreshCalibrationOutput();
      });
    });

    document.querySelector('#resetPhotoCalibration')?.addEventListener('click', () => {
      altar.resetPhotoCalibration(calibrationFrame.value);
      showCalibration(calibrationFrame.value);
      refreshCalibrationOutput();
      if (calibrationStatus) calibrationStatus.textContent = 'Marco restablecido';
    });

    document.querySelector('#copyPhotoCalibration')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(calibrationOutput.value);
        if (calibrationStatus) calibrationStatus.textContent = 'Coordenadas copiadas';
      } catch (error) {
        calibrationOutput.focus();
        calibrationOutput.select();
        const copied = document.execCommand('copy');
        if (calibrationStatus) calibrationStatus.textContent = copied
          ? 'Coordenadas copiadas'
          : 'Selecciona y copia el bloque manualmente';
      }
    });

    async function selectModel(kind) {
      buttons.forEach(button => { button.disabled = true; });
      try {
        await altar.setModelVariant(kind);
        updateModelButtons(altar.getModelVariant());
      } catch (error) {
        console.error('No se pudo cambiar la variante del altar:', error);
        updateModelButtons(altar.getModelVariant());
      } finally {
        buttons.forEach(button => { button.disabled = false; });
      }
    }

    texturedButton.addEventListener('click', () => selectModel('textured'));
    detailedButton.addEventListener('click', () => selectModel('detailed'));
    updateModelButtons(altar.getModelVariant());
    showCalibration(calibrationFrame?.value || 'left');
    refreshCalibrationOutput();
  }
}
