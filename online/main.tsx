import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '../app/globals.css';
import '../app/workspace.css';
import '../app/focus-timeline.css';
import '../app/learn/learn.css';
import '../app/light.css';
import '../app/light-fixes.css';
import Viewer from '../app/viewer';
import type { Patient, StudyRecord } from '../app/library-workspace';
import { demoCatalogUrl } from '@/lib/online';

type Catalogue = { patient: Patient; studies: StudyRecord[] };
const none = () => {};

/** The online demo: the viewer on the demo study, learning mode open. */
function OnlineDemo() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch(demoCatalogUrl())
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Catalogue>;
      })
      .then(setCatalogue)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
  }, []);
  if (error)
    return <p className="online-message">The demo could not load ({error}).</p>;
  if (!catalogue) return <p className="online-message">Loading the demo…</p>;
  return (
    <Viewer
      patient={catalogue.patient}
      studies={catalogue.studies}
      patients={[catalogue.patient]}
      onPatient={none}
      onLibrary={none}
      onImport={none}
      onEdit={none}
      onHome={none}
      initialLearn
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OnlineDemo />
  </StrictMode>,
);
