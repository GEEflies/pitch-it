import type { ReactNode } from "react";
import { Suspense } from "react";
import { AppSidebar } from "@/components/app/app-nav";
import { MobileNavProvider } from "@/components/app/mobile-nav";
import { PlanCardLoader, PlanCardSkeleton } from "@/components/app/plan-card";
import { TopBarLoader, TopBarSkeleton } from "@/components/app/top-bar";
import { PageSkeleton } from "@/components/ui/skeleton";

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <MobileNavProvider>
      <div className="app-shell app-glow flex min-h-dvh">
        <AppSidebar
          footer={
            <Suspense fallback={<PlanCardSkeleton />}>
              <PlanCardLoader />
            </Suspense>
          }
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense fallback={<TopBarSkeleton />}>
            <TopBarLoader />
          </Suspense>
          <main id="obsah" className="min-w-0 flex-1 px-4 pt-6 pb-10 sm:px-6 lg:px-9 lg:pt-1">
            <div className="max-w-[1320px]">
              <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
            </div>
          </main>
        </div>
      </div>
    </MobileNavProvider>
  );
}
