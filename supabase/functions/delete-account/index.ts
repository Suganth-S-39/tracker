// Deletes the signed-in user's account and all their data (spec section 10).
//
// Only the account owner can call it: withSupabase({ auth: 'user' }) verifies the caller's
// session token and gives their user id. The admin client (secret key, server-side only) deletes
// the auth user; every user-owned table references auth.users with ON DELETE CASCADE, so all of
// their rows go with it in one database transaction.

import { withSupabase } from 'npm:@supabase/server@1';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    }
    const userId = ctx.userClaims?.id;
    if (!userId) {
      return Response.json({ error: 'not_signed_in' }, { status: 401 });
    }

    const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      return Response.json({ error: 'delete_failed' }, { status: 500 });
    }
    return Response.json({ deleted: true });
  }),
};
