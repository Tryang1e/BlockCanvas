const fs = require('fs');

const path = 'src/components/creator/DraggablePortfolio.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace bg-white with bg-white dark:bg-neutral-900
content = content.replace(/bg-white/g, 'bg-white dark:bg-neutral-900 dark:border-neutral-800 dark:text-white');
// Replace border-neutral-100 with border-neutral-100 dark:border-neutral-800
content = content.replace(/border-neutral-100(?! dark)/g, 'border-neutral-100 dark:border-neutral-800');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed DraggablePortfolio');

const cardPath = 'src/components/creator/ProjectCard.tsx';
let cardContent = fs.readFileSync(cardPath, 'utf8');
cardContent = cardContent.replace(/bg-neutral-100/g, 'bg-neutral-100 dark:bg-neutral-900');
cardContent = cardContent.replace(/border-neutral-100/g, 'border-neutral-100 dark:border-neutral-800');
fs.writeFileSync(cardPath, cardContent, 'utf8');
console.log('Fixed ProjectCard');
