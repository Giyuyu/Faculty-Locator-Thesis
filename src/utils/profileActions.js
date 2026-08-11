import Swal from 'sweetalert2';
import {
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { get, ref, update } from 'firebase/database';

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

const findUserRecord = async (database, currentUser) => {
  const userId = currentUser?.uid || currentUser?.user_id || currentUser?.id;
  if (!userId) return null;

  const directSnapshot = await get(ref(database, `users/${userId}`));
  if (directSnapshot.exists()) {
    return { key: userId, value: directSnapshot.val() || {} };
  }

  return null;
};

const passwordErrorMessage = (error) => {
  if (['auth/invalid-credential', 'auth/wrong-password'].includes(error?.code)) {
    return 'Your current password is incorrect.';
  }
  if (error?.code === 'auth/weak-password') {
    return 'Use a stronger password with at least 8 characters.';
  }
  if (error?.code === 'auth/too-many-requests') {
    return 'Too many attempts. Wait a moment, then try again.';
  }
  if (error?.code === 'auth/network-request-failed') {
    return 'Check your internet connection and try again.';
  }
  return error?.message || 'Password update failed.';
};

export const changeCurrentUserPassword = async (database, currentUser) => {
  const result = await Swal.fire({
    title: 'Change password',
    html: `
      <input id="current-password" type="password" class="swal2-input" placeholder="Current password" autocomplete="current-password">
      <input id="new-password" type="password" class="swal2-input" placeholder="New password">
      <input id="confirm-password" type="password" class="swal2-input" placeholder="Confirm password">
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Save password',
    preConfirm: () => {
      const currentPassword = document.getElementById('current-password')?.value || '';
      const password = document.getElementById('new-password')?.value || '';
      const confirmPassword = document.getElementById('confirm-password')?.value || '';
      if (!currentPassword) {
        Swal.showValidationMessage('Enter your current password.');
        return false;
      }
      if (password.length < 8) {
        Swal.showValidationMessage('Password must be at least 8 characters.');
        return false;
      }
      if (password !== confirmPassword) {
        Swal.showValidationMessage('Passwords do not match.');
        return false;
      }
      if (password === currentPassword) {
        Swal.showValidationMessage('New password must be different from your current password.');
        return false;
      }
      return { currentPassword, newPassword: password };
    },
  });

  if (!result.isConfirmed) return;

  const authUser = getAuth().currentUser;
  const userId = currentUser?.uid || currentUser?.user_id || currentUser?.id;
  if (!userId || !authUser || authUser.uid !== userId) {
    Swal.fire('Unable to update', 'Your user record is missing. Please sign in again.', 'error');
    return;
  }

  try {
    const userRecord = await findUserRecord(database, currentUser);
    if (!userRecord) throw new Error('Your user record could not be found.');

    const email = authUser.email || currentUser?.email || currentUser?.username;
    if (!email) throw new Error('Your account email could not be found.');
    const credential = EmailAuthProvider.credential(email, result.value.currentPassword);
    await reauthenticateWithCredential(authUser, credential);
    await updatePassword(authUser, result.value.newPassword);

    await update(ref(database), {
      [`users/${userRecord.key}/password`]: null,
      [`users/${userRecord.key}/password_change_required`]: null,
      [`users/${userRecord.key}/password_updated_at`]: new Date().toISOString(),
    });
  } catch (error) {
    Swal.fire('Unable to update', passwordErrorMessage(error), 'error');
    return false;
  }

  const cachedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  localStorage.setItem('currentUser', JSON.stringify({ ...cachedUser, passwordChangeRequired: false }));
  window.dispatchEvent(new CustomEvent('passwordchangecomplete'));
  Swal.fire('Saved', 'Password updated successfully.', 'success');
  return true;
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
