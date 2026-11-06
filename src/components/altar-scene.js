import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
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
const MODEL_BACKDROP_URL = new URL(
  '../../public/backgrounds/escena-modelo.jpg',
  import.meta.url
).href;
const PHOTO_SESSION_SIZE = 1600;

const PHOTO_SESSION_VIEWS = [
  { id: 'frontal', label: 'Vista frontal', azimuth: 0, elevation: 16 },
  { id: 'tres-cuartos-derecha', label: 'Tres cuartos derecha', azimuth: 38, elevation: 18 },
  { id: 'tres-cuartos-izquierda', label: 'Tres cuartos izquierda', azimuth: -38, elevation: 18 },
  { id: 'picado', label: 'Picado', azimuth: 0, elevation: 44 },
  { id: 'contrapicado', label: 'Contrapicado', azimuth: 0, elevation: -10 }
];

let modelBackdropPromise;

function loadModelBackdrop() {
  if (!modelBackdropPromise) {
    modelBackdropPromise = new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = MODEL_BACKDROP_URL;
    });
  }
  return modelBackdropPromise;
}

function canvasToJpeg(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar una captura de la ofrenda.'));
    }, 'image/jpeg', .94);
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
  const scene = new THREE.Scene();
  const stage = new THREE.Group();
  scene.add(stage);

  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  camera.position.set(0, 6.3, 12.2);
  camera.lookAt(0, 2.7, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  stage.add(new THREE.HemisphereLight(0xffd59b, 0x100a14, .3));
  const keyLight = new THREE.DirectionalLight(0xffc27b, 1.8);
  keyLight.position.set(-4.5, 7.5, 3.5);
  keyLight.castShadow = true;
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
  const candleLights = [
    [-.68, 3.55, 1.7], [.68, 3.55, 1.7],
    [-.72, 2.55, 2.05], [.72, 2.55, 2.05]
  ].map(([x, y, z], index) => {
    const candleLight = new THREE.PointLight(0xffa64f, 2.6, 3.8, 2);
    candleLight.position.set(x, y, z);
    stage.add(candleLight);
    return { light: candleLight, phase: index * 1.7 };
  });

  const altar = new THREE.Group();
  stage.add(altar);

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

  new THREE.TextureLoader().load(
    FLOOR_TEXTURE_URL,
    texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(22.5, 22.5);
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

      const bumpTexture = texture.clone();
      bumpTexture.colorSpace = THREE.NoColorSpace;
      bumpTexture.wrapS = THREE.RepeatWrapping;
      bumpTexture.wrapT = THREE.RepeatWrapping;
      bumpTexture.repeat.set(22.5, 22.5);
      bumpTexture.needsUpdate = true;

      floorMaterial.map = texture;
      floorMaterial.bumpMap = bumpTexture;
      floorMaterial.bumpScale = .024;
      floorMaterial.color.set('#ffffff');
      floorMaterial.needsUpdate = true;
      render();
    },
    undefined,
    error => console.error('No se pudo cargar la textura del piso:', error)
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
    renderer.render(scene, camera);
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

  function setImages(images = []) {
    selectedImages = images.slice(0, 5);
    renderPhotoFrames();
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

  function loadTexture(url, colorSpace) {
    return new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(
        url,
        texture => {
          texture.colorSpace = colorSpace;
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          resolve(texture);
        },
        undefined,
        reject
      );
    });
  }

  async function loadTexturedModel() {
    setModelStatus('Cargando altar texturizado…');
    const objLoader = new OBJLoader();
    const objectPromise = new Promise((resolve, reject) => {
      objLoader.load(TEXTURED_MODEL_URL, resolve, undefined, reject);
    });
    const [object, diffuseMap, normalMap, roughnessMap] = await Promise.all([
      objectPromise,
      loadTexture(TEXTURED_DIFFUSE_URL, THREE.SRGBColorSpace),
      loadTexture(TEXTURED_NORMAL_URL, THREE.NoColorSpace),
      loadTexture(TEXTURED_ROUGHNESS_URL, THREE.NoColorSpace)
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

  async function loadDetailedModel() {
    setModelStatus('Cargando modelo STL detallado…');
    const geometry = await new Promise((resolve, reject) => {
      new STLLoader().load(
        MODEL_URL,
        resolve,
        event => {
          if (event.lengthComputable && event.total > 0) {
            setModelStatus(`Cargando STL detallado… ${Math.round(event.loaded / event.total * 100)}%`);
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

  async function ensureModelLoaded(kind) {
    if (modelInstances.has(kind)) return;
    if (!modelPromises.has(kind)) {
      const promise = kind === 'textured' ? loadTexturedModel() : loadDetailedModel();
      modelPromises.set(kind, promise);
    }
    try {
      await modelPromises.get(kind);
    } catch (error) {
      modelPromises.delete(kind);
      throw error;
    }
  }

  async function setModelVariant(kind) {
    if (kind !== 'textured' && kind !== 'detailed') {
      throw new Error(`Variante de modelo desconocida: ${kind}`);
    }
    if (capturingPhotoSession) throw new Error('Espera a que termine la sesión de fotos para cambiar de modelo.');
    const requestId = ++modelSelectionRequest;
    if (activeModelKind === kind && modelInstances.has(kind)) return kind;

    try {
      await ensureModelLoaded(kind);
      if (requestId !== modelSelectionRequest) return activeModelKind;
      modelInstances.forEach((instance, name) => { instance.visible = name === kind; });
      activeModelKind = kind;
      renderPhotoFrames();
      if (status) status.hidden = true;
      render();
      return kind;
    } catch (error) {
      console.error(`No se pudo cargar la variante ${kind}:`, error);
      setModelStatus(kind === 'textured'
        ? 'No se pudo cargar el altar texturizado.'
        : 'No se pudo cargar el modelo STL detallado.');
      throw error;
    }
  }

  setModelVariant('textured').catch(() => {
    setModelStatus('No se pudo cargar el altar texturizado. Recarga la página para intentarlo otra vez.');
  });

  canvas.addEventListener('pointerdown', event => {
    dragging = true;
    lastX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!dragging) return;
    targetRotation += (event.clientX - lastX) * .008;
    lastX = event.clientX;
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  function animate() {
    requestAnimationFrame(animate);
    const time = performance.now() * .001;
    candleLights.forEach(({ light, phase }) => {
      // Variación leve e independiente para que la luz parezca provenir de llamas.
      light.intensity = 2.6 + Math.sin(time * 7 + phase) * .16 + Math.sin(time * 13 + phase * 2) * .08;
    });
    if (!capturingPhotoSession) {
      stage.rotation.y += (targetRotation - stage.rotation.y) * .06;
      if (!dragging && !developerMode) targetRotation += .0012;
      if (selectedImages.length > photoFrames.length) {
        const step = Math.floor((Date.now() - carouselStartedAt) / 4500);
        if (step !== activeCarouselStep) applyCarouselStep(step);
      }
    }
    render();
  }
  animate();

  async function capturePhotoSession() {
    await ensureModelLoaded(activeModelKind);

    const backdrop = await loadModelBackdrop();
    const target = new THREE.Vector3(0, 2.7, 0);
    const originalSize = renderer.getSize(new THREE.Vector2());
    const originalPixelRatio = renderer.getPixelRatio();
    const originalAspect = camera.aspect;
    const originalPosition = camera.position.clone();
    const originalQuaternion = camera.quaternion.clone();
    const originalRotation = stage.rotation.y;
    const originalTargetRotation = targetRotation;
    const originalCarouselStep = activeCarouselStep;
    const radius = camera.position.distanceTo(target);
    const output = document.createElement('canvas');
    output.width = PHOTO_SESSION_SIZE;
    output.height = PHOTO_SESSION_SIZE;
    const context = output.getContext('2d');
    const captures = [];

    capturingPhotoSession = true;
    stage.rotation.y = 0;
    targetRotation = 0;
    if (selectedImages.length > photoFrames.length) applyCarouselStep(0);

    try {
      renderer.setPixelRatio(1);
      renderer.setSize(PHOTO_SESSION_SIZE, PHOTO_SESSION_SIZE, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();

      for (const view of PHOTO_SESSION_VIEWS) {
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
          context.filter = 'blur(42px) brightness(.4) saturate(.72)';
          context.drawImage(backdrop, (output.width - width) / 2, (output.height - height) / 2, width, height);
          context.filter = 'none';
          context.fillStyle = 'rgba(15, 8, 16, .56)';
          context.fillRect(0, 0, output.width, output.height);
        }
        context.drawImage(canvas, 0, 0, output.width, output.height);

        captures.push({
          id: view.id,
          label: view.label,
          filename: `ofrenda-${view.id}.jpg`,
          parameterName: `photo_${view.id.replaceAll('-', '_')}`,
          blob: await canvasToJpeg(output)
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
      if (selectedImages.length > photoFrames.length) applyCarouselStep(originalCarouselStep);
      render();
    }
  }

  return {
    setImages,
    setModelVariant,
    getModelVariant: () => activeModelKind,
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
