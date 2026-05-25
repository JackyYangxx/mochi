import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function injectSettingsAssets() {
  return {
    name: 'inject-settings-assets',
    apply: 'build',
    writeBundle(options) {
      const distDir = options.dir;
      const assetsDir = path.join(distDir, 'assets');
      const settingsHtmlPath = path.join(distDir, 'src-renderer', 'settings.html');

      // Find settings-related JS files (excluding main)
      const files = fs.readdirSync(assetsDir);
      const settingsJs = files.find(f => f.startsWith('settings-') && f.endsWith('.js'));
      const settingsCss = files.find(f => f.startsWith('settings-') && f.endsWith('.css'));

      // Use settings JS if found, otherwise use main JS
      const jsFile = settingsJs || files.find(f => f.startsWith('main-') && f.endsWith('.js'));
      // Use settings CSS if found, otherwise use main CSS
      const cssFile = settingsCss || files.find(f => f.startsWith('main-') && f.endsWith('.css'));

      if (jsFile && cssFile && fs.existsSync(settingsHtmlPath)) {
        const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Desktop Todo - Settings</title>
  <script type="module" crossorigin src="./assets/${jsFile}"></script>
  <link rel="stylesheet" crossorigin href="./assets/${cssFile}">
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
        fs.writeFileSync(settingsHtmlPath, html);
        console.log('Injected assets into settings.html:', jsFile, cssFile);
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), injectSettingsAssets()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist-renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        settings: path.resolve(__dirname, 'src-renderer/settings.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});