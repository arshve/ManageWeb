import { redirect } from 'next/navigation';
import { getProfile, dashboardUrlForRole } from '@/lib/auth';
import { getAppConfig } from '@/lib/config/get-config';
import { LoginForm } from '@/components/auth/login-form';

export default async function LoginPage() {
  const profile = await getProfile();
  if (profile) redirect(dashboardUrlForRole(profile.role));
  const cfg = await getAppConfig();
  return (
    <LoginForm
      brand={{ brandName: cfg.brandName, appDescription: cfg.appDescription, logoUrl: cfg.logoUrl }}
    />
  );
}

// redeploy
