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
      // Look for settings-specific entry point
      const settingsJs = files.find(f => f.startsWith('settings-') && f.endsWith('.js'));
      const settingsCss = files.find(f => f.startsWith('settings-') && f.endsWith('.css'));
      // Also use SettingsPanel CSS if settings CSS not found
      const settingsPanelCss = files.find(f => f.startsWith('SettingsPanel-') && f.endsWith('.css'));

      console.log('Files in assets:', files);
      console.log('Found settingsJs:', settingsJs, 'settingsCss:', settingsCss, 'settingsPanelCss:', settingsPanelCss);

      if (settingsJs && fs.existsSync(settingsHtmlPath)) {
        const cssFile = settingsCss || settingsPanelCss;
        const cssLink = cssFile ? `<link rel="stylesheet" crossorigin href="../assets/${cssFile}">` : '';
        const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Desktop Todo - Settings</title>
  <script type="module" crossorigin src="../assets/${settingsJs}"></script>
  ${cssLink}
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
        fs.writeFileSync(settingsHtmlPath, html);
        console.log('Injected assets into settings.html:', settingsJs, settingsCss);
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
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});