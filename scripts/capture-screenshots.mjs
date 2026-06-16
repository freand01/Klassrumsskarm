import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';

const BASE_URL = 'http://localhost:8080/index.html';
const OUT_DIR = path.resolve('docs/manual/images');

async function shot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`Saved ${file}`);
}

async function openSubmenu(page, menuId) {
  await page.evaluate((id) => {
    document.querySelectorAll('.submenu').forEach((m) => m.classList.remove('active'));
    document.getElementById(`menu-${id}`)?.classList.add('active');
  }, menuId);
  await page.waitForTimeout(300);
}

async function closeSubmenus(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.submenu').forEach((m) => m.classList.remove('active'));
  });
}

async function createWidget(page, type, customContent = null, customTitle = null) {
  return page.evaluate(
    ({ type, customContent, customTitle }) => {
      if (type === 'symbol') return window.createSymbolWidget?.('tyst', 'fa-volume-mute', 'Tyst');
      if (customContent) return window.createWidget(type, customContent, customTitle);
      return window.createWidget(type);
    },
    { type, customContent, customTitle }
  );
}

async function activateWidget(page, id) {
  await page.evaluate((widgetId) => {
    const el = document.getElementById(widgetId);
    if (el) window.setActiveWidget(el);
  }, id);
  await page.waitForTimeout(400);
}

async function removeAllWidgets(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.widget').forEach((w) => w.remove());
    window.widgetCount = 0;
  });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'sv-SE',
  });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 01 - Startvy
  await shot(page, '01-startvy');

  // 02-06 - Menyer
  const menus = [
    ['02-meny-verktyg', 'tools'],
    ['03-meny-skriva', 'write'],
    ['04-meny-media', 'media'],
    ['05-meny-symboler', 'symbols'],
    ['06-meny-system', 'system'],
  ];
  for (const [name, id] of menus) {
    await openSubmenu(page, id);
    await shot(page, name);
    await closeSubmenus(page);
  }

  // 07 - Skärmnavigering
  await page.evaluate(() => {
    window.addScreen();
    window.updateScreenName('Lektion 1');
    document.getElementById('screen-name-input').value = 'Lektion 1';
  });
  await page.waitForTimeout(300);
  await shot(page, '07-skarmnavigering');

  // 08 - Om-dialog
  await page.evaluate(() => window.openAboutModal());
  await page.waitForTimeout(300);
  await shot(page, '08-om-dialog');
  await page.evaluate(() => window.closeAboutModal());

  // 09 - ARASAAC-sök
  await page.evaluate(() => window.openArasaacModal());
  await page.waitForTimeout(300);
  await shot(page, '09-arasaac-sok');
  await page.evaluate(() => window.closeArasaacModal());

  // Widget screenshots
  const widgets = [
    ['10-widget-klocka', 'clock'],
    ['11-widget-timer', 'timer'],
    ['12-widget-tidtagarur', 'stopwatch'],
    ['13-widget-ljudniva', 'sound'],
    ['14-widget-slump', 'randomizer'],
    ['15-widget-tarningar', 'dice'],
    ['16-widget-notering', 'text'],
    ['17-widget-att-gora', 'todo'],
    ['18-widget-schema', 'schedule'],
    ['19-widget-bild', 'image'],
    ['20-widget-video', 'video'],
    ['21-widget-pdf', 'pdf'],
    ['22-widget-spotify', 'spotify'],
    ['23-widget-youtube', 'youtube'],
    ['24-widget-pil', 'arrow'],
    ['25-widget-symbol-tyst', 'symbol'],
    ['26-widget-bakgrund', 'background'],
  ];

  for (const [name, type] of widgets) {
    await removeAllWidgets(page);
    const widget = await createWidget(page, type);
    const id = await page.evaluate((w) => w?.id, widget);
    if (id) await activateWidget(page, id);
    await closeSubmenus(page);
    await shot(page, name);
  }

  // 27 - Slump grupp-läge
  await removeAllWidgets(page);
  const randWidget = await createWidget(page, 'randomizer');
  const randId = await page.evaluate((w) => w.id, randWidget);
  await page.evaluate((id) => window.setRandomizerMode(id, 'group'), randId);
  await activateWidget(page, randId);
  await shot(page, '27-widget-slump-grupp');

  // 28 - Widget-verktygsrad
  await removeAllWidgets(page);
  const clockWidget = await createWidget(page, 'clock');
  const clockId = await page.evaluate((w) => w.id, clockWidget);
  await activateWidget(page, clockId);
  await page.evaluate((id) => {
    const pop = document.querySelector(`#${id} .settings-popover`);
    if (pop) pop.classList.add('show');
  }, clockId);
  await shot(page, '28-widget-verktygsrad');

  // 29 - Bekräfta borttagning skärm
  await page.evaluate(() => window.deleteCurrentScreen());
  await page.waitForTimeout(300);
  await shot(page, '29-bekrafta-ta-bort-skarm');
  await page.evaluate(() => window.closeConfirmModal());

  // 30 - Flera widgets på samma skärm (exempel-layout)
  await removeAllWidgets(page);
  await page.evaluate(() => {
    window.switchScreen(0);
    const clock = window.createWidget('clock');
    clock.style.top = '60px';
    clock.style.left = '60px';
    const timer = window.createWidget('timer');
    timer.style.top = '60px';
    timer.style.left = '420px';
    const text = window.createWidget('text');
    text.style.top = '380px';
    text.style.left = '60px';
    text.style.width = '680px';
    text.style.height = '200px';
    const tx = document.querySelector(`#tx-${text.id}`);
    if (tx) tx.innerHTML = '<b>Dagens mål:</b> Vi tränar bråk och samarbetar i par.';
    window.createSymbolWidget('tyst', 'fa-volume-mute', 'Tyst');
    const sym = document.querySelector('.widget[data-type="symbol"]');
    if (sym) {
      sym.style.top = '420px';
      sym.style.left = '780px';
    }
    window.setAppBackground('color', '#ebf8ff');
  });
  await closeSubmenus(page);
  await shot(page, '30-exempel-layout');

  await browser.close();
  console.log('All screenshots captured.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
