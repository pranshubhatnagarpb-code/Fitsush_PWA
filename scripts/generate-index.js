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
    <title>MKR Care — Client Portal</title>
    <link rel="stylesheet" href="/assets/${cssFile}" />
  </head>
  <body>
    <div id="root">
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#f0fdf4;color:#166534;font-family:system-ui,sans-serif;">
        <div style="font-size:1.5rem;font-weight:600;margin-bottom:1rem;">Loading wellness portal...</div>
        <div id="error" style="display:none;padding:1rem;background:#fef2f2;border:1px solid #fecaca;border-radius:0.5rem;color:#dc2626;max-width:400px;text-align:center;"></div>
      </div>
    </div>
    <script>
      window.addEventListener('error', function(e) {
        var err = document.getElementById('error');
        if (err) {
          err.style.display = 'block';
          err.textContent = 'Error: ' + (e.message || 'Unknown error');
        }
      });
      window.addEventListener('unhandledrejection', function(e) {
        var err = document.getElementById('error');
        if (err) {
          err.style.display = 'block';
          err.textContent = 'Promise Error: ' + (e.reason?.message || e.reason || 'Unknown');
        }
      });
    </script>
    <script type="module" src="/assets/${jsFile}"></script>
  </body>
</html>`;

fs.writeFileSync(path.join(clientDir, 'index.html'), indexHtml);
console.log(`Generated index.html with ${jsFile}`);