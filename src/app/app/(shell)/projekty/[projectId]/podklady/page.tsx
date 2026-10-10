import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentList } from "@/components/projects/document-list";
import { DocumentUpload } from "@/components/projects/document-upload";
import { AddFactForm, FactList, IssueList } from "@/components/projects/fact-review";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { buttonClasses } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { getSupabasePublicConfig } from "@/config/env";
import { requireUser } from "@/lib/auth/session";
import { getProject, listFacts, listIssues } from "@/lib/db/projects";
import { getBillingContext } from "@/lib/db/usage";
import { checkEntitlement } from "@/lib/billing/plans";
import { listDocuments } from "@/lib/documents/service";
import { formatDateTime } from "@/lib/format";
import { isUuid } from "@/lib/validation/ids";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Stránka závisí od URL a dát používateľa: navigácia smie počkať na server.
export const instant = false;

export const metadata: Metadata = { title: "Podklady a fakty" };

export default async function MaterialsPage({ params, searchParams }: PageProps<"/app/projekty/[projectId]/podklady">) {
  const { projectId } = await params;
  const query = await searchParams;
  const user = await requireUser(`/app/projekty/${projectId}/podklady`);
  if (!isUuid(projectId)) notFound();
  const project = await getProject(projectId);
  if (!project) notFound();

  const supabase = await createSupabaseServerClient();
  const [documents, facts, issues, billing, role] = await Promise.all([
    listDocuments(projectId),
    listFacts(projectId),
    listIssues(projectId),
    getBillingContext(user.id),
    supabase.rpc("can_edit_project", { p_project_id: projectId }),
  ]);
  const canEdit = role.data === true;
  const config = getSupabasePublicConfig();
  const analysisAllowed = checkEntitlement(billing.plan, billing.usage, "deck_analysis").allowed;

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

      {query.novy ? (
        <Notice tone="success" className="mb-10" title="Profil je uložený">
          Ak máš pitch deck, nahraj ho. AI z neho vytiahne čísla a tvrdenia, ktoré si potom skontroluješ. Môžeš ísť aj rovno trénovať.
        </Notice>
      ) : null}

      <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-14 lg:col-span-7">
          <section aria-labelledby="docs">
            <h2 id="docs" className="type-heading text-[1.4rem]">
              Podklady
            </h2>
            <p className="mt-2 max-w-[40rem] leading-relaxed text-mute">
              Investor bude vychádzať z najnovšieho spracovaného podkladu a z faktov nižšie.
            </p>
            <div className="mt-6">
              {canEdit && config ? (
                <DocumentUpload
                  projectId={project.id}
                  supabaseUrl={config.url}
                  publishableKey={config.publishableKey}
                  disabledReason={
                    analysisAllowed ? null : "Limit analýz podkladov je na tento mesiac vyčerpaný. Fakty môžeš pridať ručne."
                  }
                />
              ) : !canEdit ? (
                <p className="text-mute">Tento projekt môžeš iba čítať.</p>
              ) : null}
            </div>
            <DocumentList
              canEdit={canEdit}
              items={documents.map((document) => ({
                id: document.id,
                fileName: document.file_name,
                fileType: document.file_type,
                status: document.status,
                slideCount: document.slide_count,
                errorCode: document.error_code,
                summary: document.analysis_summary,
                createdLabel: formatDateTime(document.created_at),
              }))}
            />
          </section>

          <section aria-labelledby="facts">
            <h2 id="facts" className="type-heading text-[1.4rem]">
              Fakty a tvrdenia
            </h2>
            <p className="mt-2 max-w-[40rem] leading-relaxed text-mute">
              Investor rozlišuje potvrdené údaje, údaje z podkladu a interpretácie AI. Neskontrolované návrhy berie iba ako hypotézy.
            </p>
            <div className="mt-6">
              <FactList
                projectId={project.id}
                canEdit={canEdit}
                facts={facts.map((fact) => ({
                  id: fact.id,
                  category: fact.category,
                  label: fact.label,
                  valueText: fact.value_text,
                  period: fact.period,
                  sourceType: fact.source_type,
                  status: fact.status,
                  confidence: fact.confidence,
                  slideNumber: fact.slide_number,
                  quote: fact.source_quote,
                }))}
              />
            </div>
          </section>
        </div>

        <div className="space-y-14 lg:col-span-5">
          <section aria-labelledby="issues">
            <h2 id="issues" className="type-heading text-[1.4rem]">
              Čo chýba alebo nesedí
            </h2>
            <p className="mt-2 leading-relaxed text-mute">Presne na tieto miesta sa investor pravdepodobne opýta.</p>
            <div className="mt-6">
              <IssueList
                projectId={project.id}
                canEdit={canEdit}
                issues={issues.map((issue) => ({
                  id: issue.id,
                  kind: issue.kind,
                  description: issue.description,
                  slideNumber: issue.slide_number,
                  status: issue.status,
                }))}
              />
            </div>
          </section>

          {canEdit ? (
            <section aria-labelledby="add-fact" className="rounded-[16px] border border-line bg-panel/60 p-6">
              <h2 id="add-fact" className="type-heading text-[1.25rem]">
                Pridať údaj ručne
              </h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-mute">
                Čísla, ktoré v podklade nie sú alebo sa zmenili. Údaj od teba je potvrdený.
              </p>
              <div className="mt-5">
                <AddFactForm projectId={project.id} />
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
