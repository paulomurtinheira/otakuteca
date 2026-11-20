// Mantém a cache dos "próximos episódios" dos anime que estás a ver / planeaste.

import { state, all, setAir, setCfg, patch } from './store.js';
import { airing } from './anilist.js';

export async function refreshAiring(force = false) {
  if (!force && Date.now() - (state.cfg.lastAir || 0) < 60 * 60e3) return false;
  const watch = all().filter((i) => i.type === 'ANIME' && ['WATCHING', 'PLANNED', 'PAUSED'].includes(i.status));
  if (!watch.length) return false;
  try {
    const res = await airing(watch.map((i) => i.id));
    setAir({ ...state.air, ...res });
    setCfg({ lastAir: Date.now() });
    // se o AniList ficou a saber o total de episódios, guardamos
    for (const i of watch) {
      const eps = res[i.id]?.eps;
      if (eps && eps !== i.eps) patch(i.k, { eps });
    }
    return true;
  } catch (e) {
    console.warn('Não consegui atualizar os episódios:', e.message);
    return false;
  }
}
