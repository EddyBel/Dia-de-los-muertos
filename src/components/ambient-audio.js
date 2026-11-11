import { ambientMusicConfig } from '../config.js';
import { cachePlayingTrackLyrics } from '../services/lyrics-cache-service.js';

export function setupAmbientAudio({ deferUntil = null } = {}) {
  const toggle = document.querySelector('#ambientAudioToggle');
  const title = document.querySelector('#ambientAudioTitle');
  const action = document.querySelector('#ambientAudioAction');
  if (!toggle || !title || !action) return;

  let audio;
  let tracks = [];
  let currentIndex = -1;
  let active = false;
  let muted = false;
  let ready = false;
  let autoplayBlocked = false;
  let currentTitle = 'Música ambiental';
  let lastLyricsTrackKey = '';

  const updateControl = () => {
    const label = active
      ? `${currentTitle}. ${muted ? 'Activar sonido' : 'Silenciar'}`
      : (autoplayBlocked ? 'Toca para iniciar la música ambiental' : 'Activar música ambiental');
    title.textContent = active ? currentTitle : (autoplayBlocked ? 'Toca para escuchar' : 'Música ambiental');
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('aria-pressed', String(active && !muted));
    action.textContent = active ? (muted ? '🔇' : '🔊') : '▶';
  };

  function chooseNextTrack() {
    if (!tracks.length) return null;
    if (tracks.length === 1) return 0;
    let nextIndex = currentIndex;
    while (nextIndex === currentIndex) nextIndex = Math.floor(Math.random() * tracks.length);
    return nextIndex;
  }

  function getTrackUrl(file) {
    const encodedPath = file.split('/').map(part => encodeURIComponent(part)).join('/');
    return new URL(encodedPath, ambientMusicConfig.manifestUrl).href;
  }

  async function playRandomTrack() {
    const nextIndex = chooseNextTrack();
    if (nextIndex === null) return;
    currentIndex = nextIndex;
    const track = tracks[currentIndex];
    currentTitle = track.title;
    audio.src = getTrackUrl(track.file);
    audio.load();
    updateControl();
    await playCurrentTrack();
  }

  async function playCurrentTrack() {
    if (!audio) return;
    autoplayBlocked = false;
    audio.muted = muted;
    try {
      await audio.play();
    } catch (error) {
      active = false;
      autoplayBlocked = true;
      updateControl();
      console.info('El navegador requiere una interacción para iniciar la música:', error);
    }
  }

  function recordCurrentTrackLyrics() {
    const track = tracks[currentIndex];
    if (!track) return;
    const key = track.file;
    if (key === lastLyricsTrackKey) return;
    lastLyricsTrackKey = key;
    cachePlayingTrackLyrics({ title: track.title, artist: '' })
      .then(result => {
        console.info(`Estado de letra de “${track.title}”: ${result.status}${result.cached ? ' (hoja)' : ''}`);
      })
      .catch(error => console.warn(`No se pudo registrar la letra de “${track.title}”:`, error));
  }

  const initializePlayer = async () => {
    try {
      const response = await fetch(ambientMusicConfig.manifestUrl, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`No se pudo leer la lista de música (${response.status}).`);
      const manifest = await response.json();
      tracks = Array.isArray(manifest)
        ? manifest.filter(track => typeof track?.file === 'string' && typeof track?.title === 'string')
        : [];
      if (!tracks.length) throw new Error('No hay archivos MP3 en public/musica.');

      audio = new Audio();
      audio.preload = 'none';
      audio.volume = Math.max(0, Math.min(1, Number(ambientMusicConfig.volume) || 0));
      audio.addEventListener('play', () => {
        active = true;
        autoplayBlocked = false;
        updateControl();
        recordCurrentTrackLyrics();
      });
      audio.addEventListener('pause', () => {
        active = false;
        updateControl();
      });
      audio.addEventListener('ended', () => {
        active = false;
        playRandomTrack();
      });
      audio.addEventListener('error', () => {
        if (!audio.src) return;
        active = false;
        ready = false;
        toggle.disabled = true;
        title.textContent = `No se pudo cargar: ${currentTitle}`;
        action.textContent = '▶';
        console.warn('No se pudo reproducir el archivo de música:', audio.currentSrc);
      });

      ready = true;
      toggle.disabled = false;
      if (ambientMusicConfig.autoplay) await playRandomTrack();
      else updateControl();
    } catch (error) {
      title.textContent = 'Música no disponible';
      toggle.disabled = true;
      console.warn('No se pudo preparar la música ambiental:', error);
    }
  };

  toggle.disabled = true;
  title.textContent = deferUntil ? 'Cargando el altar antes de la música…' : 'Preparando música…';
  if (deferUntil && typeof deferUntil.then === 'function') deferUntil.then(initializePlayer);
  else initializePlayer();

  toggle.addEventListener('click', async () => {
    if (!ready || !audio) return;
    if (active && !muted) {
      muted = true;
      audio.muted = true;
      updateControl();
      return;
    }
    if (active && muted) {
      muted = false;
      audio.muted = false;
      updateControl();
      return;
    }
    if (currentIndex < 0) await playRandomTrack();
    else await playCurrentTrack();
  });
}
