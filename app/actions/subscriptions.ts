"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteSession, getSession } from "@/app/lib/session";

async function callSubscriptionsApi(method: "POST" | "DELETE", userId: string, keyword: string) {
  const res = await fetch(`${process.env.PTT_API_BASE_URL}/subscriptions`, {
    method,
    headers: { "Content-Type": "application/json", "x-api-key": process.env.PTT_WEB_API_KEY! },
    body: JSON.stringify({ userId, keyword }),
  });
  if (!res.ok) {
    throw new Error(`Subscriptions API request failed: ${res.status}`);
  }
}

export async function subscribeAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord");

  const keyword = formData.get("keyword")?.toString().trim();
  if (!keyword) return;

  await callSubscriptionsApi("POST", session.userId, keyword);
  revalidatePath("/subscriptions");
}

export async function unsubscribeAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord");

  const keyword = formData.get("keyword")?.toString();
  if (!keyword) return;

  await callSubscriptionsApi("DELETE", session.userId, keyword);
  revalidatePath("/subscriptions");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/");
}
