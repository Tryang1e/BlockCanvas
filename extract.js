const fs = require('fs');
const path = require('path');

const backgrounds = ['bubble', 'fireworks', 'gradient', 'gravity-stars', 'hexagon', 'stars'];

backgrounds.forEach(bg => {
  const jsonPath = path.join('temp_animate_ui', 'apps', 'www', 'public', 'r', `components-backgrounds-${bg}.json`);
  if (!fs.existsSync(jsonPath)) {
    console.log('Not found:', jsonPath);
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  // The registry JSON usually has `files` array, each with `content`
  let content = '';
  if (data.files && data.files.length > 0) {
    content = data.files[0].content;
  }
  
  if (!content) {
    console.log('No content for', bg);
    return;
  }
  
  content = content.replace(/motion\/react/g, 'framer-motion');
  content = content.replace(/@workspace\/ui\/lib\/utils/g, '@/lib/utils');
  
  const dst = path.join('src', 'components', 'ui', 'backgrounds', `animate-${bg}.tsx`);
  fs.writeFileSync(dst, content, 'utf8');
  console.log('Extracted and Migrated:', bg);
});
