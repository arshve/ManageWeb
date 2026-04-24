import { redirect } from 'next/navigation';
import { getProfile, dashboardUrlForRole } from '@/lib/auth';
import { LoginForm } from '@/components/auth/login-form';

export default async function LoginPage() {
  const profile = await getProfile();
  if (profile) redirect(dashboardUrlForRole(profile.role));
  return <LoginForm />;
}

// redeploy
