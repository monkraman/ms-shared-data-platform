const fs = require('fs');
const file = 'frontend/src/app/features/onboarding/onboarding.component.html';
let html = fs.readFileSync(file, 'utf8');

// Strip newlines inside data:image URIs
html = html.replace(/src="data:image\/png;base64,([^"]+)"/g, (match, b64) => {
  return `src="data:image/png;base64,${b64.replace(/\s+/g, '')}"`;
});

fs.writeFileSync(file, html);
console.log('Cleaned base64 newlines successfully!');

