// Monte la version : pnpm release [patch|minor|major]  (patch par défaut)
// Ensuite, pousse sur main : GitHub Actions publie l'APK automatiquement.
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const kind = process.argv[2] ?? 'patch';
const pkgPath = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
let [major, minor, patch] = pkg.version.split('.').map(Number);

if (kind === 'major') [major, minor, patch] = [major + 1, 0, 0];
else if (kind === 'minor') [minor, patch] = [minor + 1, 0];
else if (kind === 'patch') patch += 1;
else {
  console.error('Usage : pnpm release [patch|minor|major]');
  process.exit(1);
}

pkg.version = `${major}.${minor}.${patch}`;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
execSync(`git commit -am "Version ${pkg.version}"`, { stdio: 'inherit' });
console.log(`\n✓ Version ${pkg.version}. Pousse sur main (git push) pour publier l'APK.`);
