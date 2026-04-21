/**
 * Integration test: support_ticket_attachments + support-attachments storage RLS.
 *
 * Verifies that:
 *  - Ticket owner can SELECT only their own attachment rows + signed URL works.
 *  - Another authenticated user CANNOT see the row nor download the file.
 *  - Admin can see all rows and download any file.
 *
 * Requires env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 * Run with: supabase--test_edge_functions
 */
import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET = "support-attachments";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const rand = () => crypto.randomUUID().slice(0, 8);

async function createUser(role: "student" | "admin") {
  const email = `rls-test-${rand()}@example.com`;
  const password = `Pwd!${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: `RLS ${role}` },
  });
  if (error) throw error;
  const userId = data.user!.id;

  // Ensure profile exists (handle_new_user trigger creates it; insert role explicitly).
  await admin.from("user_roles").insert({ user_id: userId, role }).then(() => {});

  // Sign in to get a JWT-bound client.
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw signErr;
  return { userId, email, client };
}

async function cleanup(userIds: string[], ticketIds: string[], paths: string[]) {
  if (paths.length) await admin.storage.from(BUCKET).remove(paths).catch(() => {});
  if (ticketIds.length) {
    await admin.from("support_ticket_attachments").delete().in("ticket_id", ticketIds);
    await admin.from("support_tickets").delete().in("id", ticketIds);
  }
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

Deno.test("ticket attachments RLS: owner / other user / admin access matrix", async () => {
  const owner = await createUser("student");
  const other = await createUser("student");
  const adminUser = await createUser("admin");

  // Create a ticket as owner (service client to avoid depending on tickets RLS in this test).
  const { data: ticket, error: tErr } = await admin
    .from("support_tickets")
    .insert({
      user_id: owner.userId,
      user_role: "student",
      category: "other",
      subject: "RLS test ticket",
      description: "rls",
      response_due_at: new Date(Date.now() + 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (tErr) throw tErr;
  const ticketId = ticket!.id as string;

  // Upload a small file to the bucket under `${ticketId}/...` as the owner.
  const fileBytes = new TextEncoder().encode("hello-rls");
  const path = `${ticketId}/${crypto.randomUUID()}-test.txt`;

  const { error: upErr } = await owner.client.storage
    .from(BUCKET)
    .upload(path, fileBytes, { contentType: "text/plain", upsert: false });
  assertEquals(upErr, null, `Owner should be able to upload: ${upErr?.message}`);

  // Insert the attachment row as owner.
  const { error: insErr } = await owner.client
    .from("support_ticket_attachments")
    .insert({
      ticket_id: ticketId,
      uploader_id: owner.userId,
      uploader_type: "user",
      storage_path: path,
      file_name: "test.txt",
      mime_type: "text/plain",
      size_bytes: fileBytes.byteLength,
    });
  assertEquals(insErr, null, `Owner should insert attachment row: ${insErr?.message}`);

  try {
    // === 1) Owner can SELECT own attachment row ===
    {
      const { data, error } = await owner.client
        .from("support_ticket_attachments")
        .select("id, storage_path")
        .eq("ticket_id", ticketId);
      assertEquals(error, null);
      assertEquals(data?.length, 1, "Owner must see exactly their attachment");
    }

    // === 2) Other user CANNOT see the row ===
    {
      const { data, error } = await other.client
        .from("support_ticket_attachments")
        .select("id")
        .eq("ticket_id", ticketId);
      assertEquals(error, null);
      assertEquals(data?.length, 0, "Other user must NOT see attachment rows");
    }

    // === 3) Admin can see all rows ===
    {
      const { data, error } = await adminUser.client
        .from("support_ticket_attachments")
        .select("id")
        .eq("ticket_id", ticketId);
      assertEquals(error, null);
      assertEquals(data?.length, 1, "Admin must see the attachment");
    }

    // === 4) Storage download — owner can create a working signed URL ===
    {
      const { data, error } = await owner.client.storage
        .from(BUCKET)
        .createSignedUrl(path, 60);
      assertEquals(error, null, `Owner signed URL error: ${error?.message}`);
      assertExists(data?.signedUrl);
      const res = await fetch(data!.signedUrl);
      assertEquals(res.status, 200, "Owner signed URL must download");
      assertEquals(await res.text(), "hello-rls");
    }

    // === 5) Storage — other user CANNOT create a signed URL for the file ===
    {
      const { data, error } = await other.client.storage
        .from(BUCKET)
        .createSignedUrl(path, 60);
      assert(
        error !== null || !data?.signedUrl,
        "Other user must NOT obtain a signed URL for someone else's attachment",
      );
    }

    // === 6) Storage — other user cannot list the ticket folder ===
    {
      const { data, error } = await other.client.storage
        .from(BUCKET)
        .list(ticketId);
      // Either policy denies (error) or list comes back empty.
      const empty = !error && Array.isArray(data) && data.length === 0;
      assert(error !== null || empty, "Other user must not list ticket folder contents");
    }

    // === 7) Storage — admin can download via signed URL ===
    {
      const { data, error } = await adminUser.client.storage
        .from(BUCKET)
        .createSignedUrl(path, 60);
      assertEquals(error, null, `Admin signed URL error: ${error?.message}`);
      const res = await fetch(data!.signedUrl);
      assertEquals(res.status, 200, "Admin must download any attachment");
    }

    // === 8) Other user cannot DELETE the row (RLS) ===
    {
      const { error } = await other.client
        .from("support_ticket_attachments")
        .delete()
        .eq("ticket_id", ticketId);
      // Postgres returns no error on no-op delete; verify the row still exists via service role.
      const { data: still } = await admin
        .from("support_ticket_attachments")
        .select("id")
        .eq("ticket_id", ticketId);
      assertEquals(still?.length, 1, "Row must still exist after non-owner delete attempt");
      // (If error is set, that's also a valid deny.)
      void error;
    }
  } finally {
    await cleanup(
      [owner.userId, other.userId, adminUser.userId],
      [ticketId],
      [path],
    );
  }
});