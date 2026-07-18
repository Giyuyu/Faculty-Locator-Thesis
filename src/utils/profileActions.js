import Swal from 'sweetalert2';
import { getAuth, signOut, updatePassword } from 'firebase/auth';
import { ref, update } from 'firebase/database';

const applyTheme = (theme) => {
  const resolvedTheme = theme === 'dark' ? 'dark' : 'light';
  localStorage.setItem('theme', resolvedTheme);
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  document.documentElement.dataset.theme = resolvedTheme;
  window.dispatchEvent(new CustomEvent('themechange', { detail: resolvedTheme }));
  return resolvedTheme;
};

export const applySavedTheme = () => applyTheme(localStorage.getItem('theme') || 'light');

export const openUserProfile = (navigate) => navigate('/profile');

export const openThemeSettings = (navigate) => navigate('/profile?section=theme');

export const showUserProfile = (_currentUser, navigate) => {
  if (navigate) {
    openUserProfile(navigate);
    return;
  }
  window.location.assign('/profile');
};

export const changeCurrentUserPassword = async (database, currentUser) => {
  const result = await Swal.fire({
    title: 'Change password',
    html: `
      <input id="new-password" type="password" class="swal2-input" placeholder="New password">
      <input id="confirm-password" type="password" class="swal2-input" placeholder="Confirm password">
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Save password',
    preConfirm: () => {
      const password = document.getElementById('new-password')?.value || '';
      const confirmPassword = document.getElementById('confirm-password')?.value || '';
      if (password.length < 6) {
        Swal.showValidationMessage('Password must be at least 6 characters.');
        return false;
      }
      if (password !== confirmPassword) {
        Swal.showValidationMessage('Passwords do not match.');
        return false;
      }
      return password;
    },
  });

  if (!result.isConfirmed) return;

  const userId = currentUser?.uid || currentUser?.user_id || currentUser?.id;
  const authUser = getAuth().currentUser;
  if (!userId || !authUser) {
    Swal.fire('Unable to update', 'Please log in again before changing your password.', 'error');
    return;
  }

  try {
    await updatePassword(authUser, result.value);
  } catch (error) {
    if (error.code === 'auth/requires-recent-login') {
      Swal.fire('Login required', 'Please sign out, sign back in, then change your password.', 'warning');
      return;
    }
    Swal.fire('Unable to update', error.message || 'Password update failed.', 'error');
    return;
  }

  await update(ref(database), {
    [`users/${userId}/password`]: 'managed_by_firebase_auth',
    [`users/${userId}/password_updated_at`]: new Date().toISOString(),
  });

  Swal.fire('Saved', 'Password updated successfully.', 'success');
};

export const toggleThemeSetting = () => {
  const nextTheme = localStorage.getItem('theme') === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
  return nextTheme;
};

export const setThemeSetting = (theme) => {
  applyTheme(theme);
};

export const signOutCurrentUser = async (navigate) => {
  try {
    await signOut(getAuth());
  } catch {
    // Local session cleanup below still returns the user to login.
  }
  localStorage.removeItem('currentUser');
  navigate('/login');
};
