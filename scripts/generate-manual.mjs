import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import { chromium } from 'playwright';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANUAL_DIR = path.resolve(__dirname, '../docs/manual');
const IMAGES_DIR = path.join(MANUAL_DIR, 'images');
const MD_PATH = path.join(MANUAL_DIR, 'LARARHANDBOK.md');
const HTML_PATH = path.join(MANUAL_DIR, 'lararhandbok.html');
const PDF_PATH = path.join(MANUAL_DIR, 'LARARHANDBOK.pdf');

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  :root {
    --blue: #2563eb;
    --blue-light: #eff6ff;
    --text: #1f2937;
    --muted: #6b7280;
    --border: #e5e7eb;
    --bg: #ffffff;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', system-ui, sans-serif;
    color: var(--text);
    background: #f8fafc;
    line-height: 1.7;
    font-size: 15px;
  }

  .page {
    max-width: 820px;
    margin: 0 auto;
    background: var(--bg);
    box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  }

  .cover {
    background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%);
    color: white;
    padding: 64px 48px 56px;
    text-align: center;
  }

  .cover-icon { font-size: 3rem; margin-bottom: 16px; }
  .cover h1 { font-size: 2.2rem; font-weight: 800; margin-bottom: 12px; letter-spacing: -0.02em; }
  .cover p { font-size: 1.05rem; opacity: 0.92; max-width: 520px; margin: 0 auto; line-height: 1.6; }
  .cover-meta { margin-top: 28px; font-size: 0.85rem; opacity: 0.75; }

  .toolbar {
    display: flex;
    gap: 12px;
    justify-content: center;
    padding: 16px 24px;
    background: var(--blue-light);
    border-bottom: 1px solid #bfdbfe;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .toolbar a {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 0.9rem;
    text-decoration: none;
    transition: all 0.2s;
  }

  .toolbar .btn-primary { background: var(--blue); color: white; }
  .toolbar .btn-primary:hover { background: #1d4ed8; }
  .toolbar .btn-secondary { background: white; color: var(--blue); border: 2px solid var(--blue); }
  .toolbar .btn-secondary:hover { background: var(--blue-light); }

  .content { padding: 40px 48px 64px; }

  h2 {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--blue);
    margin: 48px 0 20px;
    padding-bottom: 8px;
    border-bottom: 3px solid var(--blue-light);
    page-break-after: avoid;
  }

  h2:first-child { margin-top: 0; }

  h3 {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 28px 0 12px;
    color: #374151;
    page-break-after: avoid;
  }

  p { margin-bottom: 14px; }
  ul, ol { margin: 0 0 16px 24px; }
  li { margin-bottom: 6px; }
  hr { border: none; border-top: 1px solid var(--border); margin: 32px 0; }
  strong { font-weight: 700; }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0 24px;
    font-size: 0.92rem;
    page-break-inside: avoid;
  }

  th {
    background: var(--blue-light);
    color: var(--blue);
    font-weight: 700;
    text-align: left;
    padding: 10px 14px;
    border: 1px solid #bfdbfe;
  }

  td { padding: 10px 14px; border: 1px solid var(--border); vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }

  img {
    max-width: 100%;
    height: auto;
    border-radius: 12px;
    border: 1px solid var(--border);
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    margin: 16px 0 20px;
    display: block;
    page-break-inside: avoid;
  }

  pre {
    background: #1e293b;
    color: #e2e8f0;
    padding: 20px 24px;
    border-radius: 12px;
    font-size: 0.85rem;
    line-height: 1.6;
    overflow-x: auto;
    margin: 16px 0 24px;
    page-break-inside: avoid;
  }

  code {
    font-family: 'Courier New', monospace;
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.88em;
  }

  pre code { background: none; padding: 0; color: inherit; }
  a { color: var(--blue); }
  em { color: var(--muted); font-style: italic; }

  .footer {
    text-align: center;
    padding: 24px 48px 40px;
    color: var(--muted);
    font-size: 0.85rem;
    border-top: 1px solid var(--border);
  }

  @media print {
    body { background: white; }
    .page { box-shadow: none; max-width: 100%; }
    .toolbar { display: none; }
    .cover { page-break-after: always; }
    h2 { page-break-before: always; }
    h2:first-of-type { page-break-before: avoid; }
  }
`;

async function optimizeImages() {
  const files = (await readdir(IMAGES_DIR)).filter((f) => f.endsWith('.png'));
  console.log(`Optimizing ${files.length} images...`);

  for (const file of files) {
    const src = path.join(IMAGES_DIR, file);
    const dest = path.join(IMAGES_DIR, file.replace('.png', '.jpg'));
    await sharp(src)
      .resize({ width: 1100, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(dest);
  }
}

function buildHtml(bodyHtml) {
  const optimizedBody = bodyHtml.replace(/images\/([^.]+)\.png/g, 'images/$1.jpg');

  return `<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Klassrumsskärm – Lärarhandbok</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="page">
    <div class="cover">
      <div class="cover-icon">✨</div>
      <h1>Klassrumsskärm – Lärarhandbok</h1>
      <p>En steg-för-steg-guide för lärare som vill använda Klassrumsskärm i undervisningen.</p>
      <div class="cover-meta">Skapad av Fredrik Andersson, Skolförvaltningen Mölndal Stad</div>
    </div>

    <div class="toolbar">
      <a href="LARARHANDBOK.pdf" class="btn-primary" download>📄 Ladda ner PDF</a>
      <a href="../../index.html" class="btn-secondary">← Tillbaka till appen</a>
    </div>

    <div class="content">
      ${optimizedBody}
    </div>

    <div class="footer">
      Klassrumsskärm är fritt att använda för personligt bruk i undervisningssyfte.
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  await optimizeImages();

  const md = await readFile(MD_PATH, 'utf-8');
  const mdForHtml = md.replace(/images\/([^.]+)\.png/g, 'images/$1.jpg');
  const bodyHtml = await marked.parse(mdForHtml);
  const html = buildHtml(bodyHtml);

  await writeFile(HTML_PATH, html, 'utf-8');
  console.log(`Saved ${HTML_PATH}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`file://${HTML_PATH}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.pdf({
    path: PDF_PATH,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="width:100%;font-size:9px;color:#9ca3af;text-align:center;padding:0 16mm;">
        Klassrumsskärm – Lärarhandbok &nbsp;|&nbsp; Sida <span class="pageNumber"></span> av <span class="totalPages"></span>
      </div>`,
  });

  await browser.close();
  console.log(`Saved ${PDF_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
