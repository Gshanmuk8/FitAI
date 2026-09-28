# FitAI — local redesign and verification

Reviewed 28 September 2026. The checks below were completed locally before the user authorized committing and pushing the changes to GitHub. No hosted database migration was performed. The follow-up verification created two uniquely named temporary accounts in the requested Supabase project and deleted both with their linked test data; existing users were not changed. This report records verification results, not proof that a subsequent automatic deployment succeeded.

## Follow-up: instant signup and failure recovery

The previously quoted signup work was not actually present: the guide recommended confirmation and the old smoke script created pre-confirmed admin users. Both are corrected. `verify-live-auth.cjs` now uses **public signup**, requires an immediate session, checks cleanup access before creating accounts, and deletes only the exact test IDs/emails it owns.

- **13 live API/SDK checks passed:** email confirmation disabled, public signup returns a session, onboarding saves a real AI plan, repeated onboarding preserves it, workouts/meals persist, returning login restores the account, token refresh works, a password change rejects the old password, cross-account access/deletion is denied, and unauthenticated access is rejected. Both temporary accounts were removed.
- The deployed site's public HTML returned 200 and its entry bundle references the correct new Supabase project and Render backend. No deployed code or auth settings were changed in this follow-up.
- A meal save/delete is now acknowledged even if a subsequent totals read or checklist update fails. The UI distinguishes saved data from delayed totals; refreshing the diary retries the derived sync.
- In-flight food actions share a per-account, per-tab lock across navigation. Returning to Fuel cannot submit the same pending action again. Acknowledged drafts clear even on another screen; late responses cannot recreate drafts cleared by logout. Reloading an interrupted request warns users to check the diary before retrying.
- Exercise-technique links explicitly select **Training**, instead of inheriting an earlier Nutrition conversation's mode.
- Diary writes check manual-value ownership atomically in PostgreSQL, including the associated completion flag, so a stale sync cannot overwrite a newer manual entry from another tab.
- **58 Chrome tests passed** (29 journeys each on desktop/mobile), expanding the original 32 with auth failures, logout privacy, backend outages, failed edits/deletions, delayed food saves, AI fallback and exercise-to-coach navigation. The final client production build passed.
- **149 unit tests passed** after the final changes. **25 SQL-bundle/database-backed checks passed**, including the new stale-diary/manual-entry race regression. The bundle still applies twice, records 12 migrations, enables RLS on 14 public tables and removes direct REST-role SELECT grants. The disposable database was stopped and its test directory removed; nothing in the hosted schema was changed.

These are scoped checks, not a guarantee of every possible failure. In particular, password-reset inbox delivery was **not** tested, and the browser journeys use fictional fixtures rather than production sessions.

## Product direction

FitAI is a daily fitness companion: build a realistic plan, do today's session, log food and daily habits, ask for contextual guidance, and review progress. The intended audience is someone who wants structure without having to interpret a complicated training dashboard.

The new **Rhythm** design uses warm neutrals, forest green, lime actions, generous spacing, restrained SVG graphics, and consistent cards. Desktop has a navigation rail; mobile has Today, Train, Fuel, Progress and Coach tabs. Plan and profile remain directly accessible. Light/dark themes, reduced-motion behavior, loading placeholders, empty states, inline errors and confirmations share one design system.

Engagement comes from a useful next action and visible recorded effort, not invented readiness scores or guilt for missing logs. No weather/forecast feature was found in the existing app; the review covered its fitness AI features.

## What changed

| Area                            | Product and flow improvements                                                                                                                                                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public pages and authentication | New landing and auth layouts; clear sign-in/sign-up/reset feedback, password visibility, preserved intended destination, and a coherent first-use experience.                                                                                                                      |
| Onboarding                      | Three focused steps, a review before generation, restored per-user drafts, validation, and protection against accidentally overwriting an existing plan.                                                                                                                           |
| Today                           | Actual logged progress, one prominent next session, food summaries, editable daily essentials, notes and custom habits. AI briefing is separate and can be refreshed after logging. Checklist requests are serialized to prevent out-of-order results.                             |
| Train                           | Restored logged set counts, one expanded movement at a time, large weight/reps controls, rest timer, extra-set logging and technique questions. Finishing early records only actual sets. Recovery days link to recovery coaching.                                                 |
| Fuel                            | Quick manual entry or photo estimates with an explicit review/edit step. Drafts survive navigation. A partial batch retry excludes already acknowledged saves. Diary deletion requires confirmation; manually entered daily totals are explained rather than silently overwritten. |
| Coach                           | Training, nutrition and recovery modes, useful starting questions, concise answers, per-tab conversation continuity, in-place retries and delayed replies that survive navigation. Fallback and older guidance are labelled honestly.                                              |
| Plan and profile                | Read mode first; intentional editing with drafts, save/discard controls and confirmation for destructive actions. Profile save is separate from plan regeneration. Partial regeneration failure acknowledges a successful profile save. Optional target weight can be cleared.     |
| Progress                        | Headline numbers and charts come from actual recorded data, independently of AI availability. Data tables accompany charts. Missing logs are unknown, not evidence of missed meals or exercise. AI interpretation is visibly separate.                                             |
| Memory                          | Categorized saved coaching notes with a new account-scoped forget action. The interface explains that notes, profile, activity logs and this tab's conversation are separate.                                                                                                      |

## AI reliability repairs

- Replaced Groq's retired free/developer Llama model default with `openai/gpt-oss-120b`, and moved the working Groq text fallback ahead of OpenRouter. Verified the replacement with a live synthetic plan. [Groq's migration notice](https://console.groq.com/docs/deprecations) and [supported models](https://console.groq.com/docs/models).
- Added a shared request budget covering queued and provider work. Response-body reads remain timeout-bound; Gemini requests are actively aborted. A timeout moves to another provider rather than consuming the full budget retrying the same one. HTTP 402 is not pointlessly retried.
- Plan output now specifies the actual validation bounds. Overlong AI-authored goal labels are shortened without discarding an otherwise valid plan; exercise limits and user-edit validation remain strict.
- Updated prompts for short, honest coaching, estimated nutrition targets, missing-data uncertainty, allergy limitations, and explicit professional referral for sharp pain. Prompts do not claim the assistant is a clinician.
- Tutor cache keys include the complete prompt context; food-analysis keys include prompt version. Stale cached responses are marked stale. Fallback conversations do not create AI-authored memory summaries.
- Validation diagnostics record field paths/codes, not raw model output. The opt-in live test prints sanitized outcomes and uses fictional profiles plus one public-domain image.

## Original redesign verification

| Check                                    | Result and scope                                                                                                                                                                                                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build:client`                   | Passed. Routes are split into separate bundles; main JS is about 419 KB / 123 KB gzip.                                                                                                                                                                                                               |
| `npm test`                               | **143 passed.** Auth recovery, account/cache isolation, calculations, route contracts, state helpers, timeout/queue behavior and new product regressions.                                                                                                                                            |
| `npm run test:e2e`                       | **32 passed in installed Chrome.** Desktop 1440×1000 and phone 390×844. Includes signup, sign-in redirect, password recovery, onboarding drafts, daily logs, workout restoration/early finish, meal removal/partial retries, delayed chat, plan drafts, profile partial success and memory deletion. |
| Accessibility/layout                     | Primary and public screens checked for horizontal overflow and serious/critical axe WCAG A/AA findings; none found in tested states. Both themes covered. This is not a full accessibility certification or real-device keyboard/camera test.                                                        |
| `node scripts/smoke-test.js`             | **24 database-backed steps passed** using disposable local PostgreSQL and migrations.                                                                                                                                                                                                                |
| `node scripts/smoke-test.js --setup-sql` | **24 passed.** SQL Editor bundle applies twice, records 12 migrations and protects 14 public tables. Account isolation and owner-only memory deletion verified.                                                                                                                                      |
| Live AI                                  | Genuine responses observed for plan, all three coach modes, briefing, progress, memory, non-food rejection and food recognition. The public-domain banana photo returned a schema-valid editable estimate. These are integration/behavior checks, not clinical or calorie-accuracy validation.       |
| `npm audit --audit-level=low`            | **0 reported vulnerabilities.** Dependencies updated without a forced upgrade.                                                                                                                                                                                                                       |
| Repository checks                        | `git diff --check` passed. No staged changes; HEAD remains `fe34534d23f4601d3b348d734aae0f0134b888a3`. Tracked diff scan found no added JWT, secret-key or credential-bearing database URL patterns.                                                                                                 |

Chrome tests use **isolated fictional API/auth fixtures**, not a real Supabase session. Database tests use temporary local data. Live AI checks exercise real providers separately. The original pass did not test production Supabase signup; the follow-up above does. Neither pass tested password-reset email delivery or modified hosted authentication settings.

Screenshots are in ignored `test-results/`. Example: [desktop Today](../test-results/journeys-all-primary-scree-b62d9-erious-accessibility-errors-desktop/dashboard.png), [mobile Train](../test-results/journeys-all-primary-scree-b62d9-erious-accessibility-errors-mobile/workout.png), [mobile dark Memory](../test-results/journeys-dark-theme-has-re-497ca--pages-on-phone-and-desktop-mobile/dark-memory.png). All screenshot data is fictional.

## Remaining limits and release requirements

1. **Provider capacity remains a real constraint.** Tests observed Gemini/OpenRouter 429s and Cerebras HTTP 402 quota exhaustion. In one full run, seven text checks returned live AI while vision correctly fell back. After cooldown, both the non-food and real-food vision checks returned genuine AI. Free quotas cannot guarantee an uninterrupted demo; increase provider capacity or use manual food entry if throttled. No billing/account changes were made.
2. Food quantities/macros are estimates requiring review. A successful banana example does not validate arbitrary mixed meals, hidden ingredients or allergens. AI output still needs normal product monitoring and broader evaluation.
3. Confirmed partial saves are protected against duplicate retry, but a connection lost after a server write and before acknowledgement is not an exactly-once guarantee. Check the diary before resubmitting an uncertain save. The interface provides a refresh/warning for this case.
4. A GitHub push is not proof of a successful live deployment. Release and verify frontend **and backend** together (memory deletion needs the new backend route). No additional SQL migration is required for this redesign. The existing bundle is `scripts/supabase-setup.sql`; do not rerun it on production just because the UI changed.
5. Use Node 20 or newer for the upgraded client toolchain/router. Public signup/returning login and deployed CORS passed the follow-up live API test. After an authorized deployment, still perform a production-browser smoke journey and a real-inbox password-reset test. Disabling signup confirmation does not verify reset-email delivery; see [Supabase SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp).
6. Rotate the database password/service-role credentials previously pasted into chat, and invalidate exposed sessions. Do not paste replacements into chat or commit environment files. Rotation was not performed automatically.

The test food image is [Banana fruit on white background](https://commons.wikimedia.org/wiki/File:Banana_fruit_on_white_background.jpg), by Titus Tscharntke, public domain. It is fetched only by the opt-in `vision-food` check and is not shipped as an app asset.

## Re-run locally

From `C:\Users\madara\fitai\fitai`:

```powershell
npm test
npm run build:client
npm run test:e2e
node scripts/smoke-test.js --setup-sql
npm audit --audit-level=low
```

`npm run test:ai:live` is opt-in: it uses configured provider keys and consumes their quotas. Run a single scenario with, for example, `node scripts/check-ai-flows.cjs vision-food`. No Git or deployment action is part of these commands.
