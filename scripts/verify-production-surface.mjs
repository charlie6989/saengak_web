import { verifyProductionSurface } from './production-surface-lib.mjs';

const report = await verifyProductionSurface();
console.log(JSON.stringify(report, null, 2));

if (!report.ok) process.exit(1);
