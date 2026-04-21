import { Outlet } from "react-router-dom";
import { SubscriptionWorkspaceProvider, useSubscriptionWorkspace } from "@/context/SubscriptionWorkspaceContext";
import SubscriptionExpiredBanner from "@/components/SubscriptionExpiredBanner";
import AppSidebar from "./AppSidebar";
import MobileNav from "./MobileNav";

function AppMainColumn() {
  const { showExpiredBanner } = useSubscriptionWorkspace();

  return (
    <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-x-hidden md:ml-64">
      <SubscriptionExpiredBanner />
      {showExpiredBanner ? <div className="h-[3.25rem] shrink-0 border-b border-transparent" aria-hidden /> : null}
      <MobileNav />
      <main className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}

export default function AppLayout() {
  return (
    <SubscriptionWorkspaceProvider>
      <div className="flex h-dvh overflow-hidden overflow-x-hidden">
        <AppSidebar />
        <AppMainColumn />
      </div>
    </SubscriptionWorkspaceProvider>
  );
}
