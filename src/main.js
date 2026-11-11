import { startBackgroundSlideshow } from "./components/background-slideshow.js";
import { setupMemoryForm } from "./components/memory-form.js";
import { setupViewNavigation } from "./components/view-navigation.js";
import { setupAmbientAudio } from "./components/ambient-audio.js";
import { getRegisteredParticipantCount } from "./services/participant-count-service.js";

startBackgroundSlideshow();
const heroSceneLoader = document.querySelector("#heroSceneLoader");
const heroLoadingMessage = document.querySelector("#heroLoadingMessage");
const heroSceneProgress = document.querySelector("#heroSceneProgress");
const heroSceneProgressValue = document.querySelector(
  "#heroSceneProgressValue",
);
const heroLoadingMessagePrefersReducedMotion = matchMedia(
  "(prefers-reduced-motion: reduce)",
);
const heroLoadingMessages = {
  loading: [
    "Estamos preparando tu ofrenda.",
    "Reuniendo cada detalle para ti.",
    "Dando vida a cada recuerdo.",
    "Preparando un espacio lleno de memoria.",
    "Un recuerdo está por tomar forma.",
    "Cada detalle tiene una historia.",
    "Construyendo un puente entre recuerdos.",
    "Tu ofrenda está tomando forma.",
    "Preparando algo muy especial.",
    "La memoria nunca deja de florecer.",
  ],
  curious: [
    "El cempasúchil guía el camino de regreso.",
    "Su color representa la luz del sol.",
    "El papel picado simboliza el viento.",
    "El agua calma la sed de las ánimas.",
    "La sal representa la purificación.",
    "Las velas iluminan el camino.",
    "El copal purifica el ambiente.",
    "El pan de muerto representa la fraternidad.",
    "El cempasúchil también se conoce como flor de veinte pétalos.",
    "Las fotografías recuerdan a quienes amamos.",
    "Cada ofrenda es una historia familiar.",
    "El aroma también forma parte de la tradición.",
    "Las calaveritas representan la muerte con humor.",
    "El Día de Muertos celebra la memoria.",
    "Las flores forman caminos de bienvenida.",
    "Cada vela tiene un significado.",
    "Una fotografía puede guardar toda una vida.",
    "El incienso acompaña las ceremonias.",
    "Las frutas representan la generosidad.",
    "El mantel da vida al altar.",
    "Los alimentos evocan sabores familiares.",
    "El arco simboliza el paso al mundo de los vivos.",
    "Las flores llenan de color cada rincón.",
    "El maíz representa nuestra herencia.",
    "Cada objeto ocupa un lugar especial.",
  ],
  heartfelt: [
    "Recordar también es volver a encontrarnos.",
    "Quien se recuerda, nunca se va.",
    "Las historias viven en quienes las cuentan.",
    "Hay recuerdos que florecen para siempre.",
    "El amor trasciende el tiempo.",
    "Las tradiciones mantienen viva nuestra historia.",
    "Cada ofrenda guarda un pedacito de nosotros.",
    "Recordar es una forma de amar.",
    "Algunas ausencias se convierten en recuerdos eternos.",
    "Las flores se marchitan, los recuerdos no.",
    "Un nombre, una historia, una vida.",
    "La memoria es nuestro mejor homenaje.",
    "Siempre hay un lugar para recordar.",
    "Hoy celebramos las historias que nos dieron vida.",
    "Las tradiciones nos mantienen unidos.",
  ],
  preparing: [
    "Ya casi puedes descubrir tu ofrenda.",
    "Los últimos detalles están llegando.",
    "Tu altar está casi listo.",
    "Cada vez falta menos.",
    "Estamos iluminando el camino.",
    "Las flores están tomando su lugar.",
    "Pronto podrás recorrer cada detalle.",
    "Un recuerdo está a punto de cobrar vida.",
    "La espera también forma parte de la tradición.",
    "Tu experiencia está casi lista.",
  ],
};
let heroSceneProgressPercent = 0;
let previousHeroLoadingMessage = "";
let heroLoadingMessageSwapTimer = null;

function chooseHeroLoadingMessage() {
  const isNearReady = heroSceneProgressPercent >= 75;
  const weightedGroups = isNearReady
    ? [
        ["preparing", 70],
        ["curious", 20],
        ["heartfelt", 10],
      ]
    : [
        ["curious", 60],
        ["heartfelt", 28],
        ["loading", 12],
      ];
  const totalWeight = weightedGroups.reduce(
    (total, [, weight]) => total + weight,
    0,
  );
  let selection = Math.random() * totalWeight;
  let group = weightedGroups[0][0];

  for (const [candidate, weight] of weightedGroups) {
    selection -= weight;
    if (selection < 0) {
      group = candidate;
      break;
    }
  }

  const messages = heroLoadingMessages[group].filter(
    (message) => message !== previousHeroLoadingMessage,
  );
  const message = messages[Math.floor(Math.random() * messages.length)];
  previousHeroLoadingMessage = message;
  return message;
}

const heroLoadingMessageTimer = window.setInterval(() => {
  if (!heroLoadingMessage) return;
  const nextMessage = chooseHeroLoadingMessage();
  if (heroLoadingMessagePrefersReducedMotion.matches) {
    heroLoadingMessage.textContent = nextMessage;
    return;
  }

  heroLoadingMessage.classList.add("is-changing");
  heroLoadingMessageSwapTimer = window.setTimeout(() => {
    heroLoadingMessage.textContent = nextMessage;
    heroLoadingMessage.classList.remove("is-changing");
    heroLoadingMessageSwapTimer = null;
  }, 260);
}, 4200);
function stopHeroLoadingMessages() {
  window.clearInterval(heroLoadingMessageTimer);
  window.clearTimeout(heroLoadingMessageSwapTimer);
  heroLoadingMessage?.classList.remove("is-changing");
}
function updateHeroSceneProgress(value) {
  const progress = Math.max(0, Math.min(100, Math.floor(value)));
  heroSceneProgressPercent = progress;
  if (heroSceneProgressValue)
    heroSceneProgressValue.textContent = String(progress);
  heroSceneProgress?.setAttribute("aria-valuenow", String(progress));
}

let resolveHeroSceneReady;
const heroSceneReady = new Promise((resolve) => {
  resolveHeroSceneReady = resolve;
});
setupAmbientAudio({ deferUntil: heroSceneReady });

const altarViewport = document.querySelector("#altarViewport");
const heroSceneSlot = document.querySelector("#heroSceneSlot");
const generationViewportSlot = document.querySelector(
  "#generationViewportSlot",
);
let altarInstance = null;
let heroSceneActive = true;
// El Hero comienza vacío y muestra flores cuando llega el conteo de Sheets.
const INITIAL_HERO_FLOWER_COUNT = 0;
let heroParticipantCount = INITIAL_HERO_FLOWER_COUNT;
let countRequestPromise = null;
let countLastUpdatedAt = 0;

function refreshHeroFlowerCount({ force = false } = {}) {
  if (countRequestPromise) return countRequestPromise;
  if (!force && Date.now() - countLastUpdatedAt < 30000)
    return Promise.resolve(heroParticipantCount);

  countRequestPromise = getRegisteredParticipantCount()
    .then(async (count) => {
      heroParticipantCount = count;
      countLastUpdatedAt = Date.now();
      await altarInstance?.setHeroFlowerCount(count);
      return count;
    })
    .catch((error) => {
      countLastUpdatedAt = Date.now();
      console.warn(
        "No se pudo consultar el total de personas registradas:",
        error,
      );
      return heroParticipantCount;
    })
    .finally(() => {
      countRequestPromise = null;
    });
  return countRequestPromise;
}

function mountHeroScene() {
  if (!altarViewport || !heroSceneSlot) return;
  heroSceneActive = true;
  heroSceneSlot.append(altarViewport);
  altarViewport.classList.add("hero-scene-viewport");
  altarViewport.classList.remove("generation-stage__viewport");
  altarInstance
    ?.setHeroMode(true)
    .then(() => altarInstance?.setHeroFlowerCount(heroParticipantCount))
    .catch((error) =>
      console.warn("No se pudieron cargar las flores del hero:", error),
    );
  refreshHeroFlowerCount({ force: true });
}
function mountGenerationScene() {
  if (!altarViewport || !generationViewportSlot) return;
  heroSceneActive = false;
  generationViewportSlot.append(altarViewport);
  altarViewport.classList.remove("hero-scene-viewport");
  altarViewport.classList.add("generation-stage__viewport");
  altarInstance
    ?.setHeroMode(false)
    .catch((error) =>
      console.warn("No se pudieron cargar las flores de la ofrenda:", error),
    );
}

setupViewNavigation({ mountHeroScene });

let altarPromise;
async function loadAltar() {
  if (!altarPromise) {
    altarPromise = (async () => {
      const [{ createAltar }, { setupAltarControls }] = await Promise.all([
        import("./components/altar-scene.js"),
        import("./components/altar-controls.js"),
      ]);
      const altar = createAltar(document.querySelector("#altar"), {
        onLoadProgress: updateHeroSceneProgress,
      });
      altarInstance = altar;
      altar.setHeroFlowerCount(heroParticipantCount);
      altar
        .setHeroMode(heroSceneActive)
        .catch((error) =>
          console.warn(
            "No se pudieron preparar las flores de la escena:",
            error,
          ),
        );
      setupAltarControls({ altar });
      return altar;
    })().catch((error) => {
      altarPromise = null;
      throw error;
    });
  }
  return altarPromise;
}

setupMemoryForm({ loadAltar, mountGenerationScene });
refreshHeroFlowerCount({ force: true });
window.setInterval(() => {
  if (!document.querySelector("#homeView")?.hidden && !document.hidden)
    refreshHeroFlowerCount({ force: true });
}, 60000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !document.querySelector("#homeView")?.hidden)
    refreshHeroFlowerCount({ force: true });
});

// Precargar la escena en el hero: la transición no empieza hasta que el modelo
// texturizado terminó de descargar, crear sus materiales y dibujar un frame.
loadAltar()
  .then(async (altar) => {
    await altar.setModelVariant("textured");
    await new Promise(requestAnimationFrame);
    updateHeroSceneProgress(100);
    stopHeroLoadingMessages();
    resolveHeroSceneReady();
    document.querySelector("#beginCreation")?.removeAttribute("disabled");
    const homeView = document.querySelector("#homeView");
    const heroCopy = document.querySelector("#heroCopy");
    homeView?.classList.add("is-scene-ready");
    if (
      heroCopy &&
      matchMedia("(min-width: 769px) and (pointer: fine)").matches &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const bounds = heroCopy.getBoundingClientRect();
      const offsetX = window.innerWidth / 2 - (bounds.left + bounds.width / 2);
      const offsetY = window.innerHeight / 2 - (bounds.top + bounds.height / 2);
      heroCopy.animate(
        [
          { transform: `translate3d(${offsetX}px, ${offsetY}px, 0)` },
          { transform: "translate3d(0, 0, 0)" },
        ],
        {
          duration: 1200,
          easing: "cubic-bezier(.22, 1, .36, 1)",
          fill: "both",
        },
      );
    }
    document.body.classList.add("is-home-scene-ready");
  })
  .catch((error) => {
    stopHeroLoadingMessages();
    heroSceneLoader?.setAttribute("data-state", "error");
    if (heroLoadingMessage)
      heroLoadingMessage.textContent =
        "La escena no pudo cargar. Intenta recargar la página.";
    console.warn("No se pudo precargar la escena del hero:", error);
  });

const developerToggle = document.querySelector("#developerToolsToggle");
if (new URLSearchParams(location.search).get("dev") === "1") {
  document.querySelector("#developerTools").hidden = false;
  let developerSceneReady = false;
  developerToggle?.addEventListener("click", async () => {
    if (developerSceneReady) return;
    try {
      const altar = await loadAltar();
      await altar.setModelVariant("textured");
      developerSceneReady = true;
      mountGenerationScene();
      const generationStage = document.querySelector("#generationStage");
      generationStage.hidden = false;
      document.body.classList.add("is-generating");
      document.querySelector("#generationStage h2").textContent =
        "Escena de desarrollo";
      document.querySelector("#generationClose").hidden = false;
      document.querySelector("#generationClose").textContent = "Cerrar escena";
      const panel = document.querySelector("#developerToolsPanel");
      panel.hidden = false;
      developerToggle.setAttribute("aria-expanded", "true");
      document.querySelector("#developerToolsClose")?.focus();
    } catch (error) {
      console.error(
        "No se pudo cargar la escena para las herramientas de desarrollo:",
        error,
      );
    }
  });
}
