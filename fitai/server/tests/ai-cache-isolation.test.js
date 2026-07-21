/**
 * Structural guard: no AI cache key may omit the user.
 *
 * Every cached AI response in this app is personalized — the plan is built
 * from one person's body and commitments, the tutor answer references their
 * injuries and targets, the food analysis is keyed to their photo. A cache
 * key without a userId in it means two different people asking the same
 * thing share one stored answer, which is a privacy boundary failure, not a
 * cache-efficiency question.
 *
 * Deliberately a text scan of the orchestrator rather than a runtime test:
 * the invariant is "every call site was written correctly", and the failure
 * mode is a NEW call site added later without a userId. A runtime test only
 * covers the paths it happens to exercise; this covers all of them,
 * including ones that don't exist yet.
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ORCHESTRATOR = path.join(__dirname, '..', 'src', 'services', 'ai', 'aiOrchestrator.js');
const source = fs.readFileSync(ORCHESTRATOR, 'utf8');

// Pull out each `cacheKey: { ... }` object literal, balancing braces so a
// nested `input: { ... }` doesn't end the match early.
function extractCacheKeys(src) {
  const out = [];
  const re = /cacheKey:\s*(\w+\s*\?\s*null\s*:\s*)?\{/g;
  let m;
  while ((m = re.exec(src))) {
    let i = re.lastIndex - 1, depth = 0;
    do {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    } while (depth > 0 && i < src.length);
    out.push(src.slice(m.index, i));
  }
  return out;
}

const cacheKeys = extractCacheKeys(source);

test('the scan actually found the cache keys (never pass vacuously)', () => {
  assert.ok(cacheKeys.length >= 3,
    `only found ${cacheKeys.length} cacheKey literals — the parser has drifted from the source`);
});

test('every AI cache key is scoped to a user', () => {
  const unscoped = cacheKeys.filter((k) => !/\buserId\b/.test(k));
  assert.deepEqual(unscoped, [],
    'these cache keys would let one account be served another account\'s cached answer:\n' +
    unscoped.join('\n---\n'));
});

test('every AI cache key carries the prompt version or a content hash', () => {
  // Without one of these, a prompt change keeps serving answers written by
  // the OLD prompt — which is how a corrected instruction silently fails to
  // take effect for existing users.
  const stale = cacheKeys.filter((k) => !/promptVersion|Hash/.test(k));
  assert.deepEqual(stale, [],
    'these cache keys would outlive a prompt change:\n' + stale.join('\n---\n'));
});

// The plan cache spreads the whole profile into its key. That is what makes
// it safe (two users never share a key), so it must not be narrowed to a
// subset of fields without the userId surviving.
test('the plan cache key includes the user, not just profile shape', () => {
  const planKey = cacheKeys.find((k) => /namespace:\s*'plan'/.test(k));
  assert.ok(planKey, 'expected a plan cache key');
  assert.match(planKey, /\.\.\.profile|userId/,
    'the plan key must carry the profile (which contains userId) or the userId itself');
});
