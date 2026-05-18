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
    <link rel="icon" type="image/svg+xml" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="stylesheet" href="/assets/${cssFile}" />
    <title>Wellness Portal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${jsFile}"></script>
  </body>
</html>`;

fs.writeFileSync(path.join(clientDir, 'index.html'), indexHtml);
console.log(`Generated index.html with ${jsFile} (largest)`);