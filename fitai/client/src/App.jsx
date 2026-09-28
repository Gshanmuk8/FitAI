import React, { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

const Home = lazy(() => import("./pages/Home/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const Profile = lazy(() => import("./pages/Profile/Profile"));
const Nutrition = lazy(() => import("./pages/Nutrition/Nutrition"));
const Workout = lazy(() => import("./pages/Workout/Workout"));
const Memory = lazy(() => import("./pages/Memory/Memory"));
const About = lazy(() => import("./pages/About/About"));
const Features = lazy(() => import("./pages/Features/Features"));
const Login = lazy(() => import("./pages/Auth/Login"));
const Signup = lazy(() => import("./pages/Auth/Signup"));
const ForgotPassword = lazy(() => import("./pages/Auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/Auth/ResetPassword"));
const AuthCallback = lazy(() => import("./pages/Auth/AuthCallback"));
const Onboarding = lazy(() => import("./pages/Onboarding/Onboarding"));
const Plan = lazy(() => import("./pages/Plan/Plan"));
const Progress = lazy(() => import("./pages/Progress/Progress"));
const Tutor = lazy(() => import("./pages/Tutor/Tutor"));
const Learn = lazy(() => import("./pages/Learn/Learn"));
const Terms = lazy(() => import("./pages/Legal/Terms"));
const Privacy = lazy(() => import("./pages/Legal/Privacy"));
import NavBar from "./components/layout/NavBar";
import PublicShell from "./components/layout/PublicShell";
import ErrorBoundary from "./components/layout/ErrorBoundary";
import { LoadingState } from "./components/ui/PageKit";

function ProtectedRoute({ children, bare = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <LoadingState
        title="Opening your space"
        detail="Restoring your secure session."
      />
    );
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
    <div key={user.id} className="app-shell">
      <NavBar />
      <main id="main-content" className="app-content">
        {children}
      </main>
    </div>
  );
}

function RouteFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const labels = {
      dashboard: "Today",
      workout: "Train",
      nutrition: "Fuel",
      tutor: "Coach",
      plan: "My plan",
      progress: "Progress",
      profile: "Profile",
      memory: "Coach memory",
      onboarding: "Your plan starts here",
      login: "Sign in",
      signup: "Get started",
    };
    document.title = `${labels[pathname.slice(1)] || "Your everyday edge"} · FitAI`;
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RouteFocus />
        <ErrorBoundary>
          <Suspense fallback={<LoadingState title="Opening your space" />}>
            <Routes>
              <Route
                path="/"
                element={
                  <PublicShell>
                    <Home />
                  </PublicShell>
                }
              />
              <Route
                path="/about"
                element={
                  <PublicShell>
                    <About />
                  </PublicShell>
                }
              />
              <Route
                path="/learn"
                element={
                  <PublicShell>
                    <Learn />
                  </PublicShell>
                }
              />
              <Route
                path="/features"
                element={
                  <PublicShell>
                    <Features />
                  </PublicShell>
                }
              />
              <Route
                path="/terms"
                element={
                  <PublicShell>
                    <Terms />
                  </PublicShell>
                }
              />
              <Route
                path="/privacy"
                element={
                  <PublicShell>
                    <Privacy />
                  </PublicShell>
                }
              />
              <Route
                path="/login"
                element={
                  <PublicShell>
                    <Login />
                  </PublicShell>
                }
              />
              <Route
                path="/signup"
                element={
                  <PublicShell>
                    <Signup />
                  </PublicShell>
                }
              />
              <Route
                path="/forgot-password"
                element={
                  <PublicShell>
                    <ForgotPassword />
                  </PublicShell>
                }
              />
              <Route
                path="/reset-password"
                element={
                  <PublicShell>
                    <ResetPassword />
                  </PublicShell>
                }
              />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route
                path="/onboarding"
                element={
                  <ProtectedRoute bare>
                    <Onboarding />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              {/* Old link shipped in early builds — keep it working. */}
              <Route
                path="/dashboard/tutor"
                element={<Navigate to="/tutor" replace />}
              />
              <Route
                path="/tutor"
                element={
                  <ProtectedRoute>
                    <Tutor />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/plan"
                element={
                  <ProtectedRoute>
                    <Plan />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/progress"
                element={
                  <ProtectedRoute>
                    <Progress />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/nutrition"
                element={
                  <ProtectedRoute>
                    <Nutrition />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/workout"
                element={
                  <ProtectedRoute>
                    <Workout />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/memory"
                element={
                  <ProtectedRoute>
                    <Memory />
                  </ProtectedRoute>
                }
              />
              {/* Settings folded into Profile — keep old bookmarks working. */}
              <Route
                path="/settings"
                element={<Navigate to="/profile" replace />}
              />
              <Route
                path="*"
                element={
                  <PublicShell>
                    <div className="page page-narrow">
                      <h1 className="page-title">Page not found</h1>
                      <p>This link is no longer available.</p>
                      <a href="/dashboard">Go to your dashboard</a>
                    </div>
                  </PublicShell>
                }
              />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
