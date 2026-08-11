import { onValue, ref } from 'firebase/database';

export function subscribeToPaths(database, paths, onData, onError) {
  const data = {};
  const loaded = new Set();

  const unsubscribers = paths.map((path) => onValue(ref(database, path), (snapshot) => {
    data[path] = snapshot.val() || {};
    loaded.add(path);
    if (loaded.size === paths.length) onData({ ...data });
  }, onError));

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
