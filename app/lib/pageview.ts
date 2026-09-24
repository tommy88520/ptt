import "server-only";
import { incrementPageView } from "@/app/services/pageviews";

export async function recordPageView(path: string): Promise<void> {
  try {
    await incrementPageView(path);
  } catch {
    // Page view tracking should never break the page itself.
  }
}
