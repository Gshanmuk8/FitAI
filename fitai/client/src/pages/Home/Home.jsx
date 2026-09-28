import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import ButtonLink from "../../components/ui/ButtonLink";
import Icon from "../../components/ui/Icon";
import { Ring } from "../../components/ui/PageKit";
export default function Home() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" replace />;
  return (
    <div className="landing page-enter">
      <section className="landing-hero">
        <div>
          <p className="eyebrow">LESS GUESSWORK. MORE YOU.</p>
          <h1>
            A little better.
            <br />
            <em>Every day.</em>
          </h1>
          <p className="standfirst">
            Training, nutrition, and a coach that connects the dots. Find a
            rhythm that fits your life—and build on it.
          </p>
          <div className="button-row">
            <ButtonLink to="/signup">
              Find my rhythm <Icon name="arrow" size={17} />
            </ButtonLink>
            <ButtonLink to="/learn" variant="ghost">
              Explore the experience
            </ButtonLink>
          </div>
          <p className="hero-footnote">
            <Icon name="shield" size={15} /> Built around your goals. No
            wearable required.
          </p>
        </div>
        <aside
          className="hero-device"
          aria-label="Illustrative preview of the FitAI dashboard"
        >
          <span className="sample-label">SAMPLE DAY</span>
          <p className="eyebrow">YOUR DAILY RHYTHM</p>
          <h2>
            Small wins.
            <br />
            Real momentum.
          </h2>
          <div className="rhythm-card">
            <Ring value={4} total={6} size={135} />
            <div>
              <h3>You're showing up.</h3>
              <p>
                Every small step
                <br />
                moves you forward.
              </p>
            </div>
          </div>
          <div className="device-row">
            <Icon name="train" />
            <span>Full-body strength</span>
            <span>3 exercises</span>
          </div>
          <div className="device-row">
            <Icon name="fuel" />
            <span>Fuel for your day</span>
            <span>Log a meal</span>
          </div>
          <div className="device-coach">
            <p className="eyebrow">YOUR COACH, IN YOUR CORNER</p>Make room for
            recovery. Consistency includes knowing when to take it easy.
          </div>
        </aside>
      </section>
      <section className="benefit-grid" aria-label="What makes FitAI different">
        {[
          [
            "01",
            "A plan with your name on it.",
            "Your goals, available equipment, schedule, and preferences shape your training. Make it yours as life changes.",
          ],
          [
            "02",
            "The big picture, made clear.",
            "Bring meals, workouts, and daily habits into one place. See progress from what you actually log.",
          ],
          [
            "03",
            "Coaching with context.",
            "Ask a follow-up, talk through a tough week, or find your next step. Your coach keeps useful facts in memory.",
          ],
        ].map(([n, title, body]) => (
          <article key={n}>
            <span className="benefit-index">{n} /</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
