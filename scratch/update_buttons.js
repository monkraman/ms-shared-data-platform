const fs = require('fs');
const file = 'frontend/src/app/features/onboarding/onboarding.component.html';
let html = fs.readFileSync(file, 'utf8');

// Replace <span class="btn ...">...</span> with <button type="button" class="btn ...">...</button>
html = html.replace(/<span class="btn(.*?)"\s+\(click\)="([^"]+)"([^>]*)>([\s\S]*?)<\/span>/g,
  '<button type="button" class="btn$1" (click)="$2"$3>$4</button>');

fs.writeFileSync(file, html);
console.log('Successfully modernized wizard navigation to real button elements!');

