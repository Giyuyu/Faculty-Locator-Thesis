import { chromium } from 'playwright-core';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5178';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const failures = [];

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForText(page, expected, timeout = 15000) {
  try {
    await page.waitForFunction(
      (text) => document.body?.innerText?.toLowerCase().includes(text.toLowerCase()),
      expected,
      { timeout },
    );
  } catch (error) {
    const snapshot = (await page.locator('body').innerText().catch(() => ''))
      .replace(/\s+/g, ' ')
      .slice(0, 900);
    throw new Error(`Missing “${expected}” on ${page.url()}. Page text: ${snapshot}`);
  }
}

async function login(browser, email, password) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem('quickStartSeen:admin', 'true');
    localStorage.setItem('quickStartSeen:faculty:v2', 'true');
    localStorage.setItem('quickStartSeen:student', 'true');
    localStorage.setItem('quickStartSeen:home', 'true');
    sessionStorage.removeItem('quickTourResume:faculty-v2');
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push(`${email}: ${error.message}`));
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });
  return { context, page };
}

async function assertPage(page, path, expectedTexts, rejectedTexts = []) {
  console.log(`CHECK ${path}: ${expectedTexts.join(', ')}`);
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  for (const text of expectedTexts) await waitForText(page, text);
  const body = (await page.locator('body').innerText()).toLowerCase();
  for (const text of rejectedTexts) {
    check(!body.includes(text.toLowerCase()), `${path} unexpectedly contained “${text}”.`);
  }
}

async function main() {
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  try {
    const faculty = await login(browser, 'faculty.local@sti.edu', 'Faculty@12345');
    await assertPage(faculty.page, '/faculty', ['Local Faculty', 'Local Room 101', 'Automation Systems', 'In Class']);
    await assertPage(faculty.page, '/room-tracker', ['Local Room 101', 'Local Faculty', 'Occupied']);
    await assertPage(faculty.page, '/faculty-schedules', ['Automation Systems', 'Scheduled Room 202', 'SMOKE-01']);
    console.log('PASS Faculty: live status, room override, subject, and own schedule');
    await faculty.context.close();

    const student = await login(browser, 'student.local@sti.edu', 'Student@12345');
    await assertPage(student.page, '/student', ['Local Faculty', 'Local Room 101', 'Automation Systems', 'In Class']);
    console.log('PASS Student: faculty live room and current subject');
    await student.context.close();

    const admin = await login(browser, 'admin@sti.edu', 'Admin@12345');
    await assertPage(admin.page, '/admin', ['Local Faculty', 'Local Room 101', 'In-Class']);
    console.log('PASS Admin: dashboard receives live faculty and room status');
    await admin.context.close();

    const kioskContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const kiosk = await kioskContext.newPage();
    kiosk.on('pageerror', (error) => failures.push(`kiosk: ${error.message}`));
    await kiosk.goto(`${baseUrl}/kiosk`, { waitUntil: 'networkidle' });
    const start = kiosk.getByRole('button', { name: /touch to start/i });
    if (await start.isVisible().catch(() => false)) await start.click();
    await waitForText(kiosk, 'Local Faculty');
    await waitForText(kiosk, 'Local Room 101');
    await waitForText(kiosk, 'Automation Systems');
    const roomsTab = kiosk.getByRole('button', { name: /^rooms$/i });
    if (await roomsTab.count()) await roomsTab.click();
    await waitForText(kiosk, 'Occupied');
    console.log('PASS Kiosk: public faculty and occupied-room views');
    await kioskContext.close();

    check(failures.length === 0, `Browser runtime errors: ${failures.join(' | ')}`);
    console.log('Cross-client web smoke test passed.');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`SMOKE TEST FAILED: ${error.message}`);
  process.exitCode = 1;
});
