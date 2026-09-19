// Environment access — lazy so modules can be imported in tests/builds
// without env vars present.

export function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

export function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export function appUrl(): string {
  return optionalEnv("APP_URL") ?? "http://localhost:3000";
}

export function signingSecret(): string {
  return requiredEnv("SIGNING_SECRET");
}

export function adminPassword(): string {
  return requiredEnv("ADMIN_PASSWORD");
}

export function adminEmail(): string {
  return requiredEnv("ADMIN_EMAIL");
}

export function emailFrom(): string {
  return optionalEnv("EMAIL_FROM") ?? "House Scheduler <onboarding@resend.dev>";
}

export function resendApiKey(): string | undefined {
  return optionalEnv("RESEND_API_KEY");
}
