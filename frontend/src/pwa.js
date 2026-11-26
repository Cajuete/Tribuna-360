if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => Promise.all(
        registrations
          .filter(registration => registration.active?.scriptURL.endsWith('/service-worker.js'))
          .map(registration => registration.unregister())
      ))
      .then(() => caches.keys())
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith('tribuna360-shell-')).map(key => caches.delete(key))
      ))
      .catch(error => console.error('No se pudo limpiar la PWA en desarrollo:', error));
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .catch((error) => console.error('No se pudo registrar la PWA:', error));
    });
  }
}
