import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

try {
    await page.goto('http://localhost:8765/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    const dropZone = await page.$('#drop-zone');
    const fileInput = await page.$('#file-input');

    console.log('drop-zone found:', !!dropZone);
    console.log('file-input found:', !!fileInput);

    const isInsideDropZone = await page.evaluate(() => {
        const dz = document.getElementById('drop-zone');
        const fi = document.getElementById('file-input');
        return dz && fi && dz.contains(fi);
    });
    console.log('file-input is inside drop-zone:', isInsideDropZone);

    // Check script loaded
    const moduleLoaded = await page.evaluate(() => {
        return typeof window.__moduleLoaded !== 'undefined';
    });
    console.log('module loaded check:', moduleLoaded);

    console.log('\n--- Page console logs ---');
    logs.forEach(l => console.log(l));

} catch(e) {
    console.error('Error:', e.message);
    console.log('\n--- Page console logs ---');
    logs.forEach(l => console.log(l));
}

await browser.close();
