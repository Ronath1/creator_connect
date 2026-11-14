import Link from "next/link";
import { redirect } from "next/navigation";
import { marketplaceContext } from "@/server/services/marketplace";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { member } = await marketplaceContext();
  if (member.role !== "admin") redirect("/dashboard");
  return (
    <>
      <nav className="member-nav" aria-label="Support navigation">
        <Link href="/admin">Overview</Link>
        <Link href="/admin/members">Members</Link>
        <Link href="/admin/reports">Report queue</Link>
        <Link href="/admin/audit">Audit history</Link>
      </nav>
      {children}
    </>
  );
}
