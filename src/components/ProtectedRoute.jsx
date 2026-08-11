import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import {
  cacheAuthenticatedSession,
  clearAuthenticatedSession,
  loadAuthenticatedSession,
} from '../utils/authSession';

function ProtectedRoute({ children, permission }) {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, session: null });

  useEffect(() => onAuthStateChanged(auth, async (authUser) => {
    if (!authUser || authUser.isAnonymous) {
      clearAuthenticatedSession();
      setState({ loading: false, session: null });
      return;
    }

    try {
      const session = await loadAuthenticatedSession(authUser);
      cacheAuthenticatedSession(session);
      setState({ loading: false, session });
    } catch {
      clearAuthenticatedSession();
      await signOut(auth).catch(() => {});
      setState({ loading: false, session: null });
    }
  }), []);

  useEffect(() => {
    const handlePasswordChange = () => setState((current) => ({
      ...current,
      session: current.session ? { ...current.session, passwordChangeRequired: false } : null,
    }));
    window.addEventListener('passwordchangecomplete', handlePasswordChange);
    return () => window.removeEventListener('passwordchangecomplete', handlePasswordChange);
  }, []);

  if (state.loading) {
    return <div className="flex min-h-screen items-center justify-center text-lg">Verifying account...</div>;
  }
  if (!state.session) return <Navigate to="/login" replace />;
  if (state.session.passwordChangeRequired && location.pathname !== '/profile') {
    return <Navigate to="/profile?password=required" replace />;
  }
  if (permission && !state.session.permissions?.[permission]) return <Navigate to="/home" replace />;
  return children;
}

export default ProtectedRoute;
