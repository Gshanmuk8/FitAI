import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import Home from './pages/Home/Home';
import Dashboard from './pages/Dashboard/Dashboard';
import Profile from './pages/Profile/Profile';
import Nutrition from './pages/Nutrition/Nutrition';
import Workout from './pages/Workout/Workout';
import Memory from './pages/Memory/Memory';

// Progress pulls in the chart library — code-split so the dashboard
// doesn't pay for recharts until the user opens the Progress page.
const Progress = lazy(() => import('./pages/Progress/Progress'));
import Settings from './pages/Settings/Settings';
import About from './pages/About/About';
import Features from './pages/Features/Features';
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import Onboarding from './pages/Onboarding/Onboarding';
import Plan from './pages/Plan/Plan';
import Tutor from './pages/Tutor/Tutor';
import Learn from './pages/Learn/Learn';
import Terms from './pages/Legal/Terms';
import Privacy from './pages/Legal/Privacy';
import NavBar from './components/layout/NavBar';
import Footer from './components/layout/Footer';
import PublicShell from './components/layout/PublicShell';
import ErrorBoundary from './components/layout/ErrorBoundary';

function ProtectedRoute({ children, bare = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  // bare: full-focus pages (onboarding) skip the app chrome.
  if (bare) return children;
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <NavBar />
      <div style={{ flex: 1 }}>{children}</div>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<PublicShell><Home /></PublicShell>} />
          <Route path="/about" element={<PublicShell><About /></PublicShell>} />
          <Route path="/learn" element={<PublicShell><Learn /></PublicShell>} />
          <Route path="/features" element={<PublicShell><Features /></PublicShell>} />
          <Route path="/terms" element={<PublicShell><Terms /></PublicShell>} />
          <Route path="/privacy" element={<PublicShell><Privacy /></PublicShell>} />
          <Route path="/login" element={<PublicShell><Login /></PublicShell>} />
          <Route path="/signup" element={<PublicShell><Signup /></PublicShell>} />
          <Route path="/forgot-password" element={<PublicShell><ForgotPassword /></PublicShell>} />
          <Route path="/reset-password" element={<PublicShell><ResetPassword /></PublicShell>} />
          <Route path="/onboarding" element={<ProtectedRoute bare><Onboarding /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          {/* Old link shipped in early builds — keep it working. */}
          <Route path="/dashboard/tutor" element={<Navigate to="/tutor" replace />} />
          <Route path="/tutor" element={<ProtectedRoute><Tutor /></ProtectedRoute>} />
          <Route path="/plan" element={<ProtectedRoute><Plan /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/nutrition" element={<ProtectedRoute><Nutrition /></ProtectedRoute>} />
          <Route path="/workout" element={<ProtectedRoute><Workout /></ProtectedRoute>} />
          <Route path="/memory" element={<ProtectedRoute><Memory /></ProtectedRoute>} />
          <Route path="/progress" element={<ProtectedRoute><Suspense fallback={<div className="page-loading">Loading…</div>}><Progress /></Suspense></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
