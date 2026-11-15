# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Escáner offline

El escáner es instalable como PWA y conserva su app shell con un service worker, además de guardar en IndexedDB los partidos, entradas descargadas y escaneos pendientes. Antes del evento, el operador debe iniciar sesión, abrir `/scanner` con conexión y descargar las entradas del partido. Al reconectar, los escaneos se sincronizan automáticamente y también pueden sincronizarse manualmente.

La PWA requiere HTTPS en producción (localhost está permitido para desarrollo). Aplicar `backend/sql/015_offline_ticket_scanning.sql` en Supabase antes de usar la sincronización. El escaneo offline solo evita reusos en el mismo dispositivo; dos operadores desconectados pueden aceptar el mismo boleto y el conflicto se reportará cuando sincronicen. El service worker usa Cache API nativa; los endpoints de API no se almacenan en caché.

Para preparar la ubicación de futuros pases de Wallet, aplicar también `backend/sql/016_match_stadium_location.sql`. Los administradores pueden guardar la latitud y longitud del estadio al crear o editar un partido; ambos campos son opcionales, pero se deben indicar juntos.
