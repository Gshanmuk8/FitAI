const { test, expect } = require("./fixtures.cjs");

test("training cannot restart from zero when saved set counts fail to load", async ({
  page,
  product,
}) => {
  await product.signIn();
  product.fail["/api/workout/today-sets"] = 503;
  await page.goto("/workout");
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Log set/ })).toHaveCount(0);
  delete product.fail["/api/workout/today-sets"];
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Log set 2", exact: true }),
  ).toBeVisible();
});

test("exercise guidance enters training mode even after a nutrition conversation", async ({
  page,
  product,
}) => {
  await product.signIn();
  await page.goto("/tutor");
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await page.locator('a[href="/workout"]:visible').first().click();
  await page
    .getByRole("link", { name: "Ask your coach about this movement" })
    .click();
  await expect(
    page.getByRole("button", { name: "Training", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Message your coach")).toHaveValue(
    "Help me with safe technique for Goblet squat.",
  );
  await page.getByRole("button", { name: "Send message" }).click();
  await expect
    .poll(
      () => product.calls.find((c) => c.path === "/api/ai/tutor")?.body.mode,
    )
    .toBe("gym");
});

test("a failed memory deletion keeps the note visible and can be retried", async ({
  page,
  product,
}) => {
  await product.signIn();
  const endpoint = "/api/memory/summaries/a0000000-0000-4000-8000-000000000002";
  product.fail[endpoint] = 503;
  await page.goto("/memory");
  await page.getByRole("button", { name: /^Forget memory:/ }).click();
  await page.getByRole("button", { name: "Forget note", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("interrupted");
  await expect(
    page.getByRole("button", { name: /^Forget memory:/ }),
  ).toBeVisible();
  expect(product.memoryDeleted).not.toBe(true);
  delete product.fail[endpoint];
  await page.getByRole("button", { name: /^Forget memory:/ }).click();
  await page.getByRole("button", { name: "Forget note", exact: true }).click();
  await expect(
    page.getByText("A little context goes a long way."),
  ).toBeVisible();
});

async function credentials(page) {
  await page.getByLabel("Email", { exact: true }).fill("alex@fitai.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-test-password");
}

test("invalid credentials keep the form usable and retry returns to the requested page", async ({
  page,
  product,
}) => {
  product.authFail["/auth/v1/token"] = {
    code: "invalid_credentials",
    msg: "Invalid login credentials",
  };
  await page.goto("/nutrition");
  await credentials(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/password|credentials/i);
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "alex@fitai.test",
  );
  await expect(page).toHaveURL(/login/);
  delete product.authFail["/auth/v1/token"];
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/nutrition/);
});

test("signup failures allow retry without showing a false confirmation", async ({
  page,
  product,
}) => {
  product.missing = true;
  product.authFail["/auth/v1/signup"] = {
    code: "user_already_exists",
    msg: "User already registered",
  };
  await page.goto("/signup");
  await credentials(page);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page.getByRole("alert")).toContainText(/already registered/i);
  await expect(
    page.getByRole("heading", { name: "Confirm your email" }),
  ).toHaveCount(0);
  delete product.authFail["/auth/v1/signup"];
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/onboarding/);
});

test("confirmation-required accounts never appear signed in before confirmation", async ({
  page,
  product,
}) => {
  product.confirmationRequired = true;
  await page.goto("/signup");
  await credentials(page);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(
    page.getByRole("heading", { name: "Confirm your email" }),
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
});

test("signing out clears account drafts and stays signed out after reload", async ({
  page,
  product,
}) => {
  await product.signIn();
  await page.goto("/nutrition");
  await page.getByLabel("Food or meal").fill("Private unsaved meal");
  await page.locator('a[href="/profile"]:visible').first().click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  const remaining = await page.evaluate(() =>
    [localStorage, sessionStorage].flatMap((s) =>
      Object.keys(s).filter(
        (k) => k.startsWith("fitai.") && k !== "fitai.theme",
      ),
    ),
  );
  expect(remaining).toEqual([]);
  await page.goto("/nutrition");
  await expect(page).toHaveURL(/login/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});

test("a backend outage does not erase the account or offer replacement onboarding", async ({
  page,
  product,
}) => {
  await product.signIn();
  product.fail["/api/onboarding"] = 503;
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Let’s reconnect." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Build my plan" })).toHaveCount(
    0,
  );
  await expect(page).toHaveURL(/dashboard/);
  delete product.fail["/api/onboarding"];
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Make today count." }),
  ).toBeVisible();
});

test("failed plan saves retain the draft and can be retried", async ({
  page,
  product,
}) => {
  await product.signIn();
  await page.goto("/plan");
  await page.getByRole("button", { name: "Edit plan", exact: true }).click();
  await page.getByLabel("Name of day 1").fill("My edited strength day");
  product.fail["/api/plan"] = ({ method }) => (method === "PUT" ? 503 : false);
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("interrupted");
  await expect(page.getByLabel("Name of day 1")).toHaveValue(
    "My edited strength day",
  );
  expect(product.plan.days[0].name).toBe("Full-body strength");
  delete product.fail["/api/plan"];
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(page.getByText("Plan saved.", { exact: false })).toBeVisible();
});

test("a meal acknowledged after navigation is not left in the unsaved draft", async ({
  page,
  product,
}) => {
  await product.signIn();
  let release;
  product.holdMeal = new Promise((resolve) => {
    release = resolve;
  });
  await page.goto("/nutrition");
  await page.getByLabel("Food or meal").fill("Navigation-safe lunch");
  await page.getByLabel("Calories · kcal", { exact: true }).fill("400");
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect
    .poll(
      () =>
        product.calls.filter((c) => c.path === "/api/nutrition/meals").length,
    )
    .toBe(1);
  await page.locator('a[href="/workout"]:visible').first().click();
  await expect(page).toHaveURL(/workout/);
  release();
  await expect.poll(() => product.meals.length).toBe(2);
  await page.locator('a[href="/nutrition"]:visible').first().click();
  await expect(
    page.locator(".diary-item").filter({ hasText: "Navigation-safe lunch" }),
  ).toBeVisible();
  await expect(page.getByLabel("Food or meal")).toHaveValue("");
  expect(
    product.meals.filter((m) => m.name === "Navigation-safe lunch"),
  ).toHaveLength(1);
});

test("a delayed save stays locked when navigating away and back", async ({
  page,
  product,
}) => {
  await product.signIn();
  let release;
  product.holdMeal = new Promise((resolve) => {
    release = resolve;
  });
  await page.goto("/nutrition");
  await page.getByLabel("Food or meal").fill("One lunch, once");
  await page.getByLabel("Calories · kcal", { exact: true }).fill("400");
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect
    .poll(
      () =>
        product.calls.filter((c) => c.path === "/api/nutrition/meals").length,
    )
    .toBe(1);
  await page.locator('a[href="/workout"]:visible').first().click();
  await page.locator('a[href="/nutrition"]:visible').first().click();
  await expect(page.getByLabel("Food or meal")).toBeDisabled();
  release();
  await expect(page.getByLabel("Food or meal")).toBeEnabled();
  await expect(page.getByLabel("Food or meal")).toHaveValue("");
  expect(
    product.meals.filter((m) => m.name === "One lunch, once"),
  ).toHaveLength(1);
});

test("meal removal reports delayed totals instead of promising an update", async ({
  page,
  product,
}) => {
  await product.signIn();
  product.syncWarning =
    "Meal change saved, but today’s totals could not be refreshed.";
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Remove Paneer grain bowl" }).click();
  await page.getByRole("button", { name: "Remove meal", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "totals could not be refreshed",
  );
  await expect(page.locator(".diary-item")).toHaveCount(0);
});

test("food AI failure leaves a clear path to manual logging", async ({
  page,
  product,
}) => {
  await product.signIn();
  product.aiSource = "fallback";
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Photo estimate" }).click();
  await page.getByLabel("Upload food photo").setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.getByText("Photo AI is unavailable right now.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".food-estimate")).toHaveCount(0);
  await page.getByRole("button", { name: "Use quick entry" }).click();
  await page.getByLabel("Food or meal").fill("Manual after AI outage");
  await page.getByLabel("Calories · kcal", { exact: true }).fill("250");
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(
    page.locator(".diary-item").filter({ hasText: "Manual after AI outage" }),
  ).toBeVisible();
});
