const fs = require('fs');
const files = fs.readdirSync('d:/Programming/Web Development/Hanaz-Official').filter(f => f.endsWith('.html'));
files.forEach(f => {
  const path = 'd:/Programming/Web Development/Hanaz-Official/' + f;
  let content = fs.readFileSync(path, 'utf8');
  if (!content.includes('js/cart.js')) {
    content = content.replace('<script src="js/main.js"></script>', '<script src="js/cart.js"></script>\n  <script src="js/main.js"></script>');
    fs.writeFileSync(path, content);
    console.log('Updated ' + f);
  }
});
