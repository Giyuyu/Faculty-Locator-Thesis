const normalize = (value) => String(value || '').trim().toLowerCase();

const compact = (value) => normalize(value).replace(/[^a-z0-9]/g, '');

const profileName = (profile) => [
  profile?.first_name,
  profile?.middle_name,
  profile?.last_name,
].filter(Boolean).join(' ').trim();

const profileEmailMatches = (profile, email) => (
  normalize(profile?.email) && normalize(profile.email) === normalize(email)
);

const profileNameMatchesEmail = (profile, email) => {
  const localPart = compact(String(email || '').split('@')[0]);
  const firstName = compact(profile?.first_name);
  const lastName = compact(profile?.last_name);
  if (!localPart || !firstName || !lastName) return false;

  return localPart.includes(firstName) && localPart.includes(lastName);
};

const uniqueMatch = (entries, predicate) => {
  const matches = entries.filter(([, profile]) => predicate(profile));
  return matches.length === 1 ? matches[0] : null;
};

const findInCollection = (collection, { userId, user, email, type }) => {
  const entries = Object.entries(collection || {}).filter(([, profile]) => profile);
  if (!entries.length) return null;

  const directUser = entries.find(([, profile]) => normalize(profile.user_id) === normalize(userId));
  if (directUser) return directUser;

  const profileId = user?.profile_id || (type === 'faculties' ? user?.faculty_id : user?.student_number);
  if (profileId) {
    const directProfile = entries.find(([key, profile]) => (
      normalize(key) === normalize(profileId)
      || normalize(profile.faculty_id) === normalize(profileId)
      || normalize(profile.student_id) === normalize(profileId)
      || normalize(profile.student_number) === normalize(profileId)
    ));
    if (directProfile) return directProfile;
  }

  const byEmail = uniqueMatch(entries, (profile) => profileEmailMatches(profile, email));
  if (byEmail) return byEmail;

  return uniqueMatch(entries, (profile) => profileNameMatchesEmail(profile, email));
};

export function resolveLinkedProfile({
  user = {},
  userId = '',
  email = '',
  faculties = {},
  students = {},
  preferredType = '',
}) {
  const accountEmail = email || user.email || user.username;
  const order = preferredType === 'students'
    ? [['students', students], ['faculties', faculties]]
    : [['faculties', faculties], ['students', students]];

  for (const [type, collection] of order) {
    const entry = findInCollection(collection, {
      userId: userId || user.user_id,
      user,
      email: accountEmail,
      type,
    });
    if (entry) {
      return {
        type,
        key: entry[0],
        profile: entry[1],
        name: profileName(entry[1]),
      };
    }
  }

  return null;
}

export function getProfileDisplayName(profile, fallback = 'User') {
  return profileName(profile) || fallback;
}
