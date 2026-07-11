import Swal from 'sweetalert2';
import { getAuth, signOut, updatePassword } from 'firebase/auth';
import { ref, update } from 'firebase/database';

export const showUserProfile = (currentUser) => {
  Swal.fire({
    title: 'My profile',
    html: `
      <div style="text-align:left;line-height:1.7">
        <strong>Name:</strong> ${currentUser?.name || currentUser?.username || 'User'}<br/>
        <strong>Username:</strong> ${currentUser?.username || 'Not available'}<br/>
        <strong>User ID:</strong> ${currentUser?.uid || currentUser?.id || 'Not available'}<br/>
        <strong>Role:</strong> ${(currentUser?.roleIds || [currentUser?.userType]).filter(Boolean).join(', ') || 'Not available'}
      </div>
    `,
    confirmButtonText: 'Close',
  });
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
  localStorage.setItem('theme', nextTheme);
  document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  Swal.fire('Theme settings', `${nextTheme === 'dark' ? 'Dark' : 'Light'} mode enabled.`, 'success');
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
