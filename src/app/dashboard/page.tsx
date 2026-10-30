import { redirect } from "next/navigation";
import { getSessionCompanyId } from "@/lib/session";
import Dashboard from "@/components/Dashboard";

export default function DashboardPage() {
  if (!getSessionCompanyId()) redirect("/");
  return <Dashboard />;
}
