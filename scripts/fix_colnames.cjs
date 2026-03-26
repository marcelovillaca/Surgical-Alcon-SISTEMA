const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'hooks', 'useDashboardData.ts');
let c = fs.readFileSync(file, 'utf8');

// Current (wrong):  produto   = p-r-o-d-u-t-o    (no 'c', char codes: 112-114-111-100-117-116-111)
// Correct (DB):     produto   = p-r-o-d-u-c-t-o  (has 'c', char codes: 112-114-111-100-117-99-116-111)
// 
// Current:  linea_de_produto  (no 'c' before 't')
// Correct:  linea_de_produto  (has 'c' before 't')

// Build correct strings from char codes to avoid any encoding confusion
const produtoCorrect = String.fromCharCode(112, 114, 111, 100, 117, 99, 116, 111); // produto with 'c'
const lineaCorrect = 'linea_de_' + produtoCorrect;  // linea_de_produto with 'c'
const codigoCorrect = 'codigo_' + produtoCorrect;   // codigo_produto with 'c'

const produtoWrong = String.fromCharCode(112, 114, 111, 100, 117, 116, 111);      // produto without 'c'
const lineaWrong = 'linea_de_' + produtoWrong;
const codigoWrong = 'codigo_' + produtoWrong;

console.log('Wrong produto:', JSON.stringify(produtoWrong), 'len:', produtoWrong.length);
console.log('Correct produto:', JSON.stringify(produtoCorrect), 'len:', produtoCorrect.length);
console.log('Found in file:', c.includes(produtoWrong), '/ correct present:', c.includes(produtoCorrect));

// Replace
c = c.split(produtoWrong).join(produtoCorrect);

fs.writeFileSync(file, c, 'utf8');

// Verify select
const m = c.match(/select\('([^']+)'\)/);
const cols = m ? m[1].split(',') : [];
const col4bytes = cols[4] ? [...cols[4]].map(ch => ch.charCodeAt(0)).join('-') : 'missing';
const col6bytes = cols[6] ? [...cols[6]].map(ch => ch.charCodeAt(0)).join('-') : 'missing';
console.log('Col 4 bytes:', col4bytes);
console.log('Col 6 bytes:', col6bytes);
console.log('Col 4 text:', cols[4]);
console.log('Col 6 text:', cols[6]);
