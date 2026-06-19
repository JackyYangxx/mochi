import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function injectWindowAssets() {
  let buildStarted = false;

  return {
    name: 'inject-window-assets',
    apply: 'build',
    buildStart() {
      buildStarted = true;
    },
    closeBundle() {
      if (!buildStarted) return;

      const distDir = path.join(__dirname, 'dist-renderer');
      const assetsDir = path.join(distDir, 'assets');

      if (!fs.existsSync(assetsDir)) {
        console.log('Assets dir not found');
        return;
      }

      const files = fs.readdirSync(assetsDir);

      // Settings window
      injectFor(files, distDir, path.join(distDir, 'src-renderer', 'settings.html'), 'settings', 'SettingsPanel');

      // Calendar window
      injectFor(files, distDir, path.join(distDir, 'src-renderer', 'calendar.html'), 'calendar', null);
    },
  };
}

function injectFor(
  files: string[],
  distDir: string,
  htmlPath: string,
  entryPrefix: string,
  cssFallbackPrefix: string | null
): void {
  if (!fs.existsSync(htmlPath)) return;
  const entryJs = files.find(f => f.startsWith(`${entryPrefix}-`) && f.endsWith('.js'));
  if (!entryJs) return;

  const entryCss = files.find(f => f.startsWith(`${entryPrefix}-`) && f.endsWith('.css'));
  const fallbackCss = cssFallbackPrefix
    ? files.find(f => f.startsWith(`${cssFallbackPrefix}-`) && f.endsWith('.css'))
    : undefined;

  const cssLinks = [
    entryCss ? `<link rel="stylesheet" crossorigin href="../assets/${entryCss}">` : '',
    fallbackCss ? `<link rel="stylesheet" crossorigin href="../assets/${fallbackCss}">` : '',
  ].filter(Boolean).join('\n  ');

  const title = entryPrefix === 'calendar' ? 'Mochi - Calendar' : 'Mochi - Settings';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script type="module" crossorigin src="../assets/${entryJs}"></script>
  ${cssLinks}
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
  fs.writeFileSync(htmlPath, html);
  console.log(`Injected assets into ${path.basename(htmlPath)}: ${entryJs}`);
}

export default defineConfig({
  plugins: [react(), injectWindowAssets()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist-renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        settings: path.resolve(__dirname, 'src-renderer/settings.html'),
        calendar: path.resolve(__dirname, 'src-renderer/calendar.html'),
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
