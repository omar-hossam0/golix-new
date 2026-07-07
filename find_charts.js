const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.resolve(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.next') {
                results = results.concat(walk(fullPath));
            }
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.js')) {
                results.push(fullPath);
            }
        }
    });
    return results;
}

const files = walk(__dirname);
files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('polyline') || content.includes('path') && content.includes('stroke') && (content.includes('chart') || content.includes('trend'))) {
        if (!file.includes('DashboardFrame')) {
            console.log('Match found in:', path.relative(__dirname, file));
        }
    }
});
