const sharp = require('sharp');
const { execSync } = require('child_process');

async function convert() {
    console.log('Reading JPEG and converting to PNG...');
    await sharp('C:/Users/Лев/.gemini/antigravity/brain/18c55830-38bd-4376-9eee-305eb8094e9f/finance_gold_icon_1776623217417.png')
        .resize(256, 256)
        .png()
        .toFile('temp.png');
    
    console.log('Converting temp PNG to ICO using CLI...');
    // execSync natively uses cmd on Windows which correctly handles stdout > binary
    execSync('npx png-to-ico temp.png > "C:/Users/Лев/Desktop/Antigravity/finance-tracker/app_icon.ico"', { encoding: 'binary' });
    console.log('ICO successfully created!');
}
convert().catch(console.error);
