import { supabase } from './supabase';
import { UserProfile } from '@/types/user';

export async function createUserProfile(user: {
  id: string;
  email: string;
  user_metadata: { full_name?: string; name?: string; [key: string]: any };
}): Promise<UserProfile> {
  const displayName = user.user_metadata.full_name || user.user_metadata.name || user.email?.split('@')[0] || 'Anonymous User';
  
  const userProfile: UserProfile = {
    uid: user.id,
    email: user.email,
    display_name: displayName,
    created_at: Date.now(),
    last_active: Date.now(),
  };

  const { error } = await supabase
    .from('user_profiles')
    .upsert(userProfile);

  if (error) throw error;
  return userProfile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('uid', uid)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> {
  console.log('updateUserProfile: Updating profile for uid:', uid, 'with updates:', updates);
  
  const { error } = await supabase
    .from('user_profiles')
    .update({
      ...updates,
      last_active: Date.now(),
    })
    .eq('uid', uid);

  if (error) {
    console.error('updateUserProfile: Error updating profile:', error);
    throw error;
  }
  
  console.log('updateUserProfile: Profile updated successfully');
}

export async function uploadProfilePicture(
  uid: string,
  file: File
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${uid}.${fileExt}`;
  
  const { error: uploadError } = await supabase.storage
    .from('profile-pictures')
    .upload(fileName, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('profile-pictures')
    .getPublicUrl(fileName);

  await updateUserProfile(uid, { profile_picture_url: data.publicUrl });
  
  return data.publicUrl;
}

export async function deleteProfilePicture(uid: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from('profile-pictures')
      .remove([`${uid}.jpg`, `${uid}.png`, `${uid}.jpeg`]);
    
    await updateUserProfile(uid, { profile_picture_url: undefined });
  } catch (error) {
    console.error('Error deleting profile picture:', error);
  }
}