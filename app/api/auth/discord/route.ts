import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("discord_oauth_state", state, {
    httpOnly: true,
    secure: true,
    maxAge: 600,
    sameSite: "lax",
    path: "/",
  });

  // Don't derive this from the incoming request: behind the Cloudflare
  // Tunnel, request.url resolves to "localhost:3200" instead of the real
  // public domain.
  const redirectUri = new URL("/api/auth/discord/callback", process.env.APP_BASE_URL).toString();

  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID!);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizeUrl);
}
