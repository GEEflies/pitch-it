import type { ReactNode } from "react";
import { Suspense } from "react";
import { AccountMenu } from "@/components/app/account-menu";
import { AppNav } from "@/components/app/app-nav";
import { PageSkeleton } from "@/components/ui/skeleton";

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <AppNav
        account={
          <Suspense fallback={<div className="h-12" />}>
            <AccountMenu />
          </Suspense>
        }
      />
      <main id="obsah" className="min-w-0 flex-1 px-4 py-8 sm:px-6 md:px-10 md:py-12">
        <div className="mx-auto max-w-[72rem]">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}
