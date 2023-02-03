import { AGENT } from '../src/constants.js';

const packageJsonVersion = process.env['npm_package_version'];

if (packageJsonVersion !== AGENT.version) {
  throw new Error(
    `Package version mismatch: ${packageJsonVersion} (./package.json) ↔ ${AGENT.version} (src/constants.ts).`
  );
}
