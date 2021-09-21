import * as fs from 'fs';
import * as path from 'path';

/**
 * Copies the existing prisma schema to the test directory,
 *  and swaps the db to sqlite
 */

console.log('copyContract __dirname', __dirname);
const sourcePath = path.join(__dirname, '../export/contractsInfoLocal.json');
console.log('sourcePath', sourcePath);

const destPath = path.join(
  __dirname,
  '../../frontend/src/services/contractsInfoLocal.json'
);
console.log('destpath', destPath);

fs.readFile(sourcePath, 'utf8', (err, file) => {
  fs.writeFile(destPath, file, () => {
    if (err) throw err;
    console.log('copied over contract');
  });
});
