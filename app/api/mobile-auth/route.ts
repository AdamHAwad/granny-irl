import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// In-memory store for auth codes (in production, use Redis or database)
const authCodes = new Map<string, { session: any, expires: number }>();

// Clean up expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  authCodes.forEach((data, code) => {
    if (now > data.expires) {
      authCodes.delete(code);
    }
  });
}, 5 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const { authCode } = await request.json();
    
    if (!authCode || typeof authCode !== 'string') {
      return NextResponse.json(
        { error: 'Auth code is required' },
        { status: 400 }
      );
    }
    
    // Look up the auth code
    const authData = authCodes.get(authCode);
    
    if (!authData) {
      return NextResponse.json(
        { error: 'Invalid or expired auth code' },
        { status: 404 }
      );
    }
    
    // Check if expired
    if (Date.now() > authData.expires) {
      authCodes.delete(authCode);
      return NextResponse.json(
        { error: 'Auth code has expired' },
        { status: 410 }
      );
    }
    
    // Return the session and clean up
    authCodes.delete(authCode);
    
    return NextResponse.json({
      session: authData.session,
      success: true
    });
    
  } catch (error) {
    console.error('Mobile auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Generate auth code for web users
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    
    // Verify the session token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }
    
    // Get the full session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Could not retrieve session' },
        { status: 500 }
      );
    }
    
    // Generate a unique auth code
    const authCode = Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 15);
    
    // Store the session with expiration (10 minutes)
    authCodes.set(authCode, {
      session,
      expires: Date.now() + (10 * 60 * 1000)
    });
    
    return NextResponse.json({
      authCode,
      expiresAt: Date.now() + (10 * 60 * 1000),
      success: true
    });
    
  } catch (error) {
    console.error('Auth code generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}