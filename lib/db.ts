import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { Database } from "@/lib/database.types";

export type KnowledgeEntry = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: string[] | null;
  source_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

let adminClient: SupabaseClient<Database> | null = null;

export function getSupabaseAdmin() {
  if (!adminClient) {
    adminClient = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    );
  }
  return adminClient;
}
