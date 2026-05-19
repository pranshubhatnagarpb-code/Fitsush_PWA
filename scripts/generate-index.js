import fs from 'fs';
import path from 'path';

const clientDir = path.join(process.cwd(), 'dist', 'client');
const assetsDir = path.join(clientDir, 'assets');

const files = fs.readdirSync(assetsDir);

const jsFiles = files.filter(f => f.startsWith('index-') && f.endsWith('.js'));
const cssFile = files.find(f => f.startsWith('styles-') && f.endsWith('.css'));

jsFiles.sort((a, b) => {
  const statA = fs.statSync(path.join(assetsDir, a));
  const statB = fs.statSync(path.join(assetsDir, b));
  return statB.size - statA.size;
});

const jsFile = jsFiles[0];

if (!jsFile || !cssFile) {
  console.error('Could not find JS or CSS files');
  process.exit(1);
}

const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Loading...</title>
    <link rel="stylesheet" href="/assets/${cssFile}" />
    <script>
      window.__INITIAL__ = true;
    </script>
  </head>
  <body>
    <div id="root"><div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0fdf4;color:#166534;">Loading wellness portal...</div></div>
    <script type="module" src="/assets/${jsFile}"></script>
  </body>
</html>`;

fs.writeFileSync(path.join(clientDir, 'index.html'), indexHtml);
console.log(`Generated index.html with ${jsFile}`);