const fs = require('fs');

function getPngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  // PNG signature is 8 bytes. IHDR chunk starts at byte 8.
  // IHDR length is 4 bytes (bytes 8-11). Type is 'IHDR' (bytes 12-15).
  // Width is 4 bytes (bytes 16-19). Height is 4 bytes (bytes 20-23).
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  console.log(`${filePath}: ${width}x${height}`);
}

getPngDimensions('c:\\Github\\BlockCanvas\\public\\logo_text.png');
getPngDimensions('c:\\Github\\BlockCanvas\\public\\logo_text_white.png');
