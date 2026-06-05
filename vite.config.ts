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
        // Use SettingsPanel CSS for full styles, plus settings CSS for scrollbar hiding
        const settingsCssLink = settingsCss ? `<link rel="stylesheet" crossorigin href="../assets/${settingsCss}">` : '';
        const panelCssLink = settingsPanelCss ? `<link rel="stylesheet" crossorigin href="../assets/${settingsPanelCss}">` : '';
        const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mochi - Settings</title>
  <script type="module" crossorigin src="../assets/${settingsJs}"></script>
  ${settingsCssLink}
  ${panelCssLink}
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
        fs.writeFileSync(settingsHtmlPath, html);
        console.log('Injected assets into settings.html:', settingsJs, settingsCss, settingsPanelCss);
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