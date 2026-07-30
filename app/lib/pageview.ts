import "server-only";

export async function recordPageView(path: string): Promise<void> {
  try {
    await fetch(`${process.env.PTT_API_BASE_URL}/pageviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.PTT_WEB_API_KEY! },
      body: JSON.stringify({ path }),
    });
  } catch {
    // Page view tracking should never break the page itself.
  }
}
