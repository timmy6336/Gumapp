export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  total_reports: number;
  verified_reports: number;
  created_at: string;
}

export type SurfaceType = 'sidewalk' | 'road' | 'bench' | 'wall' | 'other';
export type ReportStatus = 'active' | 'removed';

export interface GumReport {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  gps_accuracy: number | null;
  photo_url: string | null;
  surface_type: SurfaceType | null;
  status: ReportStatus;
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
