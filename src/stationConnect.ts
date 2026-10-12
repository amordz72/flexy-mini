import type { SupabaseClient } from "@supabase/supabase-js";

// Same Supabase project and authenticated MyTool/Flexy Mini admin role.
// Read-only: does not enroll stations, send commands, or expose station secrets.
export type ConnectedStation = {
  station_uuid: string;
  status: string;
  computer_name: string;
  last_seen_at: string | null;
  agent_version: string | null;
};

export async function getConnectedStations(db: SupabaseClient): Promise<ConnectedStation[]> {
  const { data, error } = await db.rpc("flexy_mini_station_overview");
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("INVALID_STATION_RESPONSE");
  return data as ConnectedStation[];
}
