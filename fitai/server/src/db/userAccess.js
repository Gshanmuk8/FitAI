// The single doorway for database access. Everything that reads or writes
// user-owned data goes through `queryAs`, so "was this scoped to a user?"
// is answered once, at the call boundary — not re-litigated per query and
// not left to whoever writes the next model function.
//
// Design note (deliberate): this is an ACCESS GATE, not a SQL wrapper. It
// does NOT rewrite SQL or assume `user_id` sits at any particular bind
// position — real queries scope on $1, $2, INSERT columns, etc. It enforces
// two things instead:
//   1. a userId must be passed explicitly (control-flow constraint), and
//   2. the SQL must actually mention user_id (a cheap accidental-omission
//      net — presence only, not a semantic validator).
// The hard boundary that survives a hostile edit is DB-level RLS; this layer
// is the accidental-drift net, which is the risk we actually have. The CI
// guard (tests/db-scoping-guard.test.js) enforces that NO code outside this
// module touches the pool directly, so this really is the only door.
const { pool } = require('../config/db');

function queryAs(userId, sql, params = []) {
  if (!userId) {
    throw new Error('queryAs: a userId is required for user-scoped DB access');
  }
  if (!/user_id/i.test(sql)) {
    throw new Error(
      'queryAs: query does not reference user_id — user-owned tables must be ' +
      'scoped to a user. For a genuinely userless query, use querySystem().'
    );
  }
  return pool.query(sql, params);
}

// Explicit escape hatch for queries with no user dimension (health checks,
// cross-user maintenance). Naming it makes "this touches everyone's data on
// purpose" a visible, reviewable decision rather than a silent omission.
function querySystem(sql, params = []) {
  return pool.query(sql, params);
}

module.exports = { queryAs, querySystem };
