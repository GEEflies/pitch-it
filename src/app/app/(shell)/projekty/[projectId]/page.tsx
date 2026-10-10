import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectForm } from "@/components/projects/project-form";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { getProject } from "@/lib/db/projects";
import { isUuid } from "@/lib/validation/ids";
import { deleteProjectAction, updateProjectAction } from "@/lib/projects/actions";
import { projectToFormValues } from "@/lib/projects/form-values";

// Stránka závisí od URL a dát používateľa: navigácia smie počkať na server.
export const instant = false;

export const metadata: Metadata = { title: "Profil startupu" };

export default async function ProjectPage({ params }: PageProps<"/app/projekty/[projectId]">) {
  const { projectId } = await params;
  const user = await requireUser(`/app/projekty/${projectId}`);
  if (!isUuid(projectId)) notFound();
  const project = await getProject(projectId);
  if (!project) notFound();

  const isOwner = project.owner_id === user.id;

  return (
    <>
      <PageHeader
        back={
          <Link href="/app/projekty" className="link-underline text-sm text-mute hover:text-paper">
            Projekty
          </Link>
        }
        title={project.name}
        actions={
          <Link href={`/app/trening/novy?projekt=${project.id}`} className={buttonClasses()}>
            Trénovať s týmto projektom
          </Link>
        }
      />
      <ProjectTabs projectId={project.id} />
      <ProjectForm
        action={updateProjectAction.bind(null, project.id)}
        initial={projectToFormValues(project)}
        submitLabel="Uložiť zmeny"
        pendingLabel="Ukladám…"
      />

      {isOwner ? (
        <section aria-labelledby="danger" className="mt-16 border-t border-coral/30 pt-8">
          <h2 id="danger" className="type-heading text-[1.25rem]">
            Zmazať projekt
          </h2>
          <p className="mt-2 max-w-[40rem] leading-relaxed text-mute">
            Zmaže profil, nahrané podklady, fakty a všetky tréningy s reportmi pre tento projekt. Nedá sa to vrátiť.
          </p>
          <div className="mt-4">
            <ConfirmAction
              trigger="Zmazať projekt"
              title={`Zmazať projekt ${project.name}?`}
              description="Zmažú sa aj podklady, tréningy, prepisy a reporty tohto projektu. Spotreba minút v tomto mesiaci sa nevráti."
              confirmLabel="Zmazať natrvalo"
              pendingLabel="Mažem…"
              action={deleteProjectAction.bind(null, project.id)}
            />
          </div>
        </section>
      ) : null}
    </>
  );
}
