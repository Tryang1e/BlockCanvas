const fs = require('fs');
const path = require('path');

function findFiles(dir, matchNames) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(fullPath, matchNames));
    } else {
      matchNames.forEach(name => {
        if (file === name) results.push(fullPath);
      });
    }
  });
  return results;
}

const filesToFind = ['bubble.tsx', 'fireworks.tsx', 'gradient.tsx', 'gravity-stars.tsx', 'hexagon.tsx', 'stars.tsx'];
const found = findFiles('temp_animate_ui', filesToFind);

found.forEach(src => {
  const file = path.basename(src);
  const dst = path.join('src', 'components', 'ui', 'backgrounds', 'animate-' + file);
  
  let content = fs.readFileSync(src, 'utf8');
  content = content.replace(/motion\/react/g, 'framer-motion');
  content = content.replace(/@workspace\/ui\/lib\/utils/g, '@/lib/utils');
  
  fs.writeFileSync(dst, content, 'utf8');
  console.log('Migrated:', file);
});
