export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  total_reports: number;
  verified_reports: number;
  created_at: string;
}

export interface GumReport {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  photo_url: string | null;
  is_verified: boolean;
  created_at: string;
  profiles?: Profile;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  avatar_url: string | null;
  verified_reports: number;
  total_reports: number;
}
