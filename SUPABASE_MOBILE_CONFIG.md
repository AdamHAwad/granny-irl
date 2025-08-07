# 🔧 Supabase Configuration for Mobile OAuth

## Required Setup

For the mobile app OAuth to work properly, you need to add the custom URL scheme to your Supabase project's redirect URLs.

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your **Granny IRL** project

2. **Go to Authentication Settings**
   - Click on **Authentication** in the sidebar
   - Click on **URL Configuration**

3. **Add Mobile Redirect URL**
   - In the **Redirect URLs** section, click **Add URL**
   - Add this exact URL:
   ```
   com.grannyirl.app://oauth
   ```
   - Click **Save**

### Why This is Needed

- The mobile app uses a custom URL scheme (`com.grannyirl.app://`) to handle OAuth redirects
- When users sign in with Google, they're redirected to this URL after authentication
- Android knows to open your app when it sees this custom scheme
- The app then extracts the authentication tokens from the URL

### Verification

After adding the URL, the OAuth flow will work as follows:
1. User clicks "Sign in with Google" in the mobile app
2. Chrome opens with Google sign-in
3. After successful sign-in, user is redirected to `com.grannyirl.app://oauth`
4. Android opens the Granny IRL app
5. App extracts tokens and establishes the session

### Current Configuration

The app is already configured to:
- Open OAuth in the system browser (Chrome)
- Handle deep links with the custom URL scheme
- Extract and process OAuth tokens from the redirect URL

**Status**: ✅ Code is ready - just need to add the redirect URL in Supabase