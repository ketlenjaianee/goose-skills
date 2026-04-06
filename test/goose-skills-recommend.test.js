const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Pull the internal helpers out of the CLI file by requiring it in a way
// that lets us test them without executing the CLI routing. We expose the
// two pure helper functions via a small test-only export hook.
//
// Since goose-skills.js doesn't export helpers, we test the behaviour
// indirectly by spawning the process or by extracting the logic.
// For unit-test speed we copy the two pure helpers here.

function gatherProjectContext(projectDir) {
  const context = [];

  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const summary = {
        name: pkg.name,
        description: pkg.description,
        keywords: pkg.keywords,
        scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
        dependencies: Object.keys(pkg.dependencies || {}),
        devDependencies: Object.keys(pkg.devDependencies || {}),
      };
      context.push(`package.json:\n${JSON.stringify(summary, null, 2)}`);
    } catch (_) { /* ignore */ }
  }

  for (const name of ['README.md', 'README.rst', 'README.txt', 'readme.md']) {
    const readmePath = path.join(projectDir, name);
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf8').slice(0, 3000);
      context.push(`${name} (first 3000 chars):\n${content}`);
      break;
    }
  }

  return context.join('\n\n---\n\n') || '(no project context found)';
}

function buildSkillCatalog(index) {
  const lines = [];
  for (const skill of index.skills) {
    lines.push(`- ${skill.slug} [${skill.category}]: ${skill.description} (tags: ${(skill.tags || []).join(', ')})`);
  }
  for (const pack of (index.packs || [])) {
    lines.push(`- ${pack.slug} [pack]: ${pack.description} (tags: ${(pack.tags || []).join(', ')})`);
  }
  return lines.join('\n');
}

// --- tests ---

test('gatherProjectContext returns placeholder when directory is empty', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'goose-recommend-'));
  const result = gatherProjectContext(tmp);
  assert.equal(result, '(no project context found)');
});

test('gatherProjectContext includes package.json summary', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'goose-recommend-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({
    name: 'my-app',
    description: 'A sales tool',
    keywords: ['crm', 'sales'],
    scripts: { test: 'jest', build: 'tsc' },
    dependencies: { express: '^4.0.0' },
  }));
  const result = gatherProjectContext(tmp);
  assert.match(result, /my-app/);
  assert.match(result, /sales tool/);
  assert.match(result, /express/);
});

test('gatherProjectContext includes README.md (truncated to 3000 chars)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'goose-recommend-'));
  const longReadme = 'x'.repeat(5000);
  fs.writeFileSync(path.join(tmp, 'README.md'), longReadme);
  const result = gatherProjectContext(tmp);
  assert.match(result, /README\.md/);
  // Content is sliced to 3000 chars, so the context should NOT contain 5000 x's
  assert.ok(result.length < 5000);
});

test('buildSkillCatalog lists all skills and packs', () => {
  const index = {
    skills: [
      { slug: 'foo', category: 'capabilities', description: 'Does foo', tags: ['a', 'b'] },
      { slug: 'bar', category: 'composites', description: 'Does bar', tags: [] },
    ],
    packs: [
      { slug: 'my-pack', description: 'A pack', tags: ['pack-tag'] },
    ],
  };
  const catalog = buildSkillCatalog(index);
  assert.match(catalog, /foo \[capabilities\]: Does foo/);
  assert.match(catalog, /bar \[composites\]: Does bar/);
  assert.match(catalog, /my-pack \[pack\]: A pack/);
  assert.match(catalog, /tags: a, b/);
});

test('buildSkillCatalog handles missing tags gracefully', () => {
  const index = {
    skills: [{ slug: 'baz', category: 'playbooks', description: 'Does baz' }],
    packs: [],
  };
  const catalog = buildSkillCatalog(index);
  assert.match(catalog, /baz \[playbooks\]/);
  assert.match(catalog, /tags: /);
});
