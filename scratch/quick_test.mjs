// Simple quick test
import { chromium } from 'playwright';
import fs from 'fs';

const SHOTS = 'f:/compliance tool/scratch/screenshots';
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

async function run() {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=BlockInsecurePrivateNetworkRequests']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`PAGE_ERROR: ${e.message}`));
  page.on('response', r => {
    if (!r.ok() && !r.url().includes('fonts')) {
      logs.push(`HTTP_ERR: ${r.status()} ${r.url()}`);
    }
  });

  // Try 127.0.0.1 instead of localhost
  await page.goto('http://127.0.0.1:4200/sign-in', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);
  
  // Check if angular rendered
  const info = await page.evaluate(() => {
    const appRoot = document.querySelector('app-root');
    const scripts = [...document.querySelectorAll('script')].map(s => s.src || s.type);
    return {
      appRootHTML: appRoot ? appRoot.innerHTML.slice(0, 300) : 'NOT FOUND',
      scriptTags: scripts,
      documentTitle: document.title,
      bodyChildCount: document.body.children.length,
      hasAngular: !!window.ng,
    };
  });
  
  console.log('Page info:', JSON.stringify(info, null, 2));
  console.log('\nLogs:');
  logs.forEach(l => console.log(l));

  await page.screenshot({ path: `${SHOTS}/quick_signin.png`, fullPage: true });
  await browser.close();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

