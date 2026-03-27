import { SignUp } from '@clerk/clerk-react';
import AuthCard from '../components/AuthCard';

export default function SignUpPage() {
  return (
    <AuthCard
      variant="glass"
      size="md"
      glow="premium"
      border="gradient"
      heading="Create your account"
      subheading="Start scanning high-confidence opportunities"
    >
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        forceRedirectUrl="/dashboard"
      />
    </AuthCard>
  );
}
