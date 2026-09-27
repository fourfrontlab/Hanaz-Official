const fs = require('fs');
const vitC = 'C:\\\\Users\\\\HP\\\\Downloads\\\\hanaz\\\\hanaz-customer\\\\pdp-vitamin-c.html';
let content = fs.readFileSync(vitC, 'utf8');
content = content.replace(/product-detail\.html\?id=hanaz-vitamin-c-serum/g, 'pdp-vitamin-c.html');
content = content.replace(/const currentUrl = 'https:\/\/www\.hanazofficial\.store\/product-detail\.html\?id=' \+ product\.id;/g, 'const currentUrl = \\'https://www.hanazofficial.store/pdp-vitamin-c.html\\';');
fs.writeFileSync(vitC, content);

const fw = 'C:\\\\Users\\\\HP\\\\Downloads\\\\hanaz\\\\hanaz-customer\\\\pdp-face-wash.html';
let fwContent = fs.readFileSync(fw, 'utf8');
fwContent = fwContent.replace(/product-detail\.html\?id=hanaz-brightening-face-wash/g, 'pdp-face-wash.html');
fwContent = fwContent.replace(/const currentUrl = 'https:\/\/www\.hanazofficial\.store\/product-detail\.html\?id=' \+ product\.id;/g, 'const currentUrl = \\'https://www.hanazofficial.store/pdp-face-wash.html\\';');
fs.writeFileSync(fw, fwContent);

const sitemap = 'C:\\\\Users\\\\HP\\\\Downloads\\\\hanaz\\\\hanaz-customer\\\\sitemap.xml';
let smContent = fs.readFileSync(sitemap, 'utf8');
smContent = smContent.replace(/product-detail\.html\?id=hanaz-vitamin-c-serum/g, 'pdp-vitamin-c.html');
smContent = smContent.replace(/product-detail\.html\?id=0aa58f95-83d6-45f6-a7f3-2c1ed3b3ac39/g, 'pdp-face-wash.html');
smContent = smContent.replace(/product-detail\.html\?id=hanaz-brightening-face-wash/g, 'pdp-face-wash.html');
fs.writeFileSync(sitemap, smContent);
