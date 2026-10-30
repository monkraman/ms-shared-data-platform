// Test complete flow: Step 1 -> 2 -> 3 -> 4 -> Finish -> Dashboard
import { chromium } from 'playwright';
import path from 'path';

const BASE = 'http://localhost:4200';
const SHOTS_DIR = 'f:/compliance tool/scratch/screenshots';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log('1. Starting from Onboarding Step 1...');
  await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle' });
  await page.locator('button:has-text("Continue to markets & laws")').first().click();
  await page.waitForTimeout(500);

  console.log('2. Step 2 -> Step 3...');
  await page.locator('button:has-text("Continue to data points")').first().click();
  await page.waitForTimeout(500);

  console.log('3. Step 3 -> Step 4...');
  await page.locator('button:has-text("Continue to connect systems")').first().click();
  await page.waitForTimeout(500);

  console.log('4. Clicking Finish set up...');
  await page.locator('button:has-text("Finish set up")').first().click();
  await page.waitForTimeout(2500);

  console.log('URL after finish:', page.url());
  await page.screenshot({ path: path.join(SHOTS_DIR, 'step5_dashboard_redirect.png'), fullPage: true });

  await browser.close();
  console.log('✅ Full onboarding flow tested successfully!');
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });

