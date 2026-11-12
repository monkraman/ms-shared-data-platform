// Publishes the data point explorer (reference-docs-teams/datapoints-epr-ppwr-main) as-is at
// /datapoints/ by copying it into public/ before `ng serve` and `ng build`. The copy is gitignored;
// edit the reference folder, not the copy.
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../../reference-docs-teams/datapoints-epr-ppwr-main');
const dest = path.resolve(__dirname, '../public/datapoints');

fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(src, dest, { recursive: true, filter: (f) => !/(README\.md|\.gitignore)$/.test(f) });
console.log('Copied data point explorer to public/datapoints');
