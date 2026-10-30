import { redirect } from "next/navigation";
import { getSessionCompanyId } from "@/lib/session";
import SettingsView from "@/components/SettingsView";

export default function SettingsPage() {
  if (!getSessionCompanyId()) redirect("/");
  return <SettingsView />;
}
