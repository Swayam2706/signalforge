import { useAuth } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

/**
 * Wraps a route so only authenticated users can access it.
 * Redirects to /sign-in if not authenticated.
 */
export default function ProtectedRoute({ children }) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    // Show a minimal loading state while Clerk initializes
    return (
      <div className="flex h-screen items-center justify-center bg-base">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return children;
}
