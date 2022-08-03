import { PACKAGE } from '../src/constants.js';

const packageJsonVersion = process.env['npm_package_version'];

if (packageJsonVersion !== PACKAGE.version) {
  throw new Error(
    `Package version mismatch: ${packageJsonVersion} (./package.json) ↔ ${PACKAGE.version} (src/constants.ts).`
  );
}
