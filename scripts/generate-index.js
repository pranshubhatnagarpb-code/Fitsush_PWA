import fs from 'fs';
import path from 'path';

const clientDir = path.join(process.cwd(), 'dist', 'client');

const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="stylesheet" href="/assets/styles-CTehDJ6Y.css" />
    <title>Wellness Portal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-DmcGPtOl.js"></script>
  </body>
</html>`;

fs.writeFileSync(path.join(clientDir, 'index.html'), indexHtml);
console.log('Generated index.html');