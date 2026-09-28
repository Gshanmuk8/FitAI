const { test, expect } = require("./fixtures.cjs");
const AxeBuilder = require("@axe-core/playwright").default;

test("new accounts enter onboarding immediately when confirmation is disabled", async ({
  page,
  product,
}) => {
  product.missing = true;
  await page.goto("/signup");
  await page.getByLabel("Email", { exact: true }).fill("new-user@fitai.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-test-password");
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page).toHaveURL(/onboarding/);
  await expect(
    page.getByRole("heading", { name: "What moves you?" }),
  ).toBeVisible();
});

test("password recovery gives feedback and requires matching new passwords", async ({
  page,
  product,
}) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill("alex@fitai.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  await product.signIn();
  await page.goto("/reset-password");
  await page
    .getByLabel("New password", { exact: true })
    .fill("fictional-new-password");
  await page.getByLabel("Confirm new password").fill("not-the-same-password");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByRole("alert")).toContainText("don’t match");
  await page.getByLabel("Confirm new password").fill("fictional-new-password");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your password has been updated",
  );
});

test("daily logging saves values, notes and custom habits without false success on failure", async ({
  page,
  product,
}) => {
  await product.signIn();
  await page.goto("/dashboard");
  await page.getByLabel("Log water_ml").fill("2");
  await page.getByLabel("Log water_ml").press("Enter");
  await expect.poll(() => product.checklist.water_ml).toBe(2000);
  await page
    .getByLabel("Notes for today")
    .fill("Good energy, comfortable session.");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect
    .poll(() => product.checklist.notes)
    .toBe("Good energy, comfortable session.");
  await page.getByLabel("Add your own checklist item").fill("Walk outside");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Walk outside" }),
  ).toBeVisible();
  product.fail["/api/checklist/today"] = 503;
  await page.getByRole("checkbox", { name: "Workout", exact: true }).click();
  await expect(
    page.getByText("Couldn't update:", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Workout", exact: true }),
  ).not.toBeChecked();
  product.fail["/api/checklist/today"] = false;
  await page.reload();
  await expect(page.getByLabel("Notes for today")).toHaveValue(
    "Good energy, comfortable session.",
  );
  await expect(
    page.getByRole("checkbox", { name: "Walk outside" }),
  ).toBeVisible();
});

test("AI outages are labelled honestly and recovery days remain usable", async ({
  page,
  product,
}) => {
  product.aiSource = "fallback";
  await product.signIn();
  await page.goto("/dashboard");
  await expect(
    page.getByText("Personalized AI guidance is temporarily unavailable.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.goto("/progress");
  await expect(
    page.getByText("Your effort is here. The insight can wait."),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Weight trend chart" }),
  ).toBeVisible();
  product.checklist.plan_snapshot.workout = {
    type: "rest",
    exercises: [],
    weekday: "Monday",
  };
  await page.goto("/workout");
  await expect(
    page.getByRole("heading", { name: "Rest is part of the plan." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Finish session" }),
  ).toHaveCount(0);
});

test("all primary screens render without overflow or serious accessibility errors", async ({
  page,
  product,
}, testInfo) => {
  await product.signIn();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of [
    "/dashboard",
    "/workout",
    "/nutrition",
    "/tutor",
    "/plan",
    "/progress",
    "/profile",
    "/memory",
  ]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator(".page-loading, .loading-card")).toHaveCount(0);
    await expect(page.locator("main .page-title")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      route + " overflow",
    ).toBe(true);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations
        .filter((v) => ["critical", "serious"].includes(v.impact))
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      route,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(route.slice(1) + ".png"),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});

test("training restores counts and finishing early never invents sets", async ({
  page,
  product,
}) => {
  await product.signIn();
  await page.goto("/workout");
  await expect(
    page.getByRole("button", { name: "Log set 2", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log set 2", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Log set 3", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Log set 3", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Finish session", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Finish with logged sets" }).click();
  await expect(page.getByText("Session in the books.")).toBeVisible();
  expect(product.sets["Goblet squat"]).toBe(2);
  expect(product.checklist.workout_completed).toBe(true);
});

test("public pages and auth have no serious accessibility errors", async ({
  page,
  product,
}, testInfo) => {
  for (const route of [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/features",
    "/about",
    "/learn",
    "/terms",
    "/privacy",
    "/not-a-page",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      route,
    ).toBe(true);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations
        .filter((v) => ["critical", "serious"].includes(v.impact))
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      route,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(route.replaceAll("/", "") || "home") + ".png",
      fullPage: true,
    });
  }
});

test("sign-in restores access to the requested route", async ({
  page,
  product,
}) => {
  await page.goto("/nutrition");
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Email", { exact: true }).fill("alex@fitai.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/nutrition/);
  await expect(
    page.getByRole("heading", { name: "Fuel your rhythm." }),
  ).toBeVisible();
});

test("onboarding drafts survive reload and create a plan in three steps", async ({
  page,
  product,
}) => {
  product.missing = true;
  await product.signIn();
  await page.goto("/onboarding");
  await page.getByRole("button", { name: /Feel my best/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Age", { exact: true }).fill("28");
  await page.getByLabel("Height · cm").fill("175");
  await page.getByLabel("Current weight · kg").fill("75");
  await page.reload();
  await expect(page.getByLabel("Age", { exact: true })).toHaveValue("28");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Training days each week").selectOption("3");
  await page
    .getByRole("button", { name: "Build my plan", exact: true })
    .click();
  await expect(page).toHaveURL(/plan/);
  await expect(
    page.getByRole("heading", { name: "Made for your week." }),
  ).toBeVisible();
  expect(
    product.calls.find(
      (c) => c.path === "/api/onboarding" && c.method === "POST",
    ).body.trainingDaysPerWeek,
  ).toBe(3);
});

test("manual food entry and deletion update the visible diary", async ({
  page,
  product,
}) => {
  await product.signIn();
  await page.goto("/nutrition");
  await page.getByLabel("Food or meal").fill("Lunch test");
  await page.getByLabel("Calories · kcal", { exact: true }).fill("480");
  await page.getByLabel("Protein · g", { exact: true }).fill("25");
  await page.getByRole("button", { name: "Add to diary" }).click();
  await expect(
    page.locator(".diary-item").filter({ hasText: "Lunch test" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove Lunch test" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel" })
    .click();
  expect(product.meals).toHaveLength(2);
  await page.getByRole("button", { name: "Remove Lunch test" }).click();
  await page.getByRole("button", { name: "Remove meal", exact: true }).click();
  await expect(
    page.locator(".diary-item").filter({ hasText: "Lunch test" }),
  ).toHaveCount(0);
  expect(product.meals).toHaveLength(1);
});

test("photo review can retry a partial save without duplicating acknowledged foods", async ({
  page,
  product,
}) => {
  await product.signIn();
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Photo estimate" }).click();
  await page
    .getByLabel("Upload food photo")
    .setInputFiles({
      name: "synthetic-image.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(
    page.getByRole("heading", { name: "Review your plate" }),
  ).toBeVisible();
  product.fail["/api/nutrition/meals"] = ({ body }) =>
    body.name === "Chickpeas" ? 503 : false;
  await page.getByRole("button", { name: "Add 2 items to diary" }).click();
  await expect(page.getByRole("alert")).toContainText("1 already saved");
  await expect(page.locator(".food-estimate")).toHaveCount(1);
  product.fail["/api/nutrition/meals"] = false;
  await page.getByRole("button", { name: "Add 1 item to diary" }).click();
  await expect(page.locator(".food-estimate")).toHaveCount(0);
  expect(product.meals.filter((m) => m.name === "Brown rice")).toHaveLength(1);
  expect(product.meals.filter((m) => m.name === "Chickpeas")).toHaveLength(1);
});

test("coach retries failures and keeps delayed replies across navigation", async ({
  page,
  product,
}) => {
  await product.signIn();
  await page.goto("/tutor");
  product.fail["/api/ai/tutor"] = 503;
  await page.getByLabel("Message your coach").fill("Help me build a routine");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("button", { name: "Try this question again" }),
  ).toBeVisible();
  product.fail["/api/ai/tutor"] = false;
  let release;
  product.holdTutor = new Promise((resolve) => {
    release = resolve;
  });
  await page.getByRole("button", { name: "Try this question again" }).click();
  // Client-side navigation, not a new document: the request can finish.
  await page.locator('a[href="/workout"]:visible').first().click();
  await expect(page).toHaveURL(/workout/);
  release();
  await page.locator('a[href="/tutor"]:visible').first().click();
  await expect(
    page.getByText("Keep three training days this week.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".chat-bubble.user")).toHaveCount(1);
  await expect(page.locator(".chat-bubble.coach")).toHaveCount(1);
});

test("plan edits stay drafts until explicitly saved", async ({
  page,
  product,
}) => {
  await product.signIn();
  await page.goto("/plan");
  await page.getByRole("button", { name: "Edit plan", exact: true }).click();
  await page.getByLabel("Name of day 1").fill("A calmer Monday");
  await page.locator('a[href="/tutor"]:visible').first().click();
  await page.locator('a[href="/plan"]:visible').first().click();
  await expect(page.getByLabel("Name of day 1")).toHaveValue("A calmer Monday");
  expect(product.plan.days[0].name).toBe("Full-body strength");
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(page.getByText("Plan saved.", { exact: false })).toBeVisible();
  expect(product.plan.days[0].name).toBe("A calmer Monday");
});

test("profile can clear a target and regeneration failure acknowledges the successful profile save", async ({
  page,
  product,
}) => {
  product.profile.target_weight_kg = 80;
  await product.signIn();
  await page.goto("/profile");
  await page.getByLabel("Target weight · kg (optional)").fill("");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Profile saved");
  expect(product.profile.target_weight_kg).toBeNull();
  product.fail["/api/plan/regenerate"] = 503;
  await page.getByRole("button", { name: "Rebuild my plan" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Save profile & rebuild" }).click();
  await expect(page.getByRole("alert")).toContainText("Your profile was saved");
  await expect(page).toHaveURL(/profile/);
});

test("memory deletion is explicit and persists on reload", async ({
  page,
  product,
}) => {
  await product.signIn();
  await page.goto("/memory");
  await page.getByRole("button", { name: /^Forget memory:/ }).click();
  await page.getByRole("button", { name: "Forget note", exact: true }).click();
  await expect(
    page.getByText("A little context goes a long way."),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("A little context goes a long way."),
  ).toBeVisible();
  expect(product.memoryDeleted).toBe(true);
});

test("dark theme has readable primary pages on phone and desktop", async ({
  page,
  product,
}, testInfo) => {
  await product.signIn();
  await page.goto("/dashboard");
  await page.evaluate(() => {
    localStorage.setItem("fitai.theme", "dark");
    document.documentElement.dataset.theme = "dark";
  });
  for (const route of [
    "/dashboard",
    "/workout",
    "/nutrition",
    "/tutor",
    "/plan",
    "/progress",
    "/profile",
    "/memory",
  ]) {
    await page.goto(route);
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    await expect(page.locator("main .page-title")).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations
        .filter((v) => ["critical", "serious"].includes(v.impact))
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      route,
    ).toEqual([]);
  }
  await page.screenshot({
    path: testInfo.outputPath("dark-memory.png"),
    fullPage: true,
  });
});
