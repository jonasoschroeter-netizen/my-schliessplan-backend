/**
 * Startet Strapi develop mit STRAPI_FORCE_RESEED=true (bestehende Finder-Inhalte werden ersetzt).
 * Aufruf: node scripts/develop-with-reseed.cjs
 */
process.env.STRAPI_FORCE_RESEED = 'true';
require('child_process').spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['strapi', 'develop'],
  { stdio: 'inherit', cwd: require('path').join(__dirname, '..'), shell: true }
);
