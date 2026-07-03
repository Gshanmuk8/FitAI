import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';

export default function About() {
  return (
    <div className="page page-mid page-enter prose">
      <h2 className="page-title">About FitAI</h2>

      <h2>What is this?</h2>
      <p>
        FitAI is an AI fitness coach. You tell it who you are, what you want to achieve, and{' '}
        <strong>by when</strong> — it builds a personalized workout and diet plan, then coaches you
        every single day: a daily mission that adapts to how yesterday actually went, an AI coach
        that remembers your injuries and preferences long-term, photo-based food logging, and honest
        pace tracking that tells you whether you're ahead of schedule, on track, or behind — and why.
      </p>

      <h2>Who is it for?</h2>
      <p>
        Anyone with a body and a goal: complete beginners who don't know where to start, busy
        professionals who need decisions made for them, people losing weight who want a realistic
        timeline instead of a crash diet, lifters chasing progressive overload, and people getting
        back into fitness after time away. If your circumstances are unusual — injuries, home-only
        equipment, dietary restrictions — that's exactly the context FitAI is built to respect.
      </p>

      <h2>Why are we building it?</h2>
      <p>
        Modern fitness apps force you to become your own trainer, nutritionist, physiotherapist,
        analyst, and motivator — five jobs spread across five disconnected screens. Trackers record
        what happened but never tell you <strong>what to do about it</strong>. Coaches who do are
        expensive and don't scale.
      </p>
      <p>
        FitAI unifies those jobs into one intelligence layer with three principles:
      </p>
      <ul>
        <li><strong>Memory.</strong> A coach you have to re-brief every session isn't a coach. FitAI permanently remembers your injuries, preferences, and progress — and learns from every plan edit you make.</li>
        <li><strong>Honesty.</strong> Pace, adherence, and projections are computed from your own logged data with transparent math — never invented by an AI. If you're behind, it says so, and says why.</li>
        <li><strong>Adaptation.</strong> A plan that ignores a missed workout or a bad night's sleep is a PDF, not a program. Your daily mission rebuilds itself every morning.</li>
      </ul>

      <p style={{ marginTop: '2rem' }}>
        <Link to="/signup"><Button>Get started</Button></Link>
      </p>
    </div>
  );
}
