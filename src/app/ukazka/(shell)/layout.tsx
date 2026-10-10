import type { ReactNode } from "react";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { AppNav } from "@/components/app/app-nav";

export default function PreviewShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <AppNav variant="preview" account={<p className="px-1 text-sm text-mute">Ukážkový účet</p>} />
      <main id="obsah" className="min-w-0 flex-1 px-4 py-8 sm:px-6 md:px-10 md:py-12">
        <div className="mx-auto max-w-[72rem]">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}
