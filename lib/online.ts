/// <reference types="vite/client" />
/**
 * The online demo (docs/online/PLAN.md) is a static build of the same viewer.
 * It reads the demo study from files published next to the page instead of
 * the local server, which never runs online. vite.online.config.ts sets
 * VITE_OPENMRI_ONLINE; in the local app it is unset and nothing changes.
 */
export const ONLINE = import.meta.env.VITE_OPENMRI_ONLINE === '1';
const base = () => import.meta.env.BASE_URL || '/';

/** Where a series volume is loaded from. */
export function volumeUrl(url: string) {
  if (ONLINE) return `${base()}data/volumes/${url.split('/').pop()}.nii.gz`;
  return url.startsWith('/api/') ? url : `/api/${url.replace(/^\//, '')}`;
}
/** Where a study manifest is loaded from. */
export const studyUrl = (id: string) =>
  ONLINE
    ? `${base()}data/studies/${encodeURIComponent(id)}.json`
    : `/api/library/studies/${encodeURIComponent(id)}`;
/** Where a 3D model (STL) of a label-map region is loaded from. */
export function meshUrl(url: string) {
  if (ONLINE) return `${base()}data/meshes/${url.split('/').pop()}.stl`;
  return url;
}
/** The online demo's patients and studies (the teaching cases). */
export const demoCatalogUrl = () => `${base()}data/demo.json`;
