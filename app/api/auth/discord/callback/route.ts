import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession } from "@/app/lib/session";

interface DiscordTokenResponse {
  access_token: string;
}

interface DiscordUser {
  id: string;
  username: string;
}

export async function GET(request: Request) {
  // Only used to read the query string; the host/protocol portion is
  // unreliable behind Amplify's SSR compute, so every redirect below is
  // built from APP_BASE_URL instead.
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("discord_oauth_state")?.value;
  cookieStore.delete("discord_oauth_state");

  if (!code || !state || state !== expectedState) {
    return NextResponse.redirect(new URL("/?error=invalid_oauth_state", process.env.APP_BASE_URL));
  }

  const redirectUri = new URL("/api/auth/discord/callback", process.env.APP_BASE_URL).toString();

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/?error=discord_token_exchange_failed", process.env.APP_BASE_URL));
  }
  const token = (await tokenRes.json()) as DiscordTokenResponse;

  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!userRes.ok) {
    return NextResponse.redirect(new URL("/?error=discord_user_fetch_failed", process.env.APP_BASE_URL));
  }
  const user = (await userRes.json()) as DiscordUser;

  await createSession(user.id, user.username);
  return NextResponse.redirect(new URL("/subscriptions", process.env.APP_BASE_URL));
}
