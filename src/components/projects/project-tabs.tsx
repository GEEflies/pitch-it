"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/app/projekty/${projectId}`, label: "Profil" },
    { href: `/app/projekty/${projectId}/podklady`, label: "Podklady a fakty" },
  ];
  return (
    <nav aria-label="Časti projektu" className="mb-8 border-b border-line/70">
      <ul className="-mb-px flex gap-6">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-block border-b-2 pb-3 text-[15px] transition-colors ${
                  active ? "border-signal text-paper" : "border-transparent text-mute hover:text-paper"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
