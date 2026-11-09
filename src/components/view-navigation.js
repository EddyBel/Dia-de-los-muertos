export function setupViewNavigation({ mountHeroScene } = {}) {
  const homeView = document.querySelector('#homeView');
  const creationView = document.querySelector('#crear');
  const beginButton = document.querySelector('#beginCreation');
  const backButton = document.querySelector('#backToHome');
  if (!homeView || !creationView || !beginButton || !backButton) return;

  function show(view, { focus = true } = {}) {
    const isCreation = view === 'create';
    homeView.hidden = isCreation;
    creationView.hidden = !isCreation;
    document.documentElement.classList.toggle('is-home-view', !isCreation);
    document.body.classList.toggle('is-home-view', !isCreation);
    if (!isCreation) mountHeroScene?.();
    document.body.classList.toggle('is-creation-view', isCreation);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (focus) {
      requestAnimationFrame(() => {
        (isCreation ? document.querySelector('#name') : beginButton).focus({ preventScroll: true });
      });
    }
  }

  const initialView = location.hash === '#crear' ? 'create' : 'home';
  history.replaceState({ view: initialView }, '', location.href);
  show(initialView, { focus: false });

  beginButton.addEventListener('click', () => {
    history.pushState({ view: 'create', from: 'home' }, '', '#crear');
    show('create');
  });

  backButton.addEventListener('click', () => {
    if (history.state?.view === 'create' && history.state?.from === 'home') {
      history.back();
      return;
    }
    history.replaceState({ view: 'home' }, '', `${location.pathname}${location.search}`);
    show('home');
  });

  window.addEventListener('popstate', event => {
    show(event.state?.view || (location.hash === '#crear' ? 'create' : 'home'));
  });
}
