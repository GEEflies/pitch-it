import type { ReactNode } from "react";
import { Suspense } from "react";
import { Spinner } from "@/components/ui/submit-button";

/** Layout bez navigácie: tréningová miestnosť dostane celú obrazovku. */
export default function FocusLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-mute" role="status">
          <Spinner className="mr-2 size-5" />
          Pripravujem miestnosť…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
