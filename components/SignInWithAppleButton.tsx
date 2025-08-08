'use client';

import { useAuth } from '@/contexts/AuthContext';

export default function SignInWithAppleButton() {
  const { signInWithApple } = useAuth();

  return (
    <button
      onClick={signInWithApple}
      className="glass-card hover:bg-prowl-surface-light text-prowl-text font-semibold py-4 px-6 flex items-center justify-center gap-3 transition-all duration-200 hover:shadow-lg hover:shadow-prowl-survivor/10 group w-full"
    >
      {/* Apple logo */}
      <svg
        className="w-5 h-5 transition-transform group-hover:scale-110"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M16.365 1.43c0 1.14-.414 2.022-1.242 2.646-.828.612-1.773.96-2.835 1.044-.06-.18-.09-.396-.09-.648 0-1.092.39-2.004 1.17-2.736C14.148 1.008 15.108.66 16.365.6c.018.276 0 .54 0 .828zM21.6 18.09c-.456 1.074-1.002 2.004-1.638 2.79-.888 1.11-1.89 1.677-3.006 1.704-.72.018-1.593-.21-2.62-.684-1.02-.474-1.956-.702-2.808-.684-.876.018-1.83.228-2.862.63-1.032.402-1.86.606-2.484.606-1.164-.018-2.214-.546-3.15-1.584-.69-.75-1.32-1.74-1.89-2.97-.57-1.248-.858-2.454-.864-3.618-.012-1.392.312-2.58.972-3.564a5.9 5.9 0 0 1 2.388-2.196c.966-.51 1.86-.774 2.682-.792.624-.012 1.44.204 2.448.648.996.45 1.734.678 2.214.684.42.006 1.2-.228 2.34-.702 1.254-.498 2.31-.708 3.168-.63 2.34.21 4.098 1.164 5.274 2.862-2.094 1.266-3.138 3.036-3.132 5.31.006 1.77.654 3.252 1.944 4.446.576.54 1.218.96 1.926 1.26-.156.432-.36.87-.612 1.314z" />
      </svg>
      <span className="text-lg">Sign in with Apple</span>
    </button>
  );
}


