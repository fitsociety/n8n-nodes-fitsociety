import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
if (
	!repository ||
	!/^https:\/\/github\.com\/[^/]+\/n8n-nodes-fitsociety(?:\.git)?$/.test(repository)
) {
	throw new Error(
		'Release is not configured. Set the real public repository and npm ownership, configure provenance publishing, review the package, and obtain release authorization first.',
	);
}
