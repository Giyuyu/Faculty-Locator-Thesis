import React from 'react';
import { FaUserCircle } from 'react-icons/fa';
import { Link } from 'react-router-dom';

function ProfileLink({ user, className = '' }) {
  return (
    <Link
      to="/profile"
      className={`flex min-w-0 items-center gap-2 rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-800 ${className}`}
      aria-label="Open profile"
      title="My profile"
    >
      <FaUserCircle className="h-9 w-9 shrink-0 text-slate-300 dark:text-slate-600" />
      <span className="hidden max-w-44 truncate text-sm font-semibold text-slate-800 dark:text-slate-100 md:inline">
        {user?.name || user?.username || 'User'}
      </span>
    </Link>
  );
}

export default ProfileLink;
