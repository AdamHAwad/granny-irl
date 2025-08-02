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
  console.log('uploadProfilePicture: Starting upload for user:', uid);
  
  // Compress image if needed
  const compressedFile = await compressImage(file);
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${uid}.${fileExt}`;
  
  console.log('uploadProfilePicture: Uploading file:', fileName, 'Size:', compressedFile.size);
  
  const { error: uploadError } = await supabase.storage
    .from('profile-pictures')
    .upload(fileName, compressedFile, { 
      upsert: true,
      contentType: compressedFile.type
    });

  if (uploadError) {
    console.error('uploadProfilePicture: Upload error:', uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('profile-pictures')
    .getPublicUrl(fileName);

  console.log('uploadProfilePicture: Public URL:', data.publicUrl);
  
  await updateUserProfile(uid, { profile_picture_url: data.publicUrl });
  
  return data.publicUrl;
}

// Helper function to compress images
async function compressImage(file: File): Promise<File> {
  // If file is already small, return as-is
  if (file.size < 100000) { // 100KB
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Calculate new dimensions (max 500x500)
        let width = img.width;
        let height = img.height;
        const maxSize = 500;
        
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            const compressedFile = new File([blob!], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          0.8 // 80% quality
        );
      };
    };
  });
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