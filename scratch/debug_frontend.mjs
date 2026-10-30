// Debug test - capture ALL errors including uncaught Angular bootstrap errors
import { chromium } from 'playwright';

const BASE = 'http://localhost:4200';

async function run() {
  const browser = await chromium.launch({ headless: false }); // headful mode
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const allLogs = [];
  
  // Intercept ALL console output
  page.on('console', m => {
    allLogs.push(`CONSOLE[${m.type()}]: ${m.text()}`);
  });
  
  // Page errors (uncaught exceptions)
  page.on('pageerror', e => {
    allLogs.push(`PAGE_ERROR: ${e.message}\n${e.stack}`);
  });
  
  // Network failures
  page.on('requestfailed', req => {
    allLogs.push(`NET_FAIL: ${req.url()} | ${req.failure()?.errorText}`);
  });

  // Navigate and wait for network to settle
  await page.goto(`${BASE}/sign-in`);
  await page.waitForTimeout(8000);
  
  // Get full page source
  const source = await page.content();
  console.log('\n=== PAGE SOURCE (first 2000 chars) ===');
  console.log(source.slice(0, 2000));
  
  console.log('\n=== ALL LOGS ===');
  allLogs.forEach(l => console.log(l));
  
  // Try evaluate JS directly
  const jsError = await page.evaluate(() => {
    try {
      // Check if Angular is loaded
      const ng = window.ng;
      if (ng) return 'Angular object exists: ' + JSON.stringify(Object.keys(ng));
      return 'No window.ng object';
    } catch(e) { return 'eval error: ' + e.message; }
  });
  console.log('\nAngular check:', jsError);
  
  // Check app-root
  const rootCheck = await page.evaluate(() => {
    const el = document.querySelector('app-root');
    if (!el) return 'NO app-root element';
    return `app-root found: children=${el.children.length}, innerHTML="${el.innerHTML.slice(0, 200)}"`;
  });
  console.log('app-root check:', rootCheck);

  await page.screenshot({ path: 'f:/compliance tool/scratch/screenshots/debug.png', fullPage: true });
  
  await page.waitForTimeout(3000);
  await browser.close();
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
