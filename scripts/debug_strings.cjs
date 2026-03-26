const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'hooks', 'useDashboardData.ts');

let c = fs.readFileSync(file, 'utf8');

// The DB columns (from migration 20260209194333):
//   linea_de_produto   (Spanish - the 'c' is from "producto")
//   codigo_produto     (Spanish)
//   produto            (Spanish)
// 
// Current code mistakenly uses Portuguese names (produto, linha_de_produto).
// We need to change:
//   linea_de_produto  =>  linea_de_produto   (add 'c' at position 10)
//   codigo_produto    =>  codigo_produto     (add 'c')
//   .produto          =>  .produto           (add 'c')

// Do character-by-character comparison to understand the issue
const wrong = 'linea_de_produto';
const right = 'linea_de_produto';
console.log('Are they equal?', wrong === right);
console.log('Wrong chars:', [...wrong].map((ch, i) => i + ':' + ch + ':' + ch.charCodeAt(0)).join(' '));
console.log('Right chars:', [...right].map((ch, i) => i + ':' + ch + ':' + ch.charCodeAt(0)).join(' '));
