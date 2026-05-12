import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Key, User } from 'lucide-react';

export default function Login() {
  const { signInWithGoogle, user, profile } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<'tenant' | 'landlord'>('tenant');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  React.useEffect(() => {
    if (user && profile) {
      navigate(`/${profile.role}`);
    }
  }, [user, profile, navigate]);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle(role);
      // Navigation is handled by the useEffect above once profile is loaded
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.message?.includes('popup-closed-by-user')) {
        // User closed the popup, don't show a scary error
        setError('Sign-in was cancelled. Please try again.');
      } else {
        setError(err.message || 'Failed to sign in');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <div className="mx-auto h-16 w-16 bg-primary-50 rounded-2xl flex items-center justify-center">
            <Home className="h-8 w-8 text-primary-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-outfit font-bold text-gray-900 tracking-tight">
            Welcome to EntraHomes
          </h2>
          <p className="mt-2 text-center text-base text-gray-500 font-medium">
            Sign in or create an account to continue
          </p>
        </div>

        <div className="mt-10 space-y-8">
          <div className="space-y-4">
            <p className="text-sm font-bold text-gray-700 text-center uppercase tracking-wider">I am a...</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('tenant')}
                className={`flex flex-col items-center justify-center p-6 border-2 rounded-2xl transition-all ${
                  role === 'tenant' 
                    ? 'border-primary-600 bg-primary-50 text-primary-700' 
                    : 'border-gray-100 hover:border-primary-200 hover:bg-gray-50 text-gray-500'
                }`}
              >
                <User className={`h-8 w-8 mb-3 ${role === 'tenant' ? 'text-primary-600' : 'text-gray-400'}`} />
                <span className="font-bold">Tenant</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('landlord')}
                className={`flex flex-col items-center justify-center p-6 border-2 rounded-2xl transition-all ${
                  role === 'landlord' 
                    ? 'border-primary-600 bg-primary-50 text-primary-700' 
                    : 'border-gray-100 hover:border-primary-200 hover:bg-gray-50 text-gray-500'
                }`}
              >
                <Key className={`h-8 w-8 mb-3 ${role === 'landlord' ? 'text-primary-600' : 'text-gray-400'}`} />
                <span className="font-bold">Landlord</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-base font-bold rounded-xl text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Signing in...</span>
              </div>
            ) : (
              'Continue with Google'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
