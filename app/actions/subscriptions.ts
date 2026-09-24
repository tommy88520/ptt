"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteSession, getSession } from "@/app/lib/session";
import { subscribe, unsubscribe } from "@/app/services/subscriptions";

export async function subscribeAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord");

  const keyword = formData.get("keyword")?.toString().trim();
  if (!keyword) return;

  await subscribe(session.userId, keyword);
  revalidatePath("/subscriptions");
}

export async function unsubscribeAction(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord");

  const keyword = formData.get("keyword")?.toString();
  if (!keyword) return;

  await unsubscribe(session.userId, keyword);
  revalidatePath("/subscriptions");
}

export async function logoutAction() {
  await deleteSession();
  redirect("/");
}
