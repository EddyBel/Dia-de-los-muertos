import { createAltar } from './components/altar-scene.js';
import { setupAltarControls } from './components/altar-controls.js';
import { startBackgroundSlideshow } from './components/background-slideshow.js';
import { setupMemoryForm } from './components/memory-form.js';

startBackgroundSlideshow();
const altar = createAltar(document.querySelector('#altar'));
setupAltarControls({ altar });
setupMemoryForm({ altar });
