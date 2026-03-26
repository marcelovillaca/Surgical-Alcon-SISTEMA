const fs = require('fs');
const path = require('path');

// The DB column is: linea_de_produto (from migration line 10)
// excel-parsers.ts uses: linea_de_produto (with 'c') — this is the TS property name mapped to the db
// We need consistency. Check actual migration:
const migContent = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20260209194333_8260a35a-e668-421e-bbac-d420edd0dc57.sql'), 'utf8');
const match = migContent.match(/linea_de_\w+/);
console.log('DB column name:', match ? match[0] : 'not found');

// Fix useDashboardData.ts — align field names to match excel-parsers.ts output
// which uses linea_de_produto (with 'c') when inserting to Supabase
const file = path.join(__dirname, '..', 'src', 'hooks', 'useDashboardData.ts');
let c = fs.readFileSync(file, 'utf8');

// Replace linea_de_produto with linea_de_produto
c = c.split('linea_de_produto').join('linea_de_produto');
// Replace codigo_produto with codigo_produto  
c = c.split('codigo_produto').join('codigo_produto');

// The produto field: DB uses 'produto', excel-parsers uses 'produto'
// Check migration:
const prodMatch = migContent.match(/\bprodu[\w]+\b/g);
console.log('Product-related fields in DB:', prodMatch ? [...new Set(prodMatch)] : 'none');

fs.writeFileSync(file, c, 'utf8');
console.log('Done. Lines:', c.split('\n').length);
console.log('Sample linea references:', (c.match(/linea_de_\w+/g) || []).slice(0, 3));
