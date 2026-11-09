import { ambientMusicConfig } from '../config.js';
import { cachePlayingTrackLyrics } from '../services/lyrics-cache-service.js';

const API_URL = 'https://www.youtube.com/iframe_api';
const PLAYER_SIZE = 200;

function readSource(sourceUrl) {
  const url = new URL(sourceUrl);
  const playlistId = url.searchParams.get('list');
  const videoId = url.searchParams.get('v') ||
    (url.hostname === 'youtu.be' ? url.pathname.slice(1) : null);

  if (!playlistId && !videoId) throw new Error('La URL debe incluir un video o una playlist de YouTube.');
  return { playlistId, videoId };
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (window.__ambientYoutubeApiPromise) return window.__ambientYoutubeApiPromise;

  window.__ambientYoutubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    const timeout = window.setTimeout(() => reject(new Error('YouTube tardó demasiado en responder.')), 15000);

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      previousReady?.();
      resolve(window.YT);
    };

    if (!document.querySelector(`script[src="${API_URL}"]`)) {
      const script = document.createElement('script');
      script.src = API_URL;
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error('No se pudo cargar el reproductor de YouTube.'));
      };
      document.head.append(script);
    }
  });

  return window.__ambientYoutubeApiPromise;
}

export function setupAmbientAudio() {
  const toggle = document.querySelector('#ambientAudioToggle');
  const title = document.querySelector('#ambientAudioTitle');
  const action = document.querySelector('#ambientAudioAction');
  const mount = document.querySelector('#ambientYoutubePlayer');
  if (!toggle || !title || !action || !mount) return;

  let source;
  try {
    source = readSource(ambientMusicConfig.url);
  } catch (error) {
    title.textContent = 'Música no disponible';
    toggle.disabled = true;
    console.warn(error);
    return;
  }

  let player;
  let ready = false;
  let active = false;
  let muted = false;
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

  const startPlayback = target => {
    autoplayBlocked = false;
    muted = false;
    target.unMute();
    target.setVolume(ambientMusicConfig.volume);
    if (source.playlistId) {
      target.setShuffle(true);
      target.setLoop(true);
      const playlist = target.getPlaylist() || [];
      if (playlist.length > 1) {
        target.playVideoAt(Math.floor(Math.random() * playlist.length));
      } else {
        target.playVideo();
      }
    } else {
      target.playVideo();
    }
    updateControl();
  };

  toggle.disabled = true;
  title.textContent = 'Preparando música…';

  loadYouTubeApi()
    .then(YT => new Promise((resolve, reject) => {
      const playerVars = {
        autoplay: 0,
        controls: 0,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
        origin: location.origin,
      };

      if (source.playlistId) {
        playerVars.listType = 'playlist';
        playerVars.list = source.playlistId;
      } else {
        playerVars.loop = 1;
        playerVars.playlist = source.videoId;
      }

      try {
        player = new YT.Player(mount, {
          width: PLAYER_SIZE,
          height: PLAYER_SIZE,
          ...(source.playlistId ? {} : { videoId: source.videoId }),
          playerVars,
          events: {
            onReady(event) {
              ready = true;
              toggle.disabled = false;
              if (ambientMusicConfig.autoplay) startPlayback(event.target);
              updateControl();
              resolve();
            },
            onStateChange(event) {
              if (event.data === YT.PlayerState.PLAYING) {
                active = true;
                const videoData = event.target.getVideoData() || {};
                const trackTitle = videoData.title?.trim();
                currentTitle = trackTitle || 'Música ambiental';
                muted = event.target.isMuted();
                autoplayBlocked = false;
                updateControl();
                const trackKey = videoData.video_id || `${trackTitle}|${videoData.author || ''}`;
                if (trackTitle && trackKey !== lastLyricsTrackKey) {
                  lastLyricsTrackKey = trackKey;
                  cachePlayingTrackLyrics({
                    title: trackTitle,
                    artist: String(videoData.author || '').replace(/\s+-\s+Topic$/i, '')
                  }).then(result => {
                    console.info(`Estado de letra de “${trackTitle}”: ${result.status}${result.cached ? ' (hoja)' : ''}`);
                  }).catch(error => console.warn(`No se pudo registrar la letra de “${trackTitle}”:`, error));
                }
              } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
                active = false;
                updateControl();
              }
            },
            onError(error) {
              console.warn('YouTube no pudo reproducir la música ambiental:', error.data);
              title.textContent = 'Música no disponible';
              toggle.disabled = true;
              reject(new Error(`YouTube rechazó la reproducción (${error.data}).`));
            },
            onAutoplayBlocked() {
              active = false;
              autoplayBlocked = true;
              updateControl();
            },
          },
        });
      } catch (error) {
        reject(error);
      }
    }))
    .catch(error => {
      title.textContent = 'Música no disponible';
      toggle.disabled = true;
      console.warn('No se pudo preparar la música ambiental:', error);
    });

  toggle.addEventListener('click', () => {
    if (!ready || !player) return;

    if (!active) {
      startPlayback(player);
      return;
    }

    if (muted) {
      player.unMute();
      player.setVolume(ambientMusicConfig.volume);
      muted = false;
    } else {
      player.mute();
      muted = true;
    }
    updateControl();
  });
}
