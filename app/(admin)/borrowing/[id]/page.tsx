import { BorrowDetail } from "@/components/borrowing";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BorrowDetail id={id} />;
}
