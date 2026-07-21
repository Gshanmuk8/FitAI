import React from 'react';

// Same editorial frame as Terms. Privacy has no clause numbers in its copy,
// so the headings run unnumbered against the same hairline rhythm.
const SECTION = {
  borderTop: '1px solid var(--border)',
  paddingTop: 'var(--s5)',
  marginTop: 'var(--s5)',
};
const HEAD = { marginTop: 0, marginBottom: 'var(--s3)' };

export default function Privacy() {
  return (
    <div className="page page-mid page-enter">
      <h1 className="page-title">Privacy Policy</h1>
      {/* Outside .prose so the standfirst rule can't promote it to display
          size — it is a timestamp, and metadata never outranks its content. */}
      <p className="tiny faint mono" style={{ margin: 0 }}>Last updated: January 2026</p>

      <div className="prose">
        <section style={SECTION}>
          <h2 style={HEAD}>What we collect</h2>
          <ul style={{ margin: 0 }}>
            <li><strong>Account:</strong> your email address (via our authentication provider, Supabase).</li>
            <li><strong>Profile:</strong> what you enter at onboarding — age, sex, height, weight, target weight, goal, timeframe, activity level, injuries, dietary restrictions, equipment, timezone.</li>
            <li><strong>Activity:</strong> what you log — workouts, sets, weigh-ins, meals, daily checklist completion.</li>
            <li><strong>Coach memory:</strong> short, one-line summaries of durable facts from your coaching chats (e.g. "has a shoulder injury"). Full chat transcripts are <strong>not</strong> stored.</li>
            <li><strong>Food photos:</strong> processed in memory to estimate nutrition, then discarded — photos are not saved to our servers.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEAD}>How we use it</h2>
          <p style={{ margin: 0 }}>
            Exclusively to run the product: generating and adapting your plan, computing your targets
            and pace, and giving the AI coach the context to answer as <em>your</em> coach. We do not
            sell your data, show ads, or use your data to profile you for third parties.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEAD}>AI processing</h2>
          <p style={{ margin: 0 }}>
            When you use AI features (plan generation, coach chat, food photo analysis, the daily
            briefing), relevant context — profile facts, memory summaries, logged history, your question
            or photo — is sent to third-party AI providers (such as Google Gemini) to generate the
            response. Providers may change; responses are validated before reaching you, and which
            provider answered is never exposed. Deterministic features (calorie targets, safety bounds,
            progression) involve no AI processing at all.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEAD}>What the coach remembers — and your control</h2>
          <p style={{ margin: 0 }}>
            The Memory page shows every durable fact the coach has stored about you, categorized and
            ranked. That transparency is a design principle: you should never wonder what an AI knows
            about you.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEAD}>Storage and security</h2>
          <p style={{ margin: 0 }}>
            Data is stored in a Postgres database with per-user isolation, accessed only through
            authenticated APIs (bearer tokens verified on every request). Inputs are validated
            server-side; secrets are never exposed to the browser.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEAD}>Retention and deletion</h2>
          <p style={{ margin: 0 }}>
            Your data is kept while your account is active. Deleting your account removes your profile
            and all associated records (they cascade at the database level). To request deletion,
            contact us at the address below.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEAD}>Contact</h2>
          <p style={{ margin: 0 }}>Privacy questions or deletion requests: gsaikrishnad@gmail.com.</p>
        </section>
      </div>
    </div>
  );
}
