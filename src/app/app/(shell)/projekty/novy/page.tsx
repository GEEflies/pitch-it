import type { Metadata } from "next";
import Link from "next/link";
import { ProjectForm, emptyProjectValues } from "@/components/projects/project-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { createProjectAction } from "@/lib/projects/actions";

export const metadata: Metadata = { title: "Nový projekt" };

export default async function NewProjectPage() {
  await requireUser("/app/projekty/novy");
  return (
    <>
      <PageHeader
        back={
          <Link href="/app/projekty" className="link-underline text-sm text-mute hover:text-paper">
            Projekty
          </Link>
        }
        title="Profil startupu"
        description="Povinný je iba názov a fáza. Čím viac vyplníš, tým konkrétnejšie otázky dostaneš. Pitch deck nahráš v ďalšom kroku."
      />
      <ProjectForm
        action={createProjectAction}
        initial={emptyProjectValues}
        submitLabel="Uložiť a pokračovať"
        pendingLabel="Ukladám…"
      />
    </>
  );
}
