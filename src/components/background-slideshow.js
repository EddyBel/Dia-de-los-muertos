const backgrounds = [
  new URL('../../public/backgrounds/ofrenda-01.jpg', import.meta.url).href,
  new URL('../../public/backgrounds/ofrenda-02.jpg', import.meta.url).href,
  new URL('../../public/backgrounds/ofrenda-03.jpg', import.meta.url).href,
  new URL('../../public/backgrounds/ofrenda-04.jpg', import.meta.url).href,
  new URL('../../public/backgrounds/ofrenda-05.jpg', import.meta.url).href
];

export function startBackgroundSlideshow() {
  const container = document.querySelector('#ambientBackground');
  if (!container || backgrounds.length < 2) return;

  const layers = Array.from(container.querySelectorAll('.ambient-background__image'));
  if (layers.length !== 2) return;

  let activeLayer = 0;
  let activeBackground = Math.floor(Math.random() * backgrounds.length);

  function loadIntoLayer(backgroundIndex, layerIndex, onReady) {
    const image = new Image();
    image.onload = () => {
      layers[layerIndex].style.backgroundImage = `url("${backgrounds[backgroundIndex]}")`;
      onReady();
    };
    image.onerror = () => console.error('No se pudo cargar una imagen de fondo:', backgrounds[backgroundIndex]);
    image.src = backgrounds[backgroundIndex];
  }

  loadIntoLayer(activeBackground, activeLayer, () => {
    layers[activeLayer].classList.add('is-active');
  });

  function showRandomBackground() {
    const choices = backgrounds
      .map((_, index) => index)
      .filter(index => index !== activeBackground);
    const nextBackground = choices[Math.floor(Math.random() * choices.length)];
    const nextLayer = 1 - activeLayer;

    loadIntoLayer(nextBackground, nextLayer, () => {
      requestAnimationFrame(() => {
        layers[nextLayer].classList.add('is-active');
        layers[activeLayer].classList.remove('is-active');
        activeLayer = nextLayer;
        activeBackground = nextBackground;
      });
    });
  }

  window.setInterval(showRandomBackground, 12000);
}
