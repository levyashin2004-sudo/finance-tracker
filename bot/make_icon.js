const fs = require('fs');
const pngToIco = require('png-to-ico');

pngToIco('C:/Users/Лев/.gemini/antigravity/brain/18c55830-38bd-4376-9eee-305eb8094e9f/finance_gold_icon_1776623217417.png')
  .then(buf => {
    fs.writeFileSync('C:/Users/Лев/Desktop/Antigravity/finance-tracker/app_icon.ico', buf);
    console.log('ICO successfully created!');
  })
  .catch(console.error);
