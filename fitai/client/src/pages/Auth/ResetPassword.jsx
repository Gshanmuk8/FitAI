import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { updatePassword } from "../../services/authService";
import Button from "../../components/ui/Button";
import PasswordField from "../../components/ui/PasswordField";
import { LoadingState } from "../../components/ui/PageKit";

// Users land here from the email link — Supabase establishes a recovery
// session on arrival, so useAuth().user is set. Direct visits without a
// recovery session get pointed back to the request form.
export default function ResetPassword() {
  const { user, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (password !== confirm) {
      setError("The passwords don’t match yet. Please check them.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState title="Checking your reset link" />;
  if (saved)
    return (
      <div className="page page-form">
        <h1 className="page-title">You’re all set.</h1>
        <p role="status">Your password has been updated.</p>
        <Button onClick={() => navigate("/dashboard")}>Back to my space</Button>
      </div>
    );
  if (!user) {
    return (
      <div className="page page-form page-enter">
        <div className="auth-card">
          <h1 className="page-title">Link expired</h1>
          <p className="muted" style={{ margin: 0 }}>
            This reset link is invalid or has expired. Request a new one from
            the sign-in page.
          </p>
          <Link to="/forgot-password">Request a new reset link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-form page-enter">
      <form onSubmit={handleSubmit}>
        <h1 className="page-title">Choose a new password</h1>

        <label className="label" htmlFor="reset-password">
          New password
        </label>
        <PasswordField
          id="reset-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          minLength={8}
          required
          disabled={busy}
        />
        <label className="label" htmlFor="reset-confirm">
          Confirm new password
        </label>
        <PasswordField
          id="reset-confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          disabled={busy}
        />

        {error && (
          <p
            role="alert"
            className="error-text"
            style={{ margin: "var(--s3) 0 0" }}
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={busy}
          style={{ width: "100%", marginTop: "var(--s5)" }}
        >
          {busy ? "Saving…" : "Set new password"}
        </Button>
      </form>
    </div>
  );
}
