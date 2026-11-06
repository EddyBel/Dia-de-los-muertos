import * as THREE from 'three';

function createMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
}

function addBox(group, width, height, depth, x, y, z, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    createMaterial(color)
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addAltarDetails(altar) {
  addBox(altar, 7.2, .28, 2.2, 0, -1.45, 0, '#70452f');
  addBox(altar, 6.1, .24, 1.8, 0, -.72, -.12, '#a66a3e');
  addBox(altar, 4.7, .22, 1.5, 0, -.05, -.2, '#d29a53');

  for (const x of [-2.75, 2.75]) {
    addBox(altar, .28, .8, .28, x, -.88, .62, '#f4dfb0');
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(.09, .28, 12),
      new THREE.MeshBasicMaterial({ color: '#ffb52e' })
    );
    flame.position.set(x, -.28, .62);
    altar.add(flame);
    const candleLight = new THREE.PointLight(0xff9e36, 2.5, 3);
    candleLight.position.set(x, -.2, .8);
    altar.add(candleLight);
  }

  for (let i = 0; i < 18; i++) {
    const angle = i / 18 * Math.PI * 2;
    const x = Math.cos(angle) * 3.1;
    const z = Math.sin(angle) * .72;
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(.16, 12, 10), createMaterial('#ed8b16')
    );
    flower.scale.set(1, .55, 1);
    flower.position.set(x, -1.25, z);
    altar.add(flower);
    const center = new THREE.Mesh(
      new THREE.SphereGeometry(.07, 10, 8), createMaterial('#6c321b')
    );
    center.position.set(x, -1.20, z);
    altar.add(center);
  }

  for (let i = 0; i < 11; i++) {
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(.34, .42),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? '#c34b61' : '#e9a63b', side: THREE.DoubleSide
      })
    );
    paper.position.set(-3.3 + i * .66, 2.25, 0);
    altar.add(paper);
  }
}

function createPhotoTexture(image) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 640;
  const context = canvas.getContext('2d');
  context.fillStyle = '#d8b98c';
  context.fillRect(0, 0, 512, 640);
  context.fillStyle = '#fff8e9';
  context.fillRect(30, 30, 452, 520);

  if (image) {
    const targetWidth = 428;
    const targetHeight = 470;
    const sourceRatio = image.width / image.height;
    const targetRatio = targetWidth / targetHeight;
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
    context.save();
    context.beginPath();
    context.rect(42, 42, targetWidth, targetHeight);
    context.clip();
    context.drawImage(image, sx, sy, sw, sh, 42, 42, targetWidth, targetHeight);
    context.restore();
  } else {
    context.fillStyle = '#392439';
    context.fillRect(42, 42, 428, 470);
    context.fillStyle = '#f4b44d';
    context.font = '80px Georgia';
    context.textAlign = 'center';
    context.fillText('✦', 256, 280);
  }

  context.fillStyle = '#4b2a2b';
  context.font = 'italic 25px Georgia';
  context.textAlign = 'center';
  context.fillText('Con amor y memoria', 256, 578);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Las texturas 512×640 no son potencia de dos. Desactivar mipmaps evita
  // texturas incompletas en equipos que usan WebGL 1 y tarjetas vacías.
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function createAltar(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#211522');
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  camera.position.set(0, 1.5, 9.5);
  camera.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.AmbientLight(0xffd6a0, 1.6));
  const light = new THREE.PointLight(0xffa83d, 45, 30);
  light.position.set(0, 4, 5);
  scene.add(light);

  const altar = new THREE.Group();
  scene.add(altar);
  addAltarDetails(altar);
  const cardGroup = new THREE.Group();
  altar.add(cardGroup);
  let cards = [];
  let dragging = false;
  let lastX = 0;
  let targetRotation = 0;

  function render() { renderer.render(scene, camera); }

  function setImages(images = []) {
    cards.forEach(card => {
      cardGroup.remove(card);
      card.geometry.dispose();
      card.material.map?.dispose();
      card.material.dispose();
    });
    cards = [];
    const list = images.length ? images : [null, null, null];
    list.forEach((image, index) => {
      const texture = createPhotoTexture(image);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.22, 1.52),
        new THREE.MeshStandardMaterial({
          map: texture, side: THREE.DoubleSide, roughness: .85
        })
      );
      const spread = index - (list.length - 1) / 2;
      mesh.position.set(spread * 1.38, .85, Math.abs(spread) * -.08);
      mesh.rotation.y = spread * -.08;
      cardGroup.add(mesh);
      cards.push(mesh);
    });
    render();
  }

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
    altar.rotation.y += (targetRotation - altar.rotation.y) * .06;
    if (!dragging) targetRotation += .0015;
    cards.forEach((card, index) => {
      card.position.y = .85 + Math.sin(Date.now() * .001 + index) * .025;
    });
    render();
  }
  animate();
  setImages();

  return {
    setImages,
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
