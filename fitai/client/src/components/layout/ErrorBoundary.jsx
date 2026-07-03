import React from 'react';

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
        <div style={{ maxWidth: 480, margin: '6rem auto', padding: '0 2rem', textAlign: 'center' }}>
          <h2 className="page-title">Something went wrong</h2>
          <p className="muted">The error has been logged. Your data is safe.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { this.setState({ error: null }); window.location.assign('/dashboard'); }}
          >
            Back to dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
