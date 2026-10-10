import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { getMaterialCounts, listProjects } from "@/lib/db/projects";
import { STAGE_LABELS } from "@/lib/domain/labels";
import { formatDate, plural } from "@/lib/format";
import { profileCompleteness } from "@/lib/projects/form-values";

// Stránka závisí od URL a dát používateľa: navigácia smie počkať na server.
export const instant = false;

export const metadata: Metadata = { title: "Projekty" };

export default async function ProjectsPage({ searchParams }: PageProps<"/app/projekty">) {
  const user = await requireUser("/app/projekty");
  const params = await searchParams;
  const projects = await listProjects();
  const counts = await getMaterialCounts(projects.map((project) => project.id));

  return (
    <>
      <PageHeader
        title="Projekty"
        description="Profil startupu a podklady, z ktorých investor vychádza. Pri každom tréningu vyberieš, za ktorý projekt hovoríš."
        actions={
          projects.length > 0 ? (
            <Link href="/app/projekty/novy" className={buttonClasses()}>
              Nový projekt
            </Link>
          ) : null
        }
      />
      {params.zmazany ? <Notice tone="success" className="mb-8">Projekt je zmazaný aj s podkladmi a tréningami.</Notice> : null}

      {projects.length === 0 ? (
        <EmptyState
          title="Zatiaľ žiadny projekt"
          action={
            <Link href="/app/projekty/novy" className={buttonClasses({ size: "lg" })}>
              Vytvoriť profil startupu
            </Link>
          }
        >
          Profil zaberie pár minút. Stačí názov a fáza, zvyšok môžeš doplniť neskôr alebo nahrať pitch deck.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line/70 border-y border-line/70">
          {projects.map((project) => {
            const completeness = profileCompleteness(project);
            const count = counts[project.id] ?? { documents: 0, facts: 0, openIssues: 0 };
            const mine = project.owner_id === user.id;
            return (
              <li key={project.id} className="grid gap-4 py-6 md:grid-cols-12 md:items-center">
                <div className="md:col-span-6">
                  <Link href={`/app/projekty/${project.id}`} className="type-heading text-[1.35rem] hover:text-signal-soft">
                    {project.name}
                  </Link>
                  {project.one_liner ? <p className="mt-1 line-clamp-2 text-mute">{project.one_liner}</p> : null}
                  <p className="mt-2 text-sm text-faint">
                    {STAGE_LABELS[project.stage]}, upravené {formatDate(project.updated_at)}
                    {!mine ? ", zdieľaný projekt" : ""}
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-4 text-sm md:col-span-4">
                  <div>
                    <dt className="text-faint">Profil</dt>
                    <dd className="mt-0.5 tabular-nums text-paper">
                      {completeness.filled}/{completeness.total}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-faint">Podklady</dt>
                    <dd className="mt-0.5 tabular-nums text-paper">{count.documents}</dd>
                  </div>
                  <div>
                    <dt className="text-faint">Na kontrolu</dt>
                    <dd className={`mt-0.5 tabular-nums ${count.openIssues > 0 ? "text-marker" : "text-paper"}`}>
                      {count.openIssues} {plural(count.openIssues, "problém", "problémy", "problémov")}
                    </dd>
                  </div>
                </dl>
                <div className="flex gap-2 md:col-span-2 md:justify-end">
                  <Link href={`/app/trening/novy?projekt=${project.id}`} className={buttonClasses({ variant: "secondary" })}>
                    Trénovať
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
