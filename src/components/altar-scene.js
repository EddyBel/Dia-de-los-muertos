import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ALTAR_PHOTO_FRAMES, ALTAR_STL_BOUNDS } from './altar-feature-map.js';

const MODEL_URL = new URL(
  '../../public/models/altar-de-dia-de-muertos-ofrenda-mexicana-decorativa-model_files/diademuertos_ofrenda_altar_v1.stl',
  import.meta.url
).href;
const FLOOR_TEXTURE_URL = new URL(
  '../../public/textures/piso-barro.jpg',
  import.meta.url
).href;
const TEXTURED_MODEL_URL = new URL('../../public/models/altar-textured/altar.obj', import.meta.url).href;
const TEXTURED_DIFFUSE_URL = new URL('../../public/models/altar-textured/diffuse.png', import.meta.url).href;
const TEXTURED_NORMAL_URL = new URL('../../public/models/altar-textured/normal.png', import.meta.url).href;
const TEXTURED_ROUGHNESS_URL = new URL('../../public/models/altar-textured/roughness.png', import.meta.url).href;
const MOBILE_DIFFUSE_URL = new URL('../../public/models/altar-textured/mobile/diffuse.webp', import.meta.url).href;
const MOBILE_NORMAL_URL = new URL('../../public/models/altar-textured/mobile/normal.webp', import.meta.url).href;
const MOBILE_ROUGHNESS_URL = new URL('../../public/models/altar-textured/mobile/roughness.webp', import.meta.url).href;
const MODEL_BACKDROP_URL = new URL(
  '../../public/backgrounds/escena-modelo.jpg',
  import.meta.url
).href;
const MOBILE_MODEL_BACKDROP_URL = new URL(
  '../../public/backgrounds/escena-modelo-mobile.webp',
  import.meta.url
).href;
const HERO_FLOWERS_DESKTOP_URL = new URL('../../public/models/cempasuchil-floor-200.glb', import.meta.url).href;
const HERO_FLOWERS_MOBILE_URL = new URL('../../public/models/cempasuchil-floor-200-mobile.glb', import.meta.url).href;
const MAX_FLOWER_COUNT = 200;
const FINAL_ALTAR_FLOWER_COUNT = 100;
const FLOWER_SPROUT_DURATION = 620;
const FLOWER_SPROUT_STAGGER = 14;
const FLOWER_SPARKS_PER_BURST = 3;
const PETAL_COLORS = [0xff8c00, 0xffad01, 0xffa500, 0xffd700];
const DESKTOP_PHOTO_SESSION_SIZE = 1600;
const MOBILE_ALTAR_SCALE = .72;
const MAX_SCENE_ROTATION = THREE.MathUtils.degToRad(38);

const PHOTO_SESSION_VIEWS = [
  { id: 'frontal', label: 'Vista frontal', azimuth: 0, elevation: 16 },
  { id: 'tres-cuartos-derecha', label: 'Tres cuartos derecha', azimuth: 38, elevation: 18 },
  { id: 'tres-cuartos-izquierda', label: 'Tres cuartos izquierda', azimuth: -38, elevation: 18 },
  { id: 'picado', label: 'Picado', azimuth: 0, elevation: 44 },
  { id: 'contrapicado', label: 'Contrapicado', azimuth: 0, elevation: -10 }
];

const modelBackdropPromises = new Map();

function loadModelBackdrop(url) {
  if (!modelBackdropPromises.has(url)) {
    modelBackdropPromises.set(url, new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    }));
  }
  return modelBackdropPromises.get(url);
}

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar una captura de la ofrenda.'));
    }, 'image/jpeg', quality);
  });
}
function createAltarMaterial() {
  return new THREE.MeshStandardMaterial({
    color: '#b99a7d',
    roughness: .78,
    metalness: 0,
    side: THREE.DoubleSide
  });
}

function remapModelCoordinate(value, sourceMin, sourceMax, targetMin, targetMax) {
  const progress = (value - sourceMin) / (sourceMax - sourceMin);
  return targetMin + progress * (targetMax - targetMin);
}

function createPhotoTexture(image, targetAspect) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round(canvas.width / targetAspect);
  const context = canvas.getContext('2d');
  const sourceRatio = image.width / image.height;
  const targetRatio = canvas.width / canvas.height;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;

  if (sourceRatio > targetRatio) {
    sw = image.height * targetRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / targetRatio;
    sy = (image.height - sh) / 2;
  }

  // Recorte tipo "cover": la foto llega a los bordes del hueco sin bandas.
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function createAltar(canvas) {
  const mobileProfile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  const lowMemoryProfile = mobileProfile && (
    Number(navigator.deviceMemory || 8) <= 4 || Number(navigator.hardwareConcurrency || 8) <= 4
  );
  const photoSessionSize = mobileProfile ? (lowMemoryProfile ? 1024 : 1280) : DESKTOP_PHOTO_SESSION_SIZE;
  const photoJpegQuality = mobileProfile ? (lowMemoryProfile ? .84 : .88) : .94;
  const altarScale = mobileProfile ? MOBILE_ALTAR_SCALE : 1;
  const cameraTargetHeight = 2.7 * altarScale;
  const scene = new THREE.Scene();
  // La niebla negra es más lejana en escritorio para ocultar el borde del piso
  // sin apagar la ofrenda; en móvil se acerca para conservar el efecto de escala.
  scene.fog = new THREE.FogExp2(0x050307, mobileProfile ? .036 : .026);
  const stage = new THREE.Group();
  scene.add(stage);

  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  camera.position.set(0, 2.7 + (6.3 - 2.7) * altarScale, 12.2);
  camera.lookAt(0, cameraTargetHeight, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !mobileProfile,
    alpha: true,
    preserveDrawingBuffer: !mobileProfile,
    powerPreference: mobileProfile ? 'low-power' : 'default'
  });
  const viewportPixelRatio = mobileProfile ? 1 : Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(viewportPixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = !mobileProfile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  function createMarigoldPetalRain() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const petalCount = reducedMotion ? 0 : (lowMemoryProfile ? 18 : (mobileProfile ? 34 : 120));
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(petalCount * 3);
    const speeds = new Float32Array(petalCount);
    const phases = new Float32Array(petalCount);
    const sizes = new Float32Array(petalCount);
    const rotations = new Float32Array(petalCount);
    const colors = new Float32Array(petalCount * 3);
    const color = new THREE.Color();

    for (let index = 0; index < petalCount; index += 1) {
      positions[index * 3] = (Math.random() - .5) * 9;
      positions[index * 3 + 1] = 0;
      positions[index * 3 + 2] = (Math.random() - .5) * 8;
      speeds[index] = .08 + Math.random() * .09;
      phases[index] = Math.random();
      sizes[index] = .1 + Math.random() * .08;
      rotations[index] = Math.random() * Math.PI;
      color.setHex(PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)]);
      color.toArray(colors, index * 3);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aRotation', new THREE.BufferAttribute(rotations, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

    const uniforms = { uTime: { value: 0 } };
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      vertexShader: `
        attribute float aSpeed;
        attribute float aPhase;
        attribute float aSize;
        attribute float aRotation;
        attribute vec3 aColor;
        uniform float uTime;
        varying vec3 vColor;
        varying float vRotation;
        varying float vFade;
        void main() {
          float fall = mod(aPhase + uTime * aSpeed, 1.0);
          vec3 point = position;
          point.y = 7.2 - fall * 9.0;
          point.x += sin(uTime * .85 + aPhase * 19.0) * .35;
          point.z += cos(uTime * .62 + aPhase * 13.0) * .24;
          vec4 viewPosition = modelViewMatrix * vec4(point, 1.0);
          gl_Position = projectionMatrix * viewPosition;
          gl_PointSize = clamp(aSize * (300.0 / max(1.0, -viewPosition.z)), 2.0, 9.0);
          vColor = aColor;
          vRotation = aRotation + sin(uTime * 1.4 + aPhase * 20.0) * .8;
          vFade = smoothstep(0.0, .08, fall) * (1.0 - smoothstep(.91, 1.0, fall));
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vRotation;
        varying float vFade;
        void main() {
          vec2 leaf = gl_PointCoord - vec2(.5);
          float sine = sin(vRotation);
          float cosine = cos(vRotation);
          leaf = mat2(cosine, -sine, sine, cosine) * leaf;
          float halfWidth = mix(.025, .25, 1.0 - abs(leaf.y) * 2.0);
          float edge = 1.0 - smoothstep(halfWidth - .035, halfWidth, abs(leaf.x));
          float tip = 1.0 - smoothstep(.47, .5, abs(leaf.y));
          float alpha = edge * tip * vFade;
          if (alpha < .04) discard;
          float vein = 1.0 - smoothstep(.008, .025, abs(leaf.x));
          vec3 petalColor = mix(vColor * .72, min(vColor * 1.18, vec3(1.0)), vein * .32);
          gl_FragColor = vec4(petalColor, alpha * .88);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `
    });
    const particles = new THREE.Points(geometry, material);
    particles.frustumCulled = false;
    particles.renderOrder = 3;
    return { particles, uniforms, enabled: petalCount > 0 };
  }

  const petalRain = createMarigoldPetalRain();
  scene.add(petalRain.particles);

  stage.add(new THREE.HemisphereLight(0xffd59b, 0x100a14, .3));
  const keyLight = new THREE.DirectionalLight(0xffc27b, 1.8);
  keyLight.position.set(-4.5, 7.5, 3.5);
  keyLight.castShadow = !mobileProfile;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -5.5;
  keyLight.shadow.camera.right = 5.5;
  keyLight.shadow.camera.top = 7;
  keyLight.shadow.camera.bottom = -.6;
  keyLight.shadow.camera.near = .1;
  keyLight.shadow.camera.far = 18;
  keyLight.shadow.bias = -.00025;
  keyLight.shadow.normalBias = .025;
  keyLight.shadow.radius = 3;
  stage.add(keyLight);
  const fillLight = new THREE.PointLight(0xff8b39, 3.8, 10, 2);
  fillLight.position.set(0, 3.2, 3.8);
  stage.add(fillLight);

  // Pools of warm light at the candle rows create the localized, uneven
  // illumination of a candle-lit ofrenda without four expensive shadow maps.
  const candleLightPositions = mobileProfile
    ? [[-.25, 3.1, 2.4]]
    : [
    [-.68, 3.55, 1.7], [.68, 3.55, 1.7],
    [-.72, 2.55, 2.05], [.72, 2.55, 2.05]
  ];
  const candleLights = candleLightPositions.map(([x, y, z], index) => {
    const candleLight = new THREE.PointLight(0xffa64f, 2.6, 3.8, 2);
    candleLight.position.set(x, y, z);
    stage.add(candleLight);
    return { light: candleLight, phase: index * 1.7 };
  });

  const altar = new THREE.Group();
  altar.scale.setScalar(altarScale);
  stage.add(altar);
  let heroFlowers = null;
  let heroFlowersPromise = null;
  let flowerSprouts = new Map();
  let flowerSparkInstances = null;
  const flowerSparkTransform = new THREE.Object3D();
  let heroMode = true;
  let heroFlowerCount = 0;

  const floorMaterial = new THREE.MeshStandardMaterial({
    color: '#a94b2c',
    roughness: .84,
    metalness: 0
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    floorMaterial
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.045;
  floor.receiveShadow = true;
  stage.add(floor);

  // Velo oscuro transparente sobre el piso: conserva el patrón de barro cerca
  // del altar y lo funde gradualmente con la penumbra, sin un borde cuadrado.
  function createFloorDarknessTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(256, 256, 45, 256, 256, 255);
    gradient.addColorStop(0, 'rgba(5, 3, 7, 0)');
    gradient.addColorStop(.3, 'rgba(5, 3, 7, .04)');
    gradient.addColorStop(.55, 'rgba(5, 3, 7, .36)');
    gradient.addColorStop(.78, 'rgba(5, 3, 7, .82)');
    gradient.addColorStop(1, 'rgba(5, 3, 7, .98)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  const floorDarkness = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshBasicMaterial({
      map: createFloorDarknessTexture(),
      transparent: true,
      depthWrite: false,
      toneMapped: false
    })
  );
  floorDarkness.rotation.x = -Math.PI / 2;
  floorDarkness.position.y = -.038;
  floorDarkness.renderOrder = 2;
  stage.add(floorDarkness);

  function createContactShadowTexture() {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const context = shadowCanvas.getContext('2d');
    const gradient = context.createRadialGradient(128, 128, 16, 128, 128, 126);
    gradient.addColorStop(0, 'rgba(31, 11, 8, 0.62)');
    gradient.addColorStop(.48, 'rgba(31, 11, 8, 0.28)');
    gradient.addColorStop(1, 'rgba(31, 11, 8, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(shadowCanvas);
    texture.colorSpace = THREE.NoColorSpace;
    return texture;
  }

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(7.6, 5.4),
    new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      toneMapped: false
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = -.036;
  contactShadow.renderOrder = 1;
  stage.add(contactShadow);

  let markFloorTextureReady;
  const floorTextureReady = new Promise(resolve => { markFloorTextureReady = resolve; });
  new THREE.TextureLoader().load(
    FLOOR_TEXTURE_URL,
    texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(22.5, 22.5);
      texture.anisotropy = mobileProfile
        ? Math.min(2, renderer.capabilities.getMaxAnisotropy())
        : renderer.capabilities.getMaxAnisotropy();

      floorMaterial.map = texture;
      if (!mobileProfile) {
        const bumpTexture = texture.clone();
        bumpTexture.colorSpace = THREE.NoColorSpace;
        bumpTexture.wrapS = THREE.RepeatWrapping;
        bumpTexture.wrapT = THREE.RepeatWrapping;
        bumpTexture.repeat.set(22.5, 22.5);
        bumpTexture.needsUpdate = true;
        floorMaterial.bumpMap = bumpTexture;
        floorMaterial.bumpScale = .024;
      }
      floorMaterial.color.set('#ffffff');
      floorMaterial.needsUpdate = true;
      markFloorTextureReady();
      render();
    },
    undefined,
    error => {
      console.error('No se pudo cargar la textura del piso:', error);
      markFloorTextureReady();
    }
  );

  const photoGroup = new THREE.Group();
  altar.add(photoGroup);
  let photoCards = [];
  let photoTextures = [];
  let selectedImages = [];
  const modelPlacements = new Map();
  const modelInstances = new Map();
  const modelPromises = new Map();
  let modelSelectionRequest = 0;
  let activeModelKind = 'textured';
  let carouselStartedAt = Date.now();
  let activeCarouselStep = 0;
  let dragging = false;
  let lastX = 0;
  let targetRotation = 0;
  let capturingPhotoSession = false;
  let dedication = '';
  const dedicationOverlay = document.querySelector('#dedicationOverlay');
  const developerMode = new URLSearchParams(window.location.search).get('dev') === '1';

  const photoFrames = ALTAR_PHOTO_FRAMES;
  const photoCalibration = new Map(photoFrames.map(frame => [frame.id, {
    x: frame.texturedPosition.x,
    y: frame.texturedPosition.y,
    z: frame.texturedPosition.z,
    width: frame.texturedAperture.width,
    height: frame.texturedAperture.height,
    rotationX: frame.texturedTiltX
  }]));

  function getPhotoCalibration(frameId) {
    const value = photoCalibration.get(frameId);
    return value ? { ...value } : null;
  }

  function getAllPhotoCalibrations() {
    return Object.fromEntries(photoFrames.map(frame => [frame.id, getPhotoCalibration(frame.id)]));
  }

  function setPhotoCalibration(frameId, values = {}) {
    const current = photoCalibration.get(frameId);
    if (!current) return null;
    ['x', 'y', 'z', 'width', 'height'].forEach(key => {
      const value = Number(values[key]);
      if (Number.isFinite(value) && (key === 'x' || key === 'y' || key === 'z' || value > 0)) {
        current[key] = value;
      }
    });
    renderPhotoFrames();
    return getPhotoCalibration(frameId);
  }

  function resetPhotoCalibration(frameId) {
    const framesToReset = frameId ? photoFrames.filter(frame => frame.id === frameId) : photoFrames;
    framesToReset.forEach(frame => {
      photoCalibration.set(frame.id, {
        x: frame.texturedPosition.x,
        y: frame.texturedPosition.y,
        z: frame.texturedPosition.z,
        width: frame.texturedAperture.width,
        height: frame.texturedAperture.height,
        rotationX: frame.texturedTiltX
      });
    });
    renderPhotoFrames();
    return getAllPhotoCalibrations();
  }

  function render() {
    petalRain.uniforms.uTime.value = performance.now() / 1000;
    renderer.render(scene, camera);
  }

  function loadHeroFlowers() {
    if (!heroFlowersPromise) {
      heroFlowersPromise = new Promise((resolve, reject) => {
        const flowersUrl = mobileProfile ? HERO_FLOWERS_MOBILE_URL : HERO_FLOWERS_DESKTOP_URL;
        new GLTFLoader().load(flowersUrl, gltf => {
          heroFlowers = gltf.scene;
          const sparkPrototype = heroFlowers.getObjectByName('flower-spark-prototype');
          if (sparkPrototype?.isMesh) {
            flowerSparkInstances = new THREE.InstancedMesh(
              sparkPrototype.geometry,
              sparkPrototype.material,
              MAX_FLOWER_COUNT * FLOWER_SPARKS_PER_BURST
            );
            flowerSparkInstances.name = 'flower-spark-instances';
            flowerSparkInstances.count = 0;
            flowerSparkInstances.frustumCulled = false;
            flowerSparkInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            sparkPrototype.removeFromParent();
            heroFlowers.add(flowerSparkInstances);
          }
          altar.add(heroFlowers);
          applyFlowerVisibility();
          render();
          resolve(heroFlowers);
        }, undefined, reject);
      }).catch(error => {
        heroFlowersPromise = null;
        throw error;
      });
    }
    return heroFlowersPromise;
  }

  function startFlowerSprout(flower, number, order) {
    const baseY = flower.position.y;
    flower.userData.flowerBaseY = baseY;
    flower.userData.flowerShown = true;
    flower.visible = true;
    flower.scale.setScalar(0);
    flower.position.y = baseY - .14;
    flowerSprouts.set(number, {
      flower,
      baseY,
      startAt: performance.now() + order * FLOWER_SPROUT_STAGGER
    });
  }

  function updateFlowerSprouts(timestamp) {
    if (!flowerSprouts.size) {
      if (flowerSparkInstances) {
        flowerSparkInstances.count = 0;
        flowerSparkInstances.visible = false;
      }
      return false;
    }

    let sparkIndex = 0;
    for (const [number, sprout] of flowerSprouts) {
      const elapsed = timestamp - sprout.startAt;
      if (elapsed < 0) continue;

      const progress = THREE.MathUtils.clamp(elapsed / FLOWER_SPROUT_DURATION, 0, 1);
      const inverse = progress - 1;
      const bounceScale = 1 + 2.70158 * inverse ** 3 + 1.70158 * inverse ** 2;
      sprout.flower.scale.setScalar(Math.max(0, bounceScale));
      const rise = THREE.MathUtils.clamp(elapsed / 290, 0, 1);
      sprout.flower.position.y = sprout.baseY - .14 * (1 - rise);

      const sparkProgress = THREE.MathUtils.clamp((elapsed - 110) / 460, 0, 1);
      if (elapsed >= 110 && elapsed < 570 && flowerSparkInstances) {
        const travel = .11 + sparkProgress * .24;
        const sparkCount = mobileProfile ? 2 : FLOWER_SPARKS_PER_BURST;
        for (let particle = 0; particle < sparkCount; particle += 1) {
          const seed = number * 1.618 + particle * (Math.PI * 2 / sparkCount);
          const angle = seed + sprout.flower.rotation.y;
          const size = (1 - sparkProgress) * (.78 + .22 * Math.sin(seed * 2));
          flowerSparkTransform.position.set(
            sprout.flower.position.x + Math.cos(angle) * travel,
            sprout.baseY + .10 + sparkProgress * (.23 + .04 * Math.sin(seed)),
            sprout.flower.position.z + Math.sin(angle) * travel
          );
          flowerSparkTransform.rotation.set(
            seed * .25 + sparkProgress * 4,
            seed + sparkProgress * 3,
            seed * .6 - sparkProgress * 5
          );
          flowerSparkTransform.scale.setScalar(size);
          flowerSparkTransform.updateMatrix();
          flowerSparkInstances.setMatrixAt(sparkIndex, flowerSparkTransform.matrix);
          sparkIndex += 1;
        }
      }

      if (progress >= 1) {
        sprout.flower.scale.setScalar(1);
        sprout.flower.position.y = sprout.baseY;
        flowerSprouts.delete(number);
      }
    }

    if (flowerSparkInstances) {
      flowerSparkInstances.count = sparkIndex;
      flowerSparkInstances.visible = sparkIndex > 0;
      if (sparkIndex) flowerSparkInstances.instanceMatrix.needsUpdate = true;
    }
    return flowerSprouts.size > 0;
  }

  function completeFlowerSprouts() {
    flowerSprouts.forEach(({ flower, baseY }) => {
      flower.scale.setScalar(1);
      flower.position.y = baseY;
    });
    flowerSprouts.clear();
    if (flowerSparkInstances) {
      flowerSparkInstances.count = 0;
      flowerSparkInstances.visible = false;
    }
  }

  function applyFlowerVisibility() {
    if (!heroFlowers) return;
    const visibleCount = THREE.MathUtils.clamp(
      Math.floor(heroMode ? heroFlowerCount : FINAL_ALTAR_FLOWER_COUNT),
      0,
      MAX_FLOWER_COUNT
    );
    let sproutOrder = 0;
    heroFlowers.children.forEach(flower => {
      const match = flower.name.match(/^flower-(\d+)$/);
      if (!match) return;
      const number = Number(match[1]);
      const shouldShow = number > 0 && number <= visibleCount;
      if (shouldShow && !flower.userData.flowerShown) {
        startFlowerSprout(flower, number, sproutOrder);
        sproutOrder += 1;
      } else if (!shouldShow) {
        flowerSprouts.delete(number);
        if (flower.userData.flowerShown) {
          flower.position.y = flower.userData.flowerBaseY ?? flower.position.y;
          flower.scale.setScalar(1);
          flower.userData.flowerShown = false;
        }
        flower.visible = false;
      }
    });
    heroFlowers.visible = activeModelKind === 'textured';
    if (flowerSprouts.size) scheduleAnimation();
    else if (flowerSparkInstances) {
      flowerSparkInstances.count = 0;
      flowerSparkInstances.visible = false;
    }
  }

  function setHeroFlowerCount(count) {
    heroFlowerCount = THREE.MathUtils.clamp(Math.floor(Number(count) || 0), 0, MAX_FLOWER_COUNT);
    if (!heroMode) return Promise.resolve(heroFlowerCount);
    return loadHeroFlowers().then(() => {
      applyFlowerVisibility();
      render();
      return heroFlowerCount;
    });
  }

  function setHeroMode(enabled) {
    heroMode = Boolean(enabled);
    if (heroMode) {
      const clampToHeroArc = angle => THREE.MathUtils.clamp(
        Math.atan2(Math.sin(angle), Math.cos(angle)),
        -MAX_SCENE_ROTATION,
        MAX_SCENE_ROTATION
      );
      stage.rotation.y = clampToHeroArc(stage.rotation.y);
      targetRotation = clampToHeroArc(targetRotation);
    }
    if (activeModelKind !== 'textured') {
      if (heroFlowers) heroFlowers.visible = false;
      render();
      return Promise.resolve(false);
    }
    return loadHeroFlowers().then(group => {
      applyFlowerVisibility();
      render();
      scheduleAnimation();
      return group.visible;
    });
  }

  function clearPhotoCards() {
    photoCards.forEach(card => {
      photoGroup.remove(card);
      card.geometry.dispose();
      card.material.dispose();
    });
    photoCards = [];
    photoTextures.flat().forEach(texture => texture.dispose());
    photoTextures = [];
  }

  function applyCarouselStep(step) {
    if (selectedImages.length <= photoFrames.length) return;
    photoCards.forEach((card, cardIndex) => {
      const imageIndex = (step * photoFrames.length + cardIndex) % selectedImages.length;
      card.material.map = photoTextures[imageIndex][card.userData.frameIndex];
      card.material.needsUpdate = true;
    });
    activeCarouselStep = step;
  }

  function renderPhotoFrames() {
    clearPhotoCards();
    const placement = modelPlacements.get(activeModelKind);
    if (!placement || !selectedImages.length) return;

    const mappedFrames = photoFrames.map(frame => ({
      ...frame,
      modelPosition: activeModelKind === 'textured'
        ? photoCalibration.get(frame.id)
        : {
          x: remapModelCoordinate(frame.position.x, ALTAR_STL_BOUNDS.minX, ALTAR_STL_BOUNDS.maxX, placement.bounds.min.x, placement.bounds.max.x),
          y: placement.upAxis === 'y'
            ? remapModelCoordinate(frame.position.z, ALTAR_STL_BOUNDS.minZ, ALTAR_STL_BOUNDS.maxZ, placement.bounds.min.y, placement.bounds.max.y)
            : remapModelCoordinate(frame.position.y, ALTAR_STL_BOUNDS.minY, ALTAR_STL_BOUNDS.maxY, placement.bounds.min.y, placement.bounds.max.y),
          z: placement.upAxis === 'y'
            ? remapModelCoordinate(frame.position.y, ALTAR_STL_BOUNDS.minY, ALTAR_STL_BOUNDS.maxY, placement.bounds.min.z, placement.bounds.max.z)
            : remapModelCoordinate(frame.position.z, ALTAR_STL_BOUNDS.minZ, ALTAR_STL_BOUNDS.maxZ, placement.bounds.min.z, placement.bounds.max.z)
        },
      aperture: activeModelKind === 'textured'
        ? photoCalibration.get(frame.id)
        : {
          width: frame.aperture.width * placement.size.x / (ALTAR_STL_BOUNDS.maxX - ALTAR_STL_BOUNDS.minX),
          height: frame.aperture.height * placement.size[placement.upAxis] / (ALTAR_STL_BOUNDS.maxZ - ALTAR_STL_BOUNDS.minZ)
        },
      rotationX: activeModelKind === 'textured'
        ? photoCalibration.get(frame.id).rotationX
        : 0
    }));
    photoTextures = selectedImages.map(image => mappedFrames.map(frame =>
      createPhotoTexture(image, frame.aperture.width / frame.aperture.height)
    ));

    let frameIndexes;
    if (selectedImages.length === 1) frameIndexes = [1];
    else if (selectedImages.length === 2) frameIndexes = [0, 2];
    else frameIndexes = [0, 1, 2];

    frameIndexes.forEach((frameIndex, cardIndex) => {
      const frame = mappedFrames[frameIndex];
      const imageIndex = selectedImages.length > photoFrames.length
        ? (cardIndex % selectedImages.length)
        : cardIndex;
      const card = new THREE.Mesh(
        new THREE.PlaneGeometry(
          frame.aperture.width * placement.scale,
          frame.aperture.height * placement.scale
        ),
        new THREE.MeshStandardMaterial({
          map: photoTextures[imageIndex][frameIndex],
          side: THREE.DoubleSide,
          roughness: .82
        })
      );
      card.userData.frameIndex = frameIndex;
      card.rotation.x = frame.rotationX;
      const { scale, centerX, centerY, centerZ, minHeight, upAxis } = placement;
      card.position.set(
        (frame.modelPosition.x - centerX) * scale,
        (frame.modelPosition[upAxis] - minHeight) * scale,
        upAxis === 'y'
          ? (frame.modelPosition.z - centerZ) * scale
          : (centerY - frame.modelPosition.y) * scale
      );
      photoGroup.add(card);
      photoCards.push(card);
    });

    carouselStartedAt = Date.now();
    activeCarouselStep = 0;
    render();
  }

  function setDedication(value = '') {
    dedication = String(value).trim().slice(0, 180);
    if (dedicationOverlay) dedicationOverlay.textContent = dedication;
    render();
    return dedication;
  }

  function drawDedication(context, value) {
    if (!value) return;
    const width = context.canvas.width;
    const height = context.canvas.height;
    const shade = context.createLinearGradient(0, height * .72, 0, height);
    shade.addColorStop(0, 'rgba(20, 10, 19, 0)');
    shade.addColorStop(1, 'rgba(20, 10, 19, .82)');
    context.fillStyle = shade;
    context.fillRect(0, height * .72, width, height * .28);

    const maxWidth = width * .82;
    const lines = [];
    let line = '';
    value.split(/\s+/).forEach(word => {
      const candidate = line ? `${line} ${word}` : word;
      context.font = 'italic 48px Georgia, serif';
      if (context.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    });
    if (line) lines.push(line);
    const visibleLines = lines.slice(0, 3);
    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = 'italic 48px Georgia, serif';
    context.fillStyle = '#ffd58a';
    context.shadowColor = 'rgba(20, 8, 16, .9)';
    context.shadowBlur = 16;
    const lineHeight = 58;
    const firstY = height * .9 - ((visibleLines.length - 1) * lineHeight) / 2;
    visibleLines.forEach((text, index) => {
      const shortened = text.length > 80 ? `${text.slice(0, 77)}…` : text;
      context.fillText(shortened, width / 2, firstY + index * lineHeight, maxWidth);
    });
    context.restore();
  }

  function setImages(images = []) {
    selectedImages = images.slice(0, 5);
    renderPhotoFrames();
    scheduleAnimation();
  }

  const status = document.querySelector('#altarModelStatus');
  function setModelStatus(message) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
  }

  function installModel(kind, object, bounds, upAxis) {
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const scale = 5.65 / size[upAxis];
    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const centerY = (bounds.min.y + bounds.max.y) / 2;
    const centerZ = (bounds.min.z + bounds.max.z) / 2;
    const minHeight = bounds.min[upAxis];
    const wrapper = new THREE.Group();
    wrapper.add(object);
    wrapper.scale.setScalar(scale);
    if (upAxis === 'z') {
      wrapper.rotation.x = -Math.PI / 2;
      wrapper.position.set(-centerX * scale, -bounds.min.z * scale, centerY * scale);
    } else {
      wrapper.position.set(-centerX * scale, -bounds.min.y * scale, -centerZ * scale);
    }
    wrapper.visible = false;
    altar.add(wrapper);

    modelInstances.set(kind, wrapper);
    modelPlacements.set(kind, {
      bounds: bounds.clone(),
      size,
      scale,
      centerX,
      centerY,
      centerZ,
      minHeight,
      upAxis
    });
  }

  function loadTexture(url, colorSpace, manager) {
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader(manager).load(
        url,
        texture => {
          texture.colorSpace = colorSpace;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.anisotropy = mobileProfile
            ? Math.min(2, renderer.capabilities.getMaxAnisotropy())
            : renderer.capabilities.getMaxAnisotropy();
          resolve(texture);
        },
        undefined,
        reject
      );
    });
  }

  async function loadTexturedModel(onProgress) {
    setModelStatus('Cargando altar texturizado…');
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => onProgress?.(10 + Math.round(40 * loaded / total));
    // Mantener la malla OBJ original evita las diferencias de UV que aparecían
    // en algunos móviles con el GLB convertido.
    const objectPromise = new Promise((resolve, reject) => {
      new OBJLoader(manager).load(TEXTURED_MODEL_URL, resolve, undefined, reject);
    });
    const diffuseUrl = mobileProfile ? MOBILE_DIFFUSE_URL : TEXTURED_DIFFUSE_URL;
    const normalUrl = mobileProfile ? MOBILE_NORMAL_URL : TEXTURED_NORMAL_URL;
    const roughnessUrl = mobileProfile ? MOBILE_ROUGHNESS_URL : TEXTURED_ROUGHNESS_URL;
    const [object, diffuseMap, normalMap, roughnessMap] = await Promise.all([
      objectPromise,
      loadTexture(diffuseUrl, THREE.SRGBColorSpace, manager),
      loadTexture(normalUrl, THREE.NoColorSpace, manager),
      loadTexture(roughnessUrl, THREE.NoColorSpace, manager)
    ]);

    const material = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: diffuseMap,
      normalMap,
      roughnessMap,
      roughness: .9,
      metalness: 0,
      side: THREE.DoubleSide
    });
    material.normalScale.set(.28, .28);
    object.traverse(child => {
      if (!child.isMesh) return;
      if (Array.isArray(child.material)) child.material.forEach(item => item.dispose());
      else child.material?.dispose();
      child.material = material;
      child.castShadow = true;
      child.receiveShadow = true;
    });

    const bounds = new THREE.Box3().setFromObject(object);
    // El OBJ exportado ya tiene Y vertical y Z hacia el frente; no lleva la
    // rotación de 90° que necesita el STL con Z vertical.
    installModel('textured', object, bounds, 'y');
  }

  async function loadDetailedModel(onProgress) {
    setModelStatus('Cargando modelo STL detallado…');
    const geometry = await new Promise((resolve, reject) => {
      new STLLoader().load(
        MODEL_URL,
        resolve,
        event => {
          if (event.lengthComputable && event.total > 0) {
            const progress = Math.round(event.loaded / event.total * 100);
            setModelStatus(`Cargando STL detallado… ${progress}%`);
            onProgress?.(10 + Math.round(progress * .4));
          }
        },
        reject
      );
    });
    geometry.computeBoundingBox();
    const mesh = new THREE.Mesh(geometry, createAltarMaterial());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    installModel('detailed', mesh, geometry.boundingBox, 'z');
  }

  async function ensureModelLoaded(kind, onProgress) {
    if (modelInstances.has(kind)) {
      onProgress?.(50);
      return;
    }
    if (!modelPromises.has(kind)) {
      const promise = kind === 'textured' ? loadTexturedModel(onProgress) : loadDetailedModel(onProgress);
      modelPromises.set(kind, promise);
    }
    try {
      await modelPromises.get(kind);
    } catch (error) {
      modelPromises.delete(kind);
      throw error;
    }
  }

  async function setModelVariant(kind, onProgress) {
    if (kind !== 'textured' && kind !== 'detailed') {
      throw new Error(`Variante de modelo desconocida: ${kind}`);
    }
    if (capturingPhotoSession) throw new Error('Espera a que termine la sesión de fotos para cambiar de modelo.');
    const requestId = ++modelSelectionRequest;
    if (activeModelKind === kind && modelInstances.has(kind)) {
      onProgress?.(50);
      return kind;
    }

    try {
      await ensureModelLoaded(kind, onProgress);
      await floorTextureReady;
      if (kind === 'textured') await loadHeroFlowers();
      if (requestId !== modelSelectionRequest) return activeModelKind;
      modelInstances.forEach((instance, name) => { instance.visible = name === kind; });
      activeModelKind = kind;
      applyFlowerVisibility();
      window.dispatchEvent(new CustomEvent('altar:modelchange', {
        detail: { kind, dimensions: getModelDimensions(kind) }
      }));
      renderPhotoFrames();
      if (status) status.hidden = true;
      render();
      scheduleAnimation();
      return kind;
    } catch (error) {
      console.error(`No se pudo cargar la variante ${kind}:`, error);
      setModelStatus(kind === 'textured'
        ? 'No se pudo cargar el altar texturizado.'
        : 'No se pudo cargar el modelo STL detallado.');
      throw error;
    }
  }

  function getModelDimensions(kind = activeModelKind) {
    const placement = modelPlacements.get(kind);
    if (!placement) return null;
    const { size, scale, upAxis } = placement;
    return upAxis === 'z'
      ? { width: size.x * scale * altarScale, height: size.z * scale * altarScale, depth: size.y * scale * altarScale }
      : { width: size.x * scale * altarScale, height: size.y * scale * altarScale, depth: size.z * scale * altarScale };
  }

  canvas.addEventListener('pointerdown', event => {
    if (capturingPhotoSession || (event.pointerType === 'mouse' && heroMode)) return;
    dragging = true;
    lastX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
    scheduleAnimation();
  });
  canvas.addEventListener('pointermove', event => {
    if (!dragging || capturingPhotoSession) return;
    const movement = event.clientX - lastX;
    lastX = event.clientX;
    const nextRotation = targetRotation + movement * .008;
    targetRotation = heroMode
      ? THREE.MathUtils.clamp(nextRotation, -MAX_SCENE_ROTATION, MAX_SCENE_ROTATION)
      : nextRotation;
    scheduleAnimation();
  });
  const stopDragging = () => { dragging = false; };
  canvas.addEventListener('pointerup', stopDragging);
  canvas.addEventListener('pointercancel', stopDragging);
  canvas.addEventListener('lostpointercapture', stopDragging);

  window.addEventListener('pointermove', event => {
    if (heroMode && !mobileProfile && event.pointerType === 'mouse' && !capturingPhotoSession) {
      const horizontalProgress = THREE.MathUtils.clamp(event.clientX / window.innerWidth, 0, 1);
      targetRotation = (horizontalProgress * 2 - 1) * MAX_SCENE_ROTATION;
      scheduleAnimation();
    }
  });

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
    scheduleAnimation();
  }

  let animationFrameId = null;
  let canvasInViewport = false;
  let lastRenderedAt = 0;
  let lastAnimationTime = 0;
  const canRender = () => !document.hidden && canvasInViewport && canvas.clientWidth > 0 && canvas.clientHeight > 0;

  function stopAnimationLoop() {
    if (animationFrameId === null) return;
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  function scheduleAnimation() {
    if (animationFrameId !== null || !canRender()) return;
    animationFrameId = requestAnimationFrame(animate);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const intersectionObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(entries => {
      canvasInViewport = Boolean(entries[0]?.isIntersecting);
      if (canvasInViewport) {
        render();
        scheduleAnimation();
      } else stopAnimationLoop();
    })
    : null;
  if (intersectionObserver) intersectionObserver.observe(canvas.parentElement || canvas);
  else canvasInViewport = true;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAnimationLoop();
    else scheduleAnimation();
  });
  resize();

  function animate(timestamp) {
    animationFrameId = null;
    if (!canRender()) return;
    const viewIsMoving = dragging
      || flowerSprouts.size > 0
      || Math.abs(stage.rotation.y - targetRotation) > .001
      || selectedImages.length > photoFrames.length;
    const mobileFrameInterval = mobileProfile
      ? 1000 / (petalRain.enabled && !viewIsMoving ? 12 : 24)
      : 0;
    if (mobileProfile && timestamp - lastRenderedAt < mobileFrameInterval) {
      scheduleAnimation();
      return;
    }
    const deltaSeconds = lastAnimationTime
      ? Math.min((timestamp - lastAnimationTime) / 1000, .1)
      : 1 / 60;
    lastRenderedAt = timestamp;
    lastAnimationTime = timestamp;
    if (!mobileProfile) {
      const time = timestamp * .001;
      candleLights.forEach(({ light, phase }) => {
        // El parpadeo completo se conserva en escritorio; móvil usa luz estable.
        light.intensity = 2.6 + Math.sin(time * 7 + phase) * .16 + Math.sin(time * 13 + phase * 2) * .08;
      });
    }
    if (!capturingPhotoSession) {
      stage.rotation.y += (targetRotation - stage.rotation.y) * .06;
      if (selectedImages.length > photoFrames.length) {
        const step = Math.floor((Date.now() - carouselStartedAt) / 4500);
        if (step !== activeCarouselStep) applyCarouselStep(step);
      }
    }
    const flowerAnimationActive = !capturingPhotoSession && updateFlowerSprouts(timestamp);
    render();
    const modelReady = modelInstances.has(activeModelKind);
    const isTurning = Math.abs(stage.rotation.y - targetRotation) > .001;
    const shouldKeepAnimating = !capturingPhotoSession && (
      isTurning ||
      dragging ||
      flowerAnimationActive ||
      petalRain.enabled ||
      (!mobileProfile && !developerMode && modelReady) ||
      (modelReady && selectedImages.length > photoFrames.length)
    );
    if (shouldKeepAnimating) scheduleAnimation();
  }

  async function capturePhotoSession(onProgress) {
    await ensureModelLoaded(activeModelKind);
    if (activeModelKind === 'textured') {
      await loadHeroFlowers();
      applyFlowerVisibility();
      completeFlowerSprouts();
    }

    const backdrop = await loadModelBackdrop(mobileProfile ? MOBILE_MODEL_BACKDROP_URL : MODEL_BACKDROP_URL);
    const target = new THREE.Vector3(0, cameraTargetHeight, 0);
    const originalSize = renderer.getSize(new THREE.Vector2());
    const originalPixelRatio = renderer.getPixelRatio();
    const originalAspect = camera.aspect;
    const originalPosition = camera.position.clone();
    const originalQuaternion = camera.quaternion.clone();
    const originalRotation = stage.rotation.y;
    const originalTargetRotation = targetRotation;
    const originalCarouselStep = activeCarouselStep;
    const originalHeroFlowersVisibility = heroFlowers?.visible ?? false;
    const radius = camera.position.distanceTo(target);
    const output = document.createElement('canvas');
    output.width = photoSessionSize;
    output.height = photoSessionSize;
    const context = output.getContext('2d');
    const captures = [];

    capturingPhotoSession = true;
    stage.rotation.y = 0;
    targetRotation = 0;
    if (selectedImages.length > photoFrames.length) applyCarouselStep(0);

    try {
      renderer.setPixelRatio(1);
      renderer.setSize(photoSessionSize, photoSessionSize, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();

      for (const [viewIndex, view] of PHOTO_SESSION_VIEWS.entries()) {
        onProgress?.({ phase: 'start', index: viewIndex, total: PHOTO_SESSION_VIEWS.length, view });
        const azimuth = THREE.MathUtils.degToRad(view.azimuth);
        const elevation = THREE.MathUtils.degToRad(view.elevation);
        const horizontalRadius = radius * Math.cos(elevation);
        camera.position.set(
          target.x + horizontalRadius * Math.sin(azimuth),
          target.y + radius * Math.sin(elevation),
          target.z + horizontalRadius * Math.cos(azimuth)
        );
        camera.lookAt(target);
        camera.updateProjectionMatrix();
        render();
        await new Promise(requestAnimationFrame);
        render();

        context.fillStyle = '#211522';
        context.fillRect(0, 0, output.width, output.height);
        if (backdrop) {
          const scale = Math.max(output.width / backdrop.width, output.height / backdrop.height) * 1.12;
          const width = backdrop.width * scale;
          const height = backdrop.height * scale;
          context.filter = mobileProfile ? 'none' : 'blur(42px) brightness(.4) saturate(.72)';
          context.drawImage(backdrop, (output.width - width) / 2, (output.height - height) / 2, width, height);
          context.filter = 'none';
          context.fillStyle = 'rgba(15, 8, 16, .56)';
          context.fillRect(0, 0, output.width, output.height);
        }
        context.drawImage(canvas, 0, 0, output.width, output.height);
        drawDedication(context, dedication);

        const capture = {
          id: view.id,
          label: view.label,
          filename: `ofrenda-${view.id}.jpg`,
          parameterName: `photo_${view.id.replaceAll('-', '_')}`,
          blob: await canvasToJpeg(output, photoJpegQuality)
        };
        captures.push(capture);
        onProgress?.({
          phase: 'complete',
          index: viewIndex,
          total: PHOTO_SESSION_VIEWS.length,
          view,
          capture,
          completion: (viewIndex + 1) / PHOTO_SESSION_VIEWS.length
        });
      }
      return captures;
    } finally {
      renderer.setPixelRatio(originalPixelRatio);
      renderer.setSize(originalSize.x, originalSize.y, false);
      camera.aspect = originalAspect;
      camera.position.copy(originalPosition);
      camera.quaternion.copy(originalQuaternion);
      camera.updateProjectionMatrix();
      stage.rotation.y = originalRotation;
      targetRotation = originalTargetRotation;
      capturingPhotoSession = false;
      if (heroFlowers) {
        heroFlowers.visible = originalHeroFlowersVisibility || activeModelKind === 'textured';
        applyFlowerVisibility();
      }
      if (selectedImages.length > photoFrames.length) applyCarouselStep(originalCarouselStep);
      render();
      scheduleAnimation();
    }
  }

  return {
    setImages,
    setDedication,
    setModelVariant,
    setHeroMode,
    setHeroFlowerCount,
    getModelVariant: () => activeModelKind,
    getModelDimensions,
    getPhotoCalibration,
    getAllPhotoCalibrations,
    setPhotoCalibration,
    resetPhotoCalibration,
    capturePhotoSession,
    capture() {
      return new Promise((resolve, reject) => {
        try {
          render();
          canvas.toBlob(blob => {
            if (!blob) return reject(new Error('No se pudo generar la captura PNG'));
            resolve(blob);
          }, 'image/png');
        } catch (error) {
          reject(error);
        }
      });
    }
  };
}
