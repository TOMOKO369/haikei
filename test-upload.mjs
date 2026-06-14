import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const testImagePath = path.join(process.cwd(), 'test-image.png');

const browser = await chromium.launch({ headless: true });

// Create a valid test image using canvas
const imgPage = await browser.newPage();
await imgPage.setContent(`<html><body style="margin:0">
<canvas id="c" width="80" height="80"></canvas>
<script>
const ctx = document.getElementById('c').getContext('2d');
ctx.fillStyle = '#3498db';
ctx.fillRect(0, 0, 80, 80);
ctx.fillStyle = '#e74c3c';
ctx.beginPath();
ctx.arc(40, 40, 25, 0, Math.PI * 2);
ctx.fill();
</script></body></html>`);
const dataUrl = await imgPage.evaluate(() => document.getElementById('c').toDataURL('image/png'));
fs.writeFileSync(testImagePath, Buffer.from(dataUrl.split(',')[1], 'base64'));
await imgPage.close();
console.log('✅ valid test image created');

const page = await browser.newPage();
const logs = [];
page.on('console', msg => {
    if (!msg.text().includes('tailwindcss')) logs.push(`[${msg.type()}] ${msg.text().substring(0, 200)}`);
});
page.on('pageerror', err => logs.push(`[pageerror] ${err.message.substring(0, 200)}`));

try {
    await page.goto('http://localhost:8765/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Check click handler
    const hasClick = await page.evaluate(() => {
        const dz = document.getElementById('drop-zone');
        let called = false;
        const orig = HTMLInputElement.prototype.click;
        HTMLInputElement.prototype.click = function() { called = true; };
        dz.click();
        HTMLInputElement.prototype.click = orig;
        return called;
    });
    console.log('✅ click handler:', hasClick);

    // Upload test image
    await page.setInputFiles('#file-input', testImagePath);
    console.log('⏳ processing image (may take 30–60s for first run)...');

    // Wait for transform panel or error (up to 90s)
    try {
        await page.waitForSelector('#transform-panel', { timeout: 90000 });
        console.log('✅ transform panel appeared — background removal succeeded!');
        const hasDownloadBtn = await page.$('#download-btn');
        console.log('✅ download button:', !!hasDownloadBtn);
    } catch {
        console.log('❌ transform panel did NOT appear within 90s');
    }

    console.log('\n--- Logs ---');
    logs.forEach(l => console.log(l));

} catch(e) {
    console.error('Error:', e.message);
    logs.forEach(l => console.log(l));
}

fs.unlinkSync(testImagePath);
await browser.close();
