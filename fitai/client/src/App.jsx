import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import Home from './pages/Home/Home';
import Dashboard from './pages/Dashboard/Dashboard';
import Profile from './pages/Profile/Profile';
import Nutrition from './pages/Nutrition/Nutrition';
import Workout from './pages/Workout/Workout';
import Memory from './pages/Memory/Memory';
import About from './pages/About/About';
import Features from './pages/Features/Features';
import Login from './pages/Auth/Login';
import Signup from './pages/Auth/Signup';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import AuthCallback from './pages/Auth/AuthCallback';
import Onboarding from './pages/Onboarding/Onboarding';
import Plan from './pages/Plan/Plan';
import Progress from './pages/Progress/Progress';
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
  const location = useLocation();
  if (loading) return <div className="page-loading">Loading…</div>;
  // Send them to log in, remembering where they were headed so we can return
  // them there afterwards — a silent bounce to the marketing home reads as a bug.
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  // key={user.id}: the session can change identity UNDER a mounted page —
  // Supabase stores it in localStorage shared across tabs, so logging into
  // another account in tab 2 swaps tab 1's token in place. Pages fetch on
  // mount, so without a remount they keep showing the previous account's
  // data while new fetches run as the new account — mixed-user screens.
  // Keying by user id forces a full unmount + refetch on any identity change.
  // bare: full-focus pages (onboarding) skip the app chrome.
  if (bare) return <React.Fragment key={user.id}>{children}</React.Fragment>;
  return (
    <div key={user.id} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/onboarding" element={<ProtectedRoute bare><Onboarding /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          {/* Old link shipped in early builds — keep it working. */}
          <Route path="/dashboard/tutor" element={<Navigate to="/tutor" replace />} />
          <Route path="/tutor" element={<ProtectedRoute><Tutor /></ProtectedRoute>} />
          <Route path="/plan" element={<ProtectedRoute><Plan /></ProtectedRoute>} />
          <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/nutrition" element={<ProtectedRoute><Nutrition /></ProtectedRoute>} />
          <Route path="/workout" element={<ProtectedRoute><Workout /></ProtectedRoute>} />
          <Route path="/memory" element={<ProtectedRoute><Memory /></ProtectedRoute>} />
          {/* Settings folded into Profile — keep old bookmarks working. */}
          <Route path="/settings" element={<Navigate to="/profile" replace />} />
        </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
