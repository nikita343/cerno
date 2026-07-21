import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FREE_PLAN,
  type Subscription,
  type Workspace,
  type WorkspaceInvite,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@/lib/types";

/**
 * Workspace reads and writes.
 *
 * Nothing here filters by user. RLS does that — see the header of
 * `0005_workspaces.sql`. Duplicating the predicate in application code creates
 * a second place to get multi-tenant isolation wrong, and the second place is
 * always the one that rots.
 *
 * The mutations that carry invariants (creating a workspace, joining one,
 * changing a role, transferring ownership) go through RPC rather than table
 * writes, because each is several statements that must happen together. See
 * the migration for why each one is a function.
 */

interface MembershipRow {
  workspace_id: string;
  role: WorkspaceRole;
  workspaces: {
    id: string;
    owner_id: string;
    name: string;
    description: string | null;
    created_at: string;
  } | null;
}

/**
 * Every workspace the caller belongs to, with their role and the seat count.
 *
 * One query with an embedded join rather than a list plus N member counts: a
 * sidebar that renders ten workspaces should not cost eleven round trips.
 */
export async function loadWorkspaces(
  supabase: SupabaseClient,
): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(id, owner_id, name, description, created_at)")
    .order("joined_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as unknown as MembershipRow[];
  const ids = rows.map((r) => r.workspace_id);
  const counts = await memberCounts(supabase, ids);

  return rows
    .filter((row) => row.workspaces !== null)
    .map((row) => ({
      id: row.workspaces!.id,
      owner_id: row.workspaces!.owner_id,
      name: row.workspaces!.name,
      description: row.workspaces!.description,
      created_at: row.workspaces!.created_at,
      role: row.role,
      member_count: counts.get(row.workspace_id) ?? 1,
    }));
}

/**
 * Seat counts, keyed by workspace.
 *
 * Postgres has no grouped-count through PostgREST without a view, so this
 * fetches the membership ids and counts client-side. Bounded by the seat cap
 * times the workspace cap, so it stays small by construction.
 */
async function memberCounts(
  supabase: SupabaseClient,
  workspaceIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (workspaceIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .in("workspace_id", workspaceIds);
  if (error) throw error;

  for (const row of data ?? []) {
    const id = (row as { workspace_id: string }).workspace_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** The caller's plan. Absent row means they have never subscribed. */
export async function loadSubscription(
  supabase: SupabaseClient,
): Promise<Subscription> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end, stripe_customer_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return FREE_PLAN;

  return {
    status: data.status,
    current_period_end: data.current_period_end,
    cancel_at_period_end: data.cancel_at_period_end,
    has_customer: Boolean(data.stripe_customer_id),
  };
}

export async function createWorkspaceRow(
  supabase: SupabaseClient,
  name: string,
  description: string | null,
): Promise<Workspace> {
  // `.rpc()`, never `select (create_workspace(...)).*` — the latter expands the
  // composite by calling the function once per output column, creating five
  // workspaces. See the note in the migration.
  const { data, error } = await supabase.rpc("create_workspace", {
    p_name: name,
    p_description: description,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return { ...row, role: "admin" as const, member_count: 1 };
}

/**
 * Members, with their names and photos.
 *
 * Goes through the `workspace_member_profiles` RPC rather than selecting
 * `workspace_members` directly, for two reasons:
 *
 *  - Names live in `user_settings` and `auth.users`, neither of which a
 *    teammate can read. The RPC is SECURITY DEFINER and resolves them with the
 *    same precedence as `toProfile()` — see 0008_member_identity.sql.
 *  - Its first statement is an `is_workspace_member(ws)` check, which *is* the
 *    access control. A direct select would lean on the table policy instead.
 *
 * Selecting the table directly is what this used to do, and every teammate
 * rendered as "Pending" — `memberProfile()`'s fallback for a member with no
 * name at all — because the three profile columns were hardcoded to null.
 */
export async function loadMembers(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const { data, error } = await supabase.rpc("workspace_member_profiles", {
    ws: workspaceId,
  });
  if (error) throw error;

  return ((data ?? []) as Omit<WorkspaceMember, "workspace_id">[]).map(
    (row) => ({ ...row, workspace_id: workspaceId }),
  );
}

export async function loadInvites(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceInvite[]> {
  const { data, error } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorkspaceInvite[];
}

export async function createInvite(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  /** Null makes a shareable link; an address binds it to that person. */
  email: string | null,
): Promise<WorkspaceInvite> {
  const { data, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      // Lowercased to match the column's check constraint, and so acceptance
      // can compare exactly rather than case-insensitively.
      email: email ? email.trim().toLowerCase() : null,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data as WorkspaceInvite;
}

/** Revoked rather than deleted, so a spent link keeps a trail of who made it. */
export async function revokeInvite(
  supabase: SupabaseClient,
  inviteId: string,
): Promise<void> {
  const { error } = await supabase
    .from("workspace_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId);
  if (error) throw error;
}

export async function acceptInvite(
  supabase: SupabaseClient,
  token: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("accept_workspace_invite", {
    p_token: token,
  });
  if (error) throw error;
  return data as string;
}

/** Also the "leave" action: removing yourself is the same delete. */
export async function removeMember(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function setMemberRole(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<void> {
  const { error } = await supabase.rpc("set_member_role", {
    p_workspace: workspaceId,
    p_user: userId,
    p_role: role,
  });
  if (error) throw error;
}

export async function transferOwnership(
  supabase: SupabaseClient,
  workspaceId: string,
  newOwner: string,
): Promise<void> {
  const { error } = await supabase.rpc("transfer_workspace_ownership", {
    p_workspace: workspaceId,
    p_new_owner: newOwner,
  });
  if (error) throw error;
}

export async function updateWorkspaceRow(
  supabase: SupabaseClient,
  workspaceId: string,
  patch: { name?: string; description?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from("workspaces")
    .update(patch)
    .eq("id", workspaceId);
  if (error) throw error;
}

export async function deleteWorkspaceRow(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<void> {
  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", workspaceId);
  if (error) throw error;
}
