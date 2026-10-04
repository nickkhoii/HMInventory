import { notFound } from "next/navigation";
import { Workspace } from "@/components/workspace";
const sections = [
  "dashboard",
  "inventory",
  "categories",
  "locations",
  "stock-in",
  "stock-out",
  "adjustments",
  "damaged",
  "lost",
  "disposal",
  "transactions",
  "reports",
  "activity",
  "settings",
];
export default async function Section({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <Workspace key={section} section={section} />;
}
