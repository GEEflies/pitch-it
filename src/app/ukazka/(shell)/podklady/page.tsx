import { DocumentList } from "@/components/projects/document-list";
import { FactList, IssueList } from "@/components/projects/fact-review";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { PREVIEW_DOCUMENTS, PREVIEW_FACTS, PREVIEW_ISSUES, PREVIEW_PROJECT } from "@/lib/preview/fixtures";

export default function PreviewMaterials() {
  return (
    <>
      <PageHeader title={PREVIEW_PROJECT.name} description="Podklady a fakty, z ktorých investor vychádza." />
      <Notice tone="info" className="mb-10">
        V ukážke sú obrazovky iba na čítanie. Nahrávanie a potvrdzovanie faktov funguje po prihlásení.
      </Notice>
      <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-14 lg:col-span-7">
          <section aria-labelledby="docs">
            <h2 id="docs" className="type-heading text-[1.4rem]">
              Podklady
            </h2>
            <DocumentList canEdit={false} items={PREVIEW_DOCUMENTS} />
          </section>
          <section aria-labelledby="facts">
            <h2 id="facts" className="type-heading text-[1.4rem]">
              Fakty a tvrdenia
            </h2>
            <p className="mt-2 max-w-[40rem] leading-relaxed text-mute">
              Investor rozlišuje potvrdené údaje, údaje z podkladu a interpretácie AI. Neskontrolované návrhy berie iba ako hypotézy.
            </p>
            <div className="mt-6">
              <FactList projectId={PREVIEW_PROJECT.id} canEdit={false} facts={PREVIEW_FACTS} />
            </div>
          </section>
        </div>
        <section aria-labelledby="issues" className="lg:col-span-5">
          <h2 id="issues" className="type-heading text-[1.4rem]">
            Čo chýba alebo nesedí
          </h2>
          <p className="mt-2 leading-relaxed text-mute">Presne na tieto miesta sa investor pravdepodobne opýta.</p>
          <div className="mt-6">
            <IssueList projectId={PREVIEW_PROJECT.id} canEdit={false} issues={PREVIEW_ISSUES} />
          </div>
        </section>
      </div>
    </>
  );
}
