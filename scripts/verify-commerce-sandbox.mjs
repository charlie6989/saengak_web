import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { evaluateSandboxSuite } from './commerce-sandbox-lib.mjs';

const inputArgument = process.argv[2];
if (!inputArgument) {
  console.error('Usage: npm run verify:commerce -- <sandbox-evidence.json>');
  process.exit(2);
}

const inputPath = path.resolve(process.cwd(), inputArgument);
const evidence = JSON.parse(await readFile(inputPath, 'utf8'));
const report = evaluateSandboxSuite(evidence);
console.log(JSON.stringify(report, null, 2));

if (!report.launchReady) process.exitCode = 1;
