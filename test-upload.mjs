import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const testImagePath = path.join(process.cwd(), 'test-image.png');
const browser = await chromium.launch({ headless: true });

// Create a valid test image
const imgPage = await browser.newPage();
await imgPage.setContent(`<html><body style="margin:0">
<canvas id="c" width="80" height="80"></canvas>
<script>
const ctx = document.getElementById('c').getContext('2d');
ctx.fillStyle = '#3498db'; ctx.fillRect(0, 0, 80, 80);
ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(40,40,25,0,Math.PI*2); ctx.fill();
</script></body></html>`);
const dataUrl = await imgPage.evaluate(() => document.getElementById('c').toDataURL('image/png'));
fs.writeFileSync(testImagePath, Buffer.from(dataUrl.split(',')[1], 'base64'));
await imgPage.close();

const page = await browser.newPage();
const logs = [];
page.on('console', msg => { if (!msg.text().includes('tailwindcss')) logs.push(`[${msg.type()}] ${msg.text().substring(0,200)}`); });
page.on('pageerror', err => logs.push(`[pageerror] ${err.message.substring(0,200)}`));

try {
    // Start background HTTP server
    const { exec } = await import('child_process');
    const server = exec('npx http-server -p 8765 --cors', { cwd: process.cwd() });
    await new Promise(r => setTimeout(r, 3000));

    await page.goto('http://localhost:8765/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    await page.setInputFiles('#file-input', testImagePath);
    console.log('⏳ ファイルをセット。処理中...');

    // Check loading state appears
    const loadingText = await page.waitForSelector('text=背景を滅しています', { timeout: 10000 }).catch(() => null);
    console.log('✅ ローディング表示:', !!loadingText);

    // Wait for transform panel
    const panel = await page.waitForSelector('#transform-panel', { timeout: 90000 }).catch(() => null);
    console.log('✅ 背景透過完了・パネル表示:', !!panel);

    if (panel) {
        const preview = await page.$('#transform-preview');
        const src = await preview?.getAttribute('src');
        console.log('✅ プレビュー画像:', src ? 'あり (blob URL)' : 'なし');
    }

    server.kill();
} catch(e) {
    console.error('Error:', e.message);
}

console.log('\n--- Logs ---');
logs.forEach(l => console.log(l));

fs.unlinkSync(testImagePath);
await browser.close();
