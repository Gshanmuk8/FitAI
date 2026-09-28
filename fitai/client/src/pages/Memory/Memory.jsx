import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMemoryTimeline, deleteMemory } from "../../services/memoryService";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import {
  PageHeader,
  LoadingState,
  EmptyState,
  ConfirmDialog,
} from "../../components/ui/PageKit";

export default function Memory() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [remove, setRemove] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      setSummaries(await getMemoryTimeline());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function forget() {
    if (busy || !remove) return;
    setBusy(true);
    setError("");
    try {
      await deleteMemory(remove.id);
      setSummaries((s) => s.filter((m) => m.id !== remove.id));
      setNotice(
        "Memory removed. New coaching requests will no longer include this note.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setRemove(null);
    }
  }
  if (loading)
    return (
      <LoadingState
        title="The details that make it yours"
        detail="Loading your coach’s saved notes."
      />
    );
  const categories = [
    ...new Set(summaries.map((s) => s.category || "conversation")),
  ];
  const visible =
    filter === "all"
      ? summaries
      : summaries.filter((s) => (s.category || "conversation") === filter);
  return (
    <div className="page page-mid page-enter">
      <PageHeader
        eyebrow="CONTEXT, NOT GUESSWORK"
        title="What your coach remembers."
        description="Useful details from conversations and your plan history. Review them, and remove anything that no longer fits."
      >
        <Link to="/tutor" className="btn btn-ghost">
          <Icon name="coach" size={16} />
          Ask your coach
        </Link>
      </PageHeader>
      <p className="notice">
        These are saved summaries, not complete chat transcripts. Your profile
        and activity logs are separate sources of context. To change a goal or
        injury, update your <Link to="/profile">profile</Link> too.
      </p>
      {notice && (
        <p className="success-text small" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="notice tone-red" role="alert">
          <p>{error}</p>
          <Button variant="ghost" onClick={load}>
            Try again
          </Button>
        </div>
      )}
      {!error && !summaries.length && (
        <EmptyState
          icon="memory"
          title="A little context goes a long way."
          description="As you chat, useful preferences and constraints may be saved here. You can always review and remove them."
        >
          <Link to="/tutor" className="btn btn-primary">
            Start a conversation
          </Link>
        </EmptyState>
      )}
      {!!summaries.length && (
        <>
          <div
            className="memory-filters"
            role="group"
            aria-label="Filter saved memories"
          >
            {["all", ...categories].map((c) => (
              <button
                className={`mode-pill${filter === c ? " active" : ""}`}
                key={c}
                aria-pressed={filter === c}
                onClick={() => setFilter(c)}
              >
                {c === "all" ? `All notes · ${summaries.length}` : c}
              </button>
            ))}
          </div>
          <ul className="memory-list">
            {visible.map((s) => (
              <li className="memory-entry" key={s.id}>
                <time dateTime={s.created_at}>
                  {new Date(s.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
                <article className="card">
                  <p>{s.summary}</p>
                  <div className="section-heading" style={{ marginBottom: 0 }}>
                    <span className="chip">{s.category || "conversation"}</span>
                    <button
                      className="ghost-button"
                      aria-label={`Forget memory: ${s.summary}`}
                      onClick={() => setRemove(s)}
                    >
                      Forget this note
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
          <p className="field-hint">
            Showing up to 200 saved notes, newest first. Removing a note does
            not delete its original activity or previously generated advice.
          </p>
        </>
      )}
      <ConfirmDialog
        open={Boolean(remove)}
        title="Forget this note?"
        confirmLabel="Forget note"
        busy={busy}
        onCancel={() => setRemove(null)}
        onConfirm={forget}
      >
        <p>{remove?.summary}</p>
        <p>
          This removes the saved memory permanently. It does not change your
          profile, plan, activity history, or existing chat.
        </p>
      </ConfirmDialog>
    </div>
  );
}
