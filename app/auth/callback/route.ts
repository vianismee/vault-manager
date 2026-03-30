import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  // First exchange code for session if present
  let userNeedsOnboarding = false;

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    await supabase.auth.exchangeCodeForSession(code);

    // Check if user has a vault chain immediately after code exchange
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: chain } = await supabase
        .from("vault_chains")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle(); // Use maybeSingle to handle no results without error

      // No vault chain means user needs onboarding
      if (!chain) {
        userNeedsOnboarding = true;
      }
    }
  }

  // Determine redirect target
  // If user has no vault chain → onboarding
  // Otherwise → vault (middleware will handle lock screen)
  const redirectUrl = userNeedsOnboarding
    ? new URL("/onboarding", requestUrl.origin)
    : new URL("/vault", requestUrl.origin);

  return NextResponse.redirect(redirectUrl);
}
