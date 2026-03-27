import { SignIn } from '@clerk/clerk-react';
import AuthCard from '../components/AuthCard';

export default function SignInPage() {
  return (
    <AuthCard
      variant="glass"
      size="md"
      glow="subtle"
      border="gradient"
      heading="Welcome back"
      subheading="Sign in to access your market intelligence"
    >
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/dashboard"
      />
    </AuthCard>
  );
}
