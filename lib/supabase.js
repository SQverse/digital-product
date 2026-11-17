import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

let client;
export function db() {
  client ??= createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
