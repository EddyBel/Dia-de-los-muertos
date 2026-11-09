import { startBackgroundSlideshow } from './components/background-slideshow.js';
import { setupMemoryForm } from './components/memory-form.js';
import { setupViewNavigation } from './components/view-navigation.js';

startBackgroundSlideshow();

const altarViewport = document.querySelector('#altarViewport');
const heroSceneSlot = document.querySelector('#heroSceneSlot');
const generationViewportSlot = document.querySelector('#generationViewportSlot');
function mountHeroScene() {
  if (!altarViewport || !heroSceneSlot) return;
  heroSceneSlot.append(altarViewport);
  altarViewport.classList.add('hero-scene-viewport');
  altarViewport.classList.remove('generation-stage__viewport');
}
function mountGenerationScene() {
  if (!altarViewport || !generationViewportSlot) return;
  generationViewportSlot.append(altarViewport);
  altarViewport.classList.remove('hero-scene-viewport');
  altarViewport.classList.add('generation-stage__viewport');
}

setupViewNavigation({ mountHeroScene });

let altarPromise;
async function loadAltar() {
  if (!altarPromise) {
    altarPromise = (async () => {
      const [{ createAltar }, { setupAltarControls }] = await Promise.all([
        import('./components/altar-scene.js'),
        import('./components/altar-controls.js')
      ]);
      const altar = createAltar(document.querySelector('#altar'));
      setupAltarControls({ altar });
      return altar;
    })().catch(error => {
      altarPromise = null;
      throw error;
    });
  }
  return altarPromise;
}

setupMemoryForm({ loadAltar, mountGenerationScene, mountHeroScene });

// Precargar la escena en el hero: la transición no empieza hasta que el modelo
// texturizado terminó de descargar, crear sus materiales y dibujar un frame.
loadAltar()
  .then(async altar => {
    await altar.setModelVariant('textured');
    await new Promise(requestAnimationFrame);
    document.querySelector('#homeView')?.classList.add('is-scene-ready');
    document.body.classList.add('is-home-scene-ready');
  })
  .catch(error => console.warn('No se pudo precargar la escena del hero:', error));

const developerToggle = document.querySelector('#developerToolsToggle');
if (new URLSearchParams(location.search).get('dev') === '1') {
  document.querySelector('#developerTools').hidden = false;
  let developerSceneReady = false;
  developerToggle?.addEventListener('click', async () => {
    if (developerSceneReady) return;
    try {
      const altar = await loadAltar();
      await altar.setModelVariant('textured');
      developerSceneReady = true;
      mountGenerationScene();
      const generationStage = document.querySelector('#generationStage');
      generationStage.hidden = false;
      document.body.classList.add('is-generating');
      document.querySelector('#generationStage h2').textContent = 'Escena de desarrollo';
      document.querySelector('#generationClose').hidden = false;
      document.querySelector('#generationClose').textContent = 'Cerrar escena';
      const panel = document.querySelector('#developerToolsPanel');
      panel.hidden = false;
      developerToggle.setAttribute('aria-expanded', 'true');
      document.querySelector('#developerToolsClose')?.focus();
    } catch (error) {
      console.error('No se pudo cargar la escena para las herramientas de desarrollo:', error);
    }
  });
}

const heroCopy = document.querySelector('#heroCopy');
if (heroCopy && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  import('animejs').then(({ animate }) => {
    animate(heroCopy, {
      translateY: [12, 0],
      opacity: [0, 1],
      duration: 1000,
      ease: 'outCubic'
    });
  }).catch(error => console.warn('No se pudo iniciar la animación del hero:', error));
}
