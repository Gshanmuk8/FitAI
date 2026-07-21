import React from 'react';
import Button from '../ui/Button';

// One render error must not white-screen the whole app. This catches it,
// shows a recoverable message, and logs the detail to the console.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        // The system's own empty-state frame: a narrow centred column with
        // real air around it. The old hardcoded 6rem/2rem margins were the
        // last measurements in this file that didn't come from the scale.
        <div className="dashboard-empty page-enter">
          <h1 className="page-title">Something went wrong</h1>
          <p className="muted" style={{ margin: '0 0 var(--s5)' }}>
            The error has been logged. Your data is safe.
          </p>
          {/* '/' is safe for both auth states — a crashed marketing page
              must not shove a logged-out visitor into the login wall. */}
          <Button
            type="button"
            onClick={() => { this.setState({ error: null }); window.location.assign('/'); }}
          >
            Take me back
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
