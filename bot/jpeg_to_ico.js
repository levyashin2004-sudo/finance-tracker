const Jimp = require('jimp');
const pngToIco = require('png-to-ico');
const fs = require('fs');

async function convert() {
    console.log('Reading JPEG...');
    const image = await Jimp.read('C:/Users/Лев/.gemini/antigravity/brain/18c55830-38bd-4376-9eee-305eb8094e9f/finance_gold_icon_1776623217417.png');
    console.log('Read success, formatting to square 256x256...');
    image.resize(256, 256);
    
    console.log('Saving as temp PNG...');
    await image.writeAsync('temp.png');
    
    console.log('Converting temp PNG to ICO...');
    const buf = await pngToIco('temp.png');
    fs.writeFileSync('C:/Users/Лев/Desktop/Antigravity/finance-tracker/app_icon.ico', buf);
    console.log('ICO successfully created!');
}
convert().catch(console.error);
