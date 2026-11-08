import React, { useEffect, useState } from 'react';
import { FaUserCircle } from 'react-icons/fa';
import { onAuthStateChanged } from 'firebase/auth';
import { Link } from 'react-router-dom';
import { auth } from '../firebase';
import { cacheAuthenticatedSession, loadAuthenticatedSession } from '../utils/authSession';

function ProfileLink({ user, className = '' }) {
  const [displayUser, setDisplayUser] = useState(user);

  useEffect(() => {
    setDisplayUser(user);
    const nameNeedsRefresh = !user?.name
      || user.name === user.username
      || user.name === user.email;
    if (!nameNeedsRefresh) return;

    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (!authUser) return;
      loadAuthenticatedSession(authUser).then((session) => {
        if (!active) return;
        cacheAuthenticatedSession(session);
        setDisplayUser(session);
      }).catch(() => {});
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [user]);

  return (
    <Link
      to="/profile"
      className={`flex min-w-0 items-center gap-2 rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-800 ${className}`}
      aria-label="Open profile"
      title="My profile"
    >
      <FaUserCircle className="h-9 w-9 shrink-0 text-slate-300 dark:text-slate-600" />
      <span className="hidden max-w-44 truncate text-sm font-semibold text-slate-800 dark:text-slate-100 md:inline">
        {displayUser?.name || displayUser?.username || 'User'}
      </span>
    </Link>
  );
}

export default ProfileLink;
