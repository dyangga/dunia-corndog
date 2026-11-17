import { notFound } from "next/navigation";
import App from "@/components/owner-shell";
const views = [
  "dashboard",
  "orders",
  "reports",
  "catalog",
  "inventory",
  "expenses",
  "branches",
  "users",
  "settings",
  "pos",
  "queue",
  "login",
  "notifications",
];
export default async function Page({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (!views.includes(view)) notFound();
  return <App initialPage={view} />;
}
