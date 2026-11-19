// Calls the admin-users Edge Function and turns its JSON error into an Error.
export async function adminFn(client, body) {
  const { data, error } = await client.functions.invoke('admin-users', { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch { /* keep message */ }
    throw new Error(msg);
  }
  return data;
}
