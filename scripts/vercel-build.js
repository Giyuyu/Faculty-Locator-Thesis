import { spawnSync } from 'node:child_process';

const branch = process.env.VERCEL_GIT_COMMIT_REF || process.env.GITHUB_REF_NAME || '';
const mode = branch === 'stg' ? 'staging' : 'production';

console.log(`Building STI Locator for ${mode} mode${branch ? ` from branch ${branch}` : ''}.`);

const result = spawnSync('vite', ['build', '--mode', mode], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
