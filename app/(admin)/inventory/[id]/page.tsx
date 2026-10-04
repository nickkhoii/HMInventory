import { ItemDetail } from "@/components/item-detail";
export default async function Detail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ItemDetail id={id} />;
}
