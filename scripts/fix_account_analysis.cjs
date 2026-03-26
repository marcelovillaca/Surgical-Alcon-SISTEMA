const fs = require('fs');
const path = require('path');

const produtoWrong = String.fromCharCode(112, 114, 111, 100, 117, 116, 111);   // produto (7 chars, no 'c')
const produtoRight = String.fromCharCode(112, 114, 111, 100, 117, 99, 116, 111); // produto (8 chars, with 'c')

const file = path.join(__dirname, '..', 'src', 'pages', 'AccountAnalysis.tsx');
let c = fs.readFileSync(file, 'utf8');

const before = c.split(produtoWrong).length - 1;
c = c.split(produtoWrong).join(produtoRight);
const after = (c.split(produtoRight).length - 1);
console.log('Occurrences fixed:', before, '-> product refs now:', after);

// Also fix linea_de_produto -> linea_de_produto
const lineaWrong = 'linea_de_' + produtoWrong;
const lineaRight = 'linea_de_' + produtoRight;
const cn = c.split(lineaWrong).length - 1;
c = c.split(lineaWrong).join(lineaRight);
console.log('Linea fixed:', cn);

// Fix codigo_produto
const codigoWrong = 'codigo_' + produtoWrong;
const codigoRight = 'codigo_' + produtoRight;
const coc = c.split(codigoWrong).length - 1;
c = c.split(codigoWrong).join(codigoRight);
console.log('Codigo fixed:', coc);

fs.writeFileSync(file, c, 'utf8');

// Verify the select string
const sel = c.match(/\.select\("([^"]+)"\)/);
console.log('Select:', sel ? sel[1] : 'not found');

// Verify remaining wrong refs
const remaining = (c.split(produtoWrong).length - 1);
console.log('Remaining wrong "produto" refs:', remaining);
