const fs = require('fs');
// Very simple PNG parser to get the bounding box of non-transparent pixels
// But parsing PNG IDAT is hard without a library.
// Instead, let's just write a script to install a tiny library like 'pngjs' and run it.
const { execSync } = require('child_process');
execSync('npm install pngjs', { stdio: 'inherit' });

const PNG = require('pngjs').PNG;

function getBoundingBox(filePath) {
  const data = fs.readFileSync(filePath);
  const png = PNG.sync.read(data);
  let minX = png.width, minY = png.height, maxX = 0, maxY = 0;
  
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) << 2;
      const alpha = png.data[idx + 3];
      if (alpha > 10) { // non-transparent
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  console.log(`${filePath}: minX=${minX}, minY=${minY}, maxX=${maxX}, maxY=${maxY}`);
}

getBoundingBox('c:\\Github\\BlockCanvas\\public\\logo_text.png');
getBoundingBox('c:\\Github\\BlockCanvas\\public\\logo_text_white.png');
