// Playwright E2E test - Visual Verification of All 4 Onboarding Steps
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE = 'http://localhost:4200';
const SHOTS_DIR = 'f:/compliance tool/scratch/screenshots';

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

async function shot(page, name) {
  const p = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`📸 ${name} saved`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));

  console.log('1. Go to Onboarding (Step 1)...');
  await page.goto(`${BASE}/onboarding`, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1000);
  await shot(page, 'step1_company_profile');

  // Verify Step 1 fields
  const companyName = await page.$eval('input[formcontrolname="companyName"]', el => el.value).catch(() => 'NOT_FOUND');
  console.log('Step 1 Company Name:', companyName);

  // Click Step 2 button (any button containing "Continue to markets")
  console.log('2. Proceeding to Step 2 (Markets & Laws)...');
  await page.locator('button:has-text("Continue to markets & laws")').first().click();
  await page.waitForTimeout(1000);
  await shot(page, 'step2_markets_and_laws');

  // Click Step 3 button
  console.log('3. Proceeding to Step 3 (Data Points)...');
  await page.locator('button:has-text("Continue to data points")').first().click();
  await page.waitForTimeout(1000);
  await shot(page, 'step3_data_points');

  // Click Step 4 button
  console.log('4. Proceeding to Step 4 (Connect Systems)...');
  await page.locator('button:has-text("Continue to connect systems")').first().click();
  await page.waitForTimeout(1000);
  await shot(page, 'step4_connect_systems');

  // Check Finish Setup button
  const finishBtn = await page.$('button:has-text("Finish Setup")');
  console.log('Finish Setup button found on Step 4:', !!finishBtn);

  console.log('\nErrors encountered:', errors.length ? errors : 'None! ✅');

  await browser.close();
  console.log('✅ All 4 steps captured successfully!');
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
