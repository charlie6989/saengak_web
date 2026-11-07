import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const HOBBY_FUNCTION_LIMIT = 12;

function countFunctions(directory: string): number {
  return readdirSync(directory, { withFileTypes: true }).reduce((count, entry) => {
    // Vercel 不把底線開頭的路徑當成函式
    if (entry.name.startsWith('_')) return count;
    if (entry.isDirectory()) return count + countFunctions(join(directory, entry.name));
    return /\.(ts|js|mjs)$/.test(entry.name) ? count + 1 : count;
  }, 0);
}

describe('Vercel function limit', () => {
  it('stays within the Hobby plan, counting the Node.js middleware', () => {
    const middleware = existsSync('middleware.js') ? 1 : 0;
    expect(countFunctions('api') + middleware).toBeLessThanOrEqual(HOBBY_FUNCTION_LIMIT);
  });
});
