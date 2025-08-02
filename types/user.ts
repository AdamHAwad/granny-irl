export interface UserProfile {
  uid: string;
  email: string;
  display_name: string;
  custom_username?: string;
  profile_picture_url?: string;
  created_at: number;
  last_active: number;
}