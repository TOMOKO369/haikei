import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

// Create a simple test image (red square PNG)
function createTestPNG() {
    // Minimal 10x10 red PNG
    const buf = Buffer.from([
        0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a, // PNG signature
        0x00,0x00,0x00,0x0d,0x49,0x48,0x44,0x52, // IHDR chunk length+type
        0x00,0x00,0x00,0x0a,0x00,0x00,0x00,0x0a, // width=10, height=10
        0x08,0x02,0x00,0x00,0x00,0x02,0x50,0x58, // bit depth, color type, etc
        0xea,0x00,0x00,0x00,0x21,0x49,0x44,0x41, // IDAT
        0x54,0x78,0x9c,0x62,0xf8,0x0f,0x00,0x01,
        0x01,0x00,0x00,0x05,0x18,0xd8,0x4a,0x0f,
        0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,
        0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
        0x00,0x00,0x00,0x00,0x49,0x45,0x4e,0x44, // IEND
        0xae,0x42,0x60,0x82
    ]);
    return buf;
}

const testImagePath = path.join(process.cwd(), 'test-image.png');
fs.writeFileSync(testImagePath, createTestPNG());

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const logs = [];
const networkErrors = [];

page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));
page.on('response', resp => {
    if (!resp.ok() && resp.status() !== 302) networkErrors.push(`${resp.status()} ${resp.url().substring(0, 100)}`);
});

try {
    await page.goto('http://localhost:8765/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Check click handler
    const hasClickListener = await page.evaluate(() => {
        const dz = document.getElementById('drop-zone');
        const fi = document.getElementById('file-input');
        let called = false;
        const orig = HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click = function() { called = true; };
        dz.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        HTMLInputElement.prototype.click = orig;
        return called;
    });
    console.log('✅ click handler working:', hasClickListener);

    // Upload a test image via file input
    await page.setInputFiles('#file-input', testImagePath);
    console.log('✅ file set on input');

    // Wait for processing (background removal)
    await page.waitForTimeout(5000);

    // Check if transform panel appeared
    const panelExists = await page.$('#transform-panel');
    console.log('transform panel appeared:', !!panelExists);

    console.log('\n--- Network errors ---');
    networkErrors.slice(0, 10).forEach(e => console.log(e));

    console.log('\n--- Page console logs ---');
    logs.filter(l => !l.includes('tailwindcss')).forEach(l => console.log(l));

} catch(e) {
    console.error('Error:', e.message);
    logs.forEach(l => console.log(l));
}

fs.unlinkSync(testImagePath);
await browser.close();
