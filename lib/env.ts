function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get NEXT_PUBLIC_SUPABASE_URL() {
    return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
    return (
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    );
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  },
  get NEXTAUTH_SECRET() {
    return requireEnv("NEXTAUTH_SECRET");
  },
  get ADMIN_EMAIL() {
    return requireEnv("ADMIN_EMAIL");
  },
  get ADMIN_PASSWORD_HASH() {
    return requireEnv("ADMIN_PASSWORD_HASH");
  },
  get DATABASE_URL() {
    return process.env.DATABASE_URL;
  },
  get SQL_CONSOLE_ENABLED() {
    return process.env.SQL_CONSOLE_ENABLED ?? "false";
  },
  get BOOTSTRAP_TOKEN() {
    return process.env.BOOTSTRAP_TOKEN;
  },
};
