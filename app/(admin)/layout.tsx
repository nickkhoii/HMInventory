import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    if (e instanceof AppError && e.status === 401) redirect("/login");
    throw e;
  }
  return <Shell name={admin.name}>{children}</Shell>;
}
