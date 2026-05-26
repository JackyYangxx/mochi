import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function injectSettingsAssets() {
  let buildStarted = false;

  return {
    name: 'inject-settings-assets',
    apply: 'build',
    buildStart() {
      buildStarted = true;
    },
    closeBundle() {
      if (!buildStarted) return;

      const distDir = path.join(__dirname, 'dist-renderer');
      const settingsHtmlPath = path.join(distDir, 'src-renderer', 'settings.html');
      const assetsDir = path.join(distDir, 'assets');

      if (!fs.existsSync(assetsDir)) {
        console.log('Assets dir not found');
        return;
      }

      const files = fs.readdirSync(assetsDir);
      const settingsJs = files.find(f => f.startsWith('settings-') && f.endsWith('.js'));
      const mainJs = files.find(f => f.startsWith('main-') && f.endsWith('.js'));
      const settingsCss = files.find(f => f.startsWith('settings-') && f.endsWith('.css'));
      const mainCss = files.find(f => f.startsWith('main-') && f.endsWith('.css'));

      const jsFile = settingsJs || mainJs;
      const cssFile = settingsCss || mainCss;

      console.log('Files in assets:', files);
      console.log('Found jsFile:', jsFile, 'cssFile:', cssFile);

      if (jsFile && fs.existsSync(settingsHtmlPath)) {
        const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Desktop Todo - Settings</title>
  <script type="module" crossorigin src="../assets/${jsFile}"></script>
  ${cssFile ? `<link rel="stylesheet" crossorigin href="../assets/${cssFile}">` : ''}
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