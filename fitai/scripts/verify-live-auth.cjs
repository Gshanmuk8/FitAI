// Explicit live smoke test: creates two temporary test accounts, then removes
// ONLY those accounts in finally. No passwords, tokens or user data are printed.
// Requires email confirmation to be disabled and tests PUBLIC signup, not an
// admin-created, preconfirmed user. Does not test password-reset email delivery.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");

if (
  !process.argv.includes("--run-live") &&
  !process.argv.includes("--settings-only")
)
  throw new Error(
    "Pass --settings-only for a read-only check, or --run-live to create and clean up temporary test accounts.",
  );
const backend = dotenv.parse(
  fs.readFileSync(path.join(__dirname, "../server/.env")),
);
const frontend = dotenv.parse(
  fs.readFileSync(path.join(__dirname, "../client/.env")),
);
const expectedProject = "https://pfmmyhsoshyopuzdsuid.supabase.co";
assert.equal(backend.SUPABASE_URL, expectedProject);
assert.equal(frontend.VITE_SUPABASE_URL, expectedProject);
const authOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: (url, options = {}) =>
      fetch(url, {
        ...options,
        signal: options.signal || AbortSignal.timeout(25000),
      }),
  },
};
const admin = createClient(
  expectedProject,
  backend.SUPABASE_SERVICE_KEY,
  authOptions,
);
const apiOrigin = "https://fitai-d94m.onrender.com";
const siteOrigin = "https://fit-ai-teal-nu.vercel.app";
const created = [];
let passed = 0;
function pass(label) {
  console.log(`PASS ${++passed}: ${label}`);
}
function ensure(result, label) {
  if (result.error)
    throw new Error(
      `${label}: ${result.error.code || result.error.status || "failed"}`,
    );
  return result.data;
}

async function api(route, session, options = {}, expected = 200) {
  const response = await fetch(`${apiOrigin}${route}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Origin: siteOrigin,
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    signal: AbortSignal.timeout(130000),
  });
  assert.equal(
    response.status,
    expected,
    `${route} returned HTTP ${response.status}, expected ${expected}`,
  );
  assert.ok(
    [siteOrigin, "*"].includes(
      response.headers.get("access-control-allow-origin"),
    ),
    `${route}: deployed CORS must allow the website`,
  );
  return response.json();
}

async function account() {
  const email = `fitai-smoke-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomBytes(24).toString("base64url");
  const client = createClient(
    expectedProject,
    frontend.VITE_SUPABASE_ANON_KEY,
    authOptions,
  );
  const data = ensure(
    await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${siteOrigin}/auth/callback` },
    }),
    "public signup",
  );
  if (data.user?.id) created.push({ id: data.user.id, email });
  assert.ok(data.user?.id, "public signup did not return a user");
  assert.ok(
    data.session?.access_token,
    "public signup must return a session without an email link",
  );
  assert.equal(data.session.user.id, data.user.id);
  return { client, email, password, session: data.session, id: data.user.id };
}

async function main() {
  try {
    const response = await fetch(`${expectedProject}/auth/v1/settings`, {
      headers: { apikey: frontend.VITE_SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(25000),
    });
    assert.equal(
      response.status,
      200,
      "Supabase public settings must be reachable",
    );
    const settings = await response.json();
    assert.equal(
      settings.external?.email,
      true,
      "email/password auth must be enabled",
    );
    assert.equal(
      settings.disable_signup,
      false,
      "public signup must be enabled",
    );
    assert.equal(
      settings.mailer_autoconfirm,
      true,
      "Confirm email must be disabled for the requested instant signup flow",
    );
    pass("public signup enabled and email confirmation disabled");
    if (process.argv.includes("--settings-only")) return;
    const adminProbe = await admin.auth.admin.getUserById(crypto.randomUUID());
    assert.ok(
      adminProbe.error?.status === 404,
      "server key must allow temporary-account cleanup before creating test users",
    );
    const health = await api("/health");
    assert.equal(health.database, "ok");
    pass("deployed backend connects to the database");
    const first = await account();
    pass("public signup returns an authenticated session with no email link");
    await api("/api/onboarding", first.session, {}, 404);
    pass("new account has no inherited profile");
    const profile = {
      age: 28,
      heightCm: 175,
      weightKg: 75,
      goal: "maintain",
      activityLevel: "lightly_active",
      equipment: "home",
      sex: "other",
      timeframeWeeks: 12,
      trainingDaysPerWeek: 3,
      timezone: "Asia/Kolkata",
    };
    const onboarded = await api("/api/onboarding", first.session, {
      method: "POST",
      body: JSON.stringify(profile),
    });
    assert.ok(onboarded.plan?.days?.length);
    pass(
      `onboarding saves a plan (source: ${onboarded.plan.source || "not specified"})`,
    );
    const repeated = await api("/api/onboarding", first.session, {
      method: "POST",
      body: JSON.stringify(profile),
    });
    assert.deepEqual(repeated.plan, onboarded.plan);
    pass("repeated onboarding preserves the saved plan");
    await api("/api/workout/log", first.session, {
      method: "POST",
      body: JSON.stringify({
        exerciseName: "Smoke Test Squat",
        weightKg: 10,
        reps: 8,
        setNumber: 1,
        completedAllReps: true,
      }),
    });
    const sets = await api("/api/workout/today-sets", first.session);
    assert.equal(sets["Smoke Test Squat"], 1);
    pass("workout set persists across requests");
    const savedMeal = await api("/api/nutrition/meals", first.session, {
      method: "POST",
      body: JSON.stringify({
        name: "Smoke test meal",
        calories: 450,
        protein: 25,
        source: "manual",
      }),
    });
    const meals = await api("/api/nutrition/meals/today", first.session);
    assert.ok(meals.meals.some((meal) => meal.id === savedMeal.meal.id));
    pass("meal diary persists across requests");
    ensure(await first.client.auth.signOut({ scope: "local" }), "sign-out");
    const again = ensure(
      await first.client.auth.signInWithPassword({
        email: first.email,
        password: first.password,
      }),
      "returning sign-in",
    );
    const restored = await api("/api/onboarding", again.session);
    assert.deepEqual(restored.plan, onboarded.plan);
    pass("sign-out and returning sign-in preserve the account and plan");
    const refreshed = ensure(
      await first.client.auth.refreshSession(),
      "session refresh",
    );
    await api("/api/profile", refreshed.session);
    pass("refreshed session is accepted by the deployed backend");
    const changedPassword = crypto.randomBytes(24).toString("base64url");
    ensure(
      await first.client.auth.updateUser({ password: changedPassword }),
      "password update",
    );
    ensure(
      await first.client.auth.signOut({ scope: "local" }),
      "sign-out after password update",
    );
    const oldLogin = await first.client.auth.signInWithPassword({
      email: first.email,
      password: first.password,
    });
    assert.ok(oldLogin.error, "old password must be rejected after update");
    const newLogin = ensure(
      await first.client.auth.signInWithPassword({
        email: first.email,
        password: changedPassword,
      }),
      "sign-in after password update",
    );
    assert.equal(newLogin.user.id, first.id);
    pass(
      "password change rejects the old password and preserves the same account",
    );
    const second = await account();
    await api("/api/onboarding", second.session, {}, 404);
    const secondMeals = await api("/api/nutrition/meals/today", second.session);
    assert.equal(secondMeals.meals.length, 0);
    await api(
      `/api/nutrition/meals/${savedMeal.meal.id}`,
      second.session,
      { method: "DELETE" },
      404,
    );
    const stillThere = await api(
      "/api/nutrition/meals/today",
      newLogin.session,
    );
    assert.ok(stillThere.meals.some((meal) => meal.id === savedMeal.meal.id));
    pass("second account cannot read or delete the first account's meal");
    await api("/api/profile", null, {}, 401);
    pass("protected API rejects requests without sign-in");
  } finally {
    for (const { id, email } of created) {
      const inspected = await admin.auth.admin.getUserById(id);
      if (
        inspected.error ||
        inspected.data.user?.email !== email ||
        !/^fitai-smoke-[a-f0-9-]+@example\.com$/.test(email)
      ) {
        console.error(
          "Temporary account ownership could not be verified; cleanup skipped.",
        );
        process.exitCode = 1;
        continue;
      }
      const result = await admin.auth.admin.deleteUser(id);
      if (result.error) {
        console.error(
          "Temporary account cleanup failed; manual cleanup is required for this test run.",
        );
        process.exitCode = 1;
      } else console.log("Temporary test account and its linked data removed.");
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
