import { defineConfig } from 'vite';

export default defineConfig({
  // Multi-page application:
  //   /             → curriculum SPA (index.html at root)
  //   /vr/family-friends/concept-1/  → A Day in My Family VR experience
  //   /vr/family-friends/concept-2/  → Every Family Is Special VR experience
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main:     'index.html',
        concept1: 'vr/family-friends/concept-1/index.html',
        concept2: 'vr/family-friends/concept-2/index.html',
      }
    }
  }
});
