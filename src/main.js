import { startBackgroundSlideshow } from './components/background-slideshow.js';
import { setupMemoryForm } from './components/memory-form.js';
import { setupViewNavigation } from './components/view-navigation.js';
import { setupAmbientAudio } from './components/ambient-audio.js';
import { getRegisteredParticipantCount } from './services/participant-count-service.js';

startBackgroundSlideshow();
const isMobileProfile = matchMedia('(max-width: 768px), (pointer: coarse)').matches;
let resolveHeroSceneReady;
const heroSceneReady = new Promise(resolve => { resolveHeroSceneReady = resolve; });
setupAmbientAudio({ deferUntil: isMobileProfile ? heroSceneReady : null });

const altarViewport = document.querySelector('#altarViewport');
const heroSceneSlot = document.querySelector('#heroSceneSlot');
const generationViewportSlot = document.querySelector('#generationViewportSlot');
let altarInstance = null;
let heroSceneActive = true;
// El Hero comienza vacío y muestra flores cuando llega el conteo de Sheets.
const INITIAL_HERO_FLOWER_COUNT = 0;
let heroParticipantCount = INITIAL_HERO_FLOWER_COUNT;
let countRequestPromise = null;
let countLastUpdatedAt = 0;

function refreshHeroFlowerCount({ force = false } = {}) {
  if (countRequestPromise) return countRequestPromise;
  if (!force && Date.now() - countLastUpdatedAt < 30000) return Promise.resolve(heroParticipantCount);

  countRequestPromise = getRegisteredParticipantCount()
    .then(async count => {
      heroParticipantCount = count;
      countLastUpdatedAt = Date.now();
      await altarInstance?.setHeroFlowerCount(count);
      return count;
    })
    .catch(error => {
      countLastUpdatedAt = Date.now();
      console.warn('No se pudo consultar el total de personas registradas:', error);
      return heroParticipantCount;
    })
    .finally(() => { countRequestPromise = null; });
  return countRequestPromise;
}

function mountHeroScene() {
  if (!altarViewport || !heroSceneSlot) return;
  heroSceneActive = true;
  heroSceneSlot.append(altarViewport);
  altarViewport.classList.add('hero-scene-viewport');
  altarViewport.classList.remove('generation-stage__viewport');
  altarInstance?.setHeroMode(true)
    .then(() => altarInstance?.setHeroFlowerCount(heroParticipantCount))
    .catch(error => console.warn('No se pudieron cargar las flores del hero:', error));
  refreshHeroFlowerCount({ force: true });
}
function mountGenerationScene() {
  if (!altarViewport || !generationViewportSlot) return;
  heroSceneActive = false;
  generationViewportSlot.append(altarViewport);
  altarViewport.classList.remove('hero-scene-viewport');
  altarViewport.classList.add('generation-stage__viewport');
  altarInstance?.setHeroMode(false).catch(error => console.warn('No se pudieron cargar las flores de la ofrenda:', error));
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
      altarInstance = altar;
      altar.setHeroFlowerCount(heroParticipantCount);
      altar.setHeroMode(heroSceneActive).catch(error => console.warn('No se pudieron preparar las flores de la escena:', error));
      setupAltarControls({ altar });
      return altar;
    })().catch(error => {
      altarPromise = null;
      throw error;
    });
  }
  return altarPromise;
}

setupMemoryForm({ loadAltar, mountGenerationScene });
refreshHeroFlowerCount({ force: true });
window.setInterval(() => {
  if (!document.querySelector('#homeView')?.hidden && !document.hidden) refreshHeroFlowerCount({ force: true });
}, 60000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !document.querySelector('#homeView')?.hidden) refreshHeroFlowerCount({ force: true });
});

// Precargar la escena en el hero: la transición no empieza hasta que el modelo
// texturizado terminó de descargar, crear sus materiales y dibujar un frame.
loadAltar()
  .then(async altar => {
    await altar.setModelVariant('textured');
    await new Promise(requestAnimationFrame);
    resolveHeroSceneReady();
    const homeView = document.querySelector('#homeView');
    const heroCopy = document.querySelector('#heroCopy');
    homeView?.classList.add('is-scene-ready');
    if (heroCopy && matchMedia('(min-width: 769px) and (pointer: fine)').matches
      && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const bounds = heroCopy.getBoundingClientRect();
      const offsetX = window.innerWidth / 2 - (bounds.left + bounds.width / 2);
      const offsetY = window.innerHeight / 2 - (bounds.top + bounds.height / 2);
      heroCopy.animate([
        { transform: `translate3d(${offsetX}px, ${offsetY}px, 0)` },
        { transform: 'translate3d(0, 0, 0)' }
      ], {
        duration: 1200,
        easing: 'cubic-bezier(.22, 1, .36, 1)',
        fill: 'both'
      });
    }
    document.body.classList.add('is-home-scene-ready');
  })
  .catch(error => {
    resolveHeroSceneReady();
    console.warn('No se pudo precargar la escena del hero:', error);
  });

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
