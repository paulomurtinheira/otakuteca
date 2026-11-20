// AniList: base de dados gratuita de anime e manga (GraphQL, sem chave, aceita pedidos do browser).

const URL_API = 'https://graphql.anilist.co';
const cache = new Map();

async function gql(query, variables = {}, ttl = 5 * 60e3) {
  const ck = query + JSON.stringify(variables);
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.t < ttl) return hit.v;

  let res;
  try {
    res = await fetch(URL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error('Sem ligação ao AniList. Estás offline?');
  }
  if (res.status === 429) throw new Error('O AniList pediu para abrandar. Tenta daqui a um minuto.');
  const json = await res.json().catch(() => ({}));
  if (json.errors?.length) {
    const e = json.errors[0];
    const err = new Error(e.message || 'Erro do AniList');
    err.status = e.status;
    throw err;
  }
  if (!res.ok) throw new Error('Erro do AniList (' + res.status + ')');
  cache.set(ck, { t: Date.now(), v: json.data });
  return json.data;
}

const M = `fragment M on Media {
  id idMal type format status episodes chapters duration season seasonYear
  startDate{year} title{romaji english} coverImage{large color} bannerImage
  genres averageScore popularity studios(isMain:true){nodes{name}}
  nextAiringEpisode{episode airingAt}
}`;

/** Converte um resultado do AniList no formato curto que guardamos. */
export function toItem(m) {
  return {
    id: m.id, type: m.type, mal: m.idMal || null,
    title: m.title?.romaji || m.title?.english || '???', en: m.title?.english || null,
    cover: m.coverImage?.large || null, color: m.coverImage?.color || null, banner: m.bannerImage || null,
    fmt: m.format || null,
    eps: (m.type === 'MANGA' ? m.chapters : m.episodes) || 0,
    dur: m.duration || 0,
    year: m.seasonYear || m.startDate?.year || null,
    genres: m.genres || [],
    studio: m.studios?.nodes?.[0]?.name || null,
    avg: m.averageScore || 0,
    mstatus: m.status || null,
    air: m.nextAiringEpisode ? { ep: m.nextAiringEpisode.episode, at: m.nextAiringEpisode.airingAt * 1000 } : null,
  };
}

export const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha',
  'Music', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'];

export function currentSeason(d = new Date()) {
  return { season: ['WINTER', 'SPRING', 'SUMMER', 'FALL'][Math.floor(d.getMonth() / 3)], year: d.getFullYear() };
}

export async function browse({ type = 'ANIME', search = '', sort, season, year, genre, page = 1 }) {
  const data = await gql(`${M}
    query($page:Int,$search:String,$type:MediaType,$sort:[MediaSort],$season:MediaSeason,$year:Int,$genre:String){
      Page(page:$page,perPage:24){
        pageInfo{hasNextPage}
        media(search:$search,type:$type,sort:$sort,season:$season,seasonYear:$year,genre:$genre,isAdult:false){...M}
      }
    }`, {
    page, type, search: search || undefined, genre: genre || undefined, season, year,
    sort: [search ? 'SEARCH_MATCH' : (sort || 'TRENDING_DESC')],
  });
  return { items: data.Page.media.map(toItem), more: data.Page.pageInfo.hasNextPage };
}

export async function detail(id) {
  const data = await gql(`${M}
    query($id:Int){ Media(id:$id){
      ...M description(asHtml:false) siteUrl trailer{id site}
      tags{name rank isMediaSpoiler}
      externalLinks{site url type}
      relations{edges{relationType(version:2) node{...M}}}
      recommendations(sort:RATING_DESC,perPage:12){nodes{rating mediaRecommendation{...M}}}
    } }`, { id }, 30 * 60e3);
  const m = data.Media;
  return {
    ...toItem(m),
    description: m.description || '',
    siteUrl: m.siteUrl,
    trailer: m.trailer,
    tags: (m.tags || []).filter((t) => !t.isMediaSpoiler).slice(0, 8).map((t) => t.name),
    links: (m.externalLinks || []).filter((l) => l.type === 'STREAMING'),
    relations: (m.relations?.edges || [])
      .filter((e) => e.node && !['CHARACTER', 'OTHER'].includes(e.relationType))
      .map((e) => ({ rel: e.relationType, item: toItem(e.node) })),
    recs: (m.recommendations?.nodes || []).filter((n) => n.mediaRecommendation).map((n) => toItem(n.mediaRecommendation)),
  };
}

/** Atualiza de uma vez o estado de emissão de vários anime (máx. 50 por pedido). */
export async function airing(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const data = await gql(`query($ids:[Int]){ Page(page:1,perPage:50){ media(id_in:$ids,type:ANIME){
        id status episodes nextAiringEpisode{episode airingAt} } } }`, { ids: chunk }, 60e3);
    for (const m of data.Page.media) {
      out[m.id] = {
        st: m.status, eps: m.episodes || 0,
        ep: m.nextAiringEpisode?.episode || 0,
        at: m.nextAiringEpisode ? m.nextAiringEpisode.airingAt * 1000 : 0,
      };
    }
  }
  return out;
}

/** "Para ti": vai buscar as recomendações dos teus favoritos e pontua o que aparece mais vezes. */
export async function recommendFrom(seeds, owned) {
  const parts = seeds.map((s, i) => `s${i}:Media(id:${Number(s.id)}){ recommendations(sort:RATING_DESC,perPage:10){nodes{rating mediaRecommendation{...M}}} }`);
  const data = await gql(`${M} query{ ${parts.join('\n')} }`, {}, 30 * 60e3);
  const scored = new Map();
  seeds.forEach((s, i) => {
    for (const n of data['s' + i]?.recommendations?.nodes || []) {
      const m = n.mediaRecommendation;
      if (!m || owned.has(m.type[0] + m.id) || (n.rating ?? 0) < 1) continue;
      const w = (s.score || 7) - 5; // quanto mais gostaste da origem, mais pesa
      const e = scored.get(m.id) || { item: toItem(m), score: 0, from: [] };
      e.score += w * Math.log2(2 + (n.rating || 0)) + 1;
      e.from.push(s);
      scored.set(m.id, e);
    }
  });
  return [...scored.values()].sort((a, b) => b.score - a.score).slice(0, 24);
}

/** Importar a lista pública de alguém do AniList. */
export async function userList(name, type = 'ANIME') {
  const data = await gql(`${M}
    query($u:String,$t:MediaType){ MediaListCollection(userName:$u,type:$t){ lists{ entries{
      status progress repeat score(format:POINT_10_DECIMAL) notes
      startedAt{year month day} completedAt{year month day}
      media{...M} } } } }`, { u: name, t: type }, 0);
  const seen = new Map();
  for (const l of data.MediaListCollection.lists) for (const e of l.entries) seen.set(e.media.id, e);
  return [...seen.values()];
}

/** MyAnimeList -> AniList (pelos ids do MAL). */
export async function byMalIds(ids, type = 'ANIME') {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const data = await gql(`${M} query($ids:[Int],$t:MediaType){ Page(page:1,perPage:50){ media(idMal_in:$ids,type:$t){...M} } }`,
      { ids: chunk, t: type }, 0);
    out.push(...data.Page.media);
  }
  return out;
}
