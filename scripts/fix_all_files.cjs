const fs = require('fs');
const path = require('path');

const produtoWrong = String.fromCharCode(112, 114, 111, 100, 117, 116, 111);   // produto (7 chars, no 'c')
const produtoRight = String.fromCharCode(112, 114, 111, 100, 117, 99, 116, 111); // produto (8 chars, with 'c')

const files = [
    path.join(__dirname, '..', 'src', 'pages', 'MarketShare.tsx'),
    path.join(__dirname, '..', 'src', 'hooks', 'useDashboardData.ts'),
    path.join(__dirname, '..', 'src', 'pages', 'AccountAnalysis.tsx'),
    path.join(__dirname, '..', 'src', 'lib', 'excel-parsers.ts'),
    path.join(__dirname, '..', 'src', 'pages', 'VentasTargets.tsx'),
];

for (const file of files) {
    try {
        let c = fs.readFileSync(file, 'utf8');
        const count = c.split(produtoWrong).length - 1;
        if (count > 0) {
            c = c.split(produtoWrong).join(produtoRight);
            fs.writeFileSync(file, c, 'utf8');
            console.log(path.basename(file) + ': fixed ' + count + ' occurrences');
        } else {
            console.log(path.basename(file) + ': OK');
        }
    } catch (e) {
        console.log(path.basename(file) + ': ERROR - ' + e.message);
    }
}
