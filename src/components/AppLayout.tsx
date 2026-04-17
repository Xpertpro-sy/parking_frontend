import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import MobileNav from './MobileNav';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <AppSidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
        <MobileNav />
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
