import PocketBase from 'pocketbase';

// Auth state persists itself to localStorage under 'pocketbase_auth' by
// default, so a logged-in session survives reloads.
export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL);

export function isLoggedIn() {
  return pb.authStore.isValid;
}

export async function login(email, password) {
  await pb.collection('users').authWithPassword(email, password);
}

export function logout() {
  pb.authStore.clear();
}

// The single goal_data record id for the logged-in user, once known —
// avoids re-querying for it on every push.
let recordId = null;

// Returns { goals, history } for the current user's record, or null if
// they don't have one yet (first login on this account).
export async function fetchRemoteData() {
  try {
    const record = await pb
      .collection('goal_data')
      .getFirstListItem(`owner = "${pb.authStore.model.id}"`);
    recordId = record.id;
    return { goals: record.goals, history: record.history };
  } catch (err) {
    if (err.status === 404) {
      recordId = null;
      return null;
    }
    throw err;
  }
}

// Creates the user's goal_data record on first push, updates it after.
export async function pushRemoteData(goals, history) {
  if (recordId) {
    await pb.collection('goal_data').update(recordId, { goals, history });
    return;
  }
  const record = await pb
    .collection('goal_data')
    .create({ owner: pb.authStore.model.id, goals, history });
  recordId = record.id;
}
