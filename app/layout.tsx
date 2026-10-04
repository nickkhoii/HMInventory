import type { Metadata } from "next";
import "./globals.css";
import { connection } from "next/server";
export const metadata: Metadata = {
  title: "HM Laboratory · Inventory",
  description: "Hospitality Management Laboratory Inventory Management System",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
