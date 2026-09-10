import fs from 'node:fs/promises';
import path from 'node:path';

const OUT = process.argv[2] ?? 'artwork';
const UA = {
  'User-Agent': 'FrameCast/0.1 (personal art slideshow)',
  // O Art Institute pede um cabecalho proprio para identificar o cliente.
  'AIC-User-Agent': 'FrameCast (personal art slideshow)',
};
/**
 * Altura do painel de destino. O FrameCast ancora a obra na altura da tela,
 * entao e a altura — nao a largura — que decide se havera interpolacao.
 * Sobrescreva com `npm run art -- artwork 3840` para outro monitor.
 */
const TARGET_H = Number(process.argv[3] || process.env.FRAMECAST_HEIGHT || 2560);
const MIN_W = 900;

/** Só quadros: escultura, porcelana, gravura e mobiliário não servem numa parede digital. */
const IS_PAINTING = /painting|drawing|watercolo/i;

/** As buscas por texto livre vazam de tema; cada categoria confere o que recebeu. */
const yearOf = (item) => Number((item.date.match(/\d{3,4}/) || [])[0] || 0);

const inPeriod = (from, to) => (item) => {
  const y = yearOf(item);
  return y >= from && y <= to;
};

/**
 * O acervo e para um espectador protestante reformado. O segundo mandamento,
 * lido pelo Catecismo de Heidelberg (96-98) e pelo Catecismo Maior de
 * Westminster (109), proibe representar Deus: fora Cristo e a Trindade. Junto
 * saem os temas marianos dogmaticos, que a Reforma rejeitou.
 */
const DEPICTS_CHRIST =
  /christ|jesus|madonna|virgin and child|virgin mary|mother of god|eleousa|nativity|holy family|holy infant|infant saviou?r|crucifi|piet[aà]|lamentation|deposition|entombment|resurrect|ascension|ecce homo|man of sorrows|salvator|last supper|emmaus|noli me tangere|\bmagi\b|adoration of the shepherds|epiphany|flight into egypt|presentation in the temple|circumcision|baptism|\bpassion\b|calvary|\bcross\b|golgotha|good shepherd|agnus dei|lamb of god|sacred heart|transfiguration|gethsemane|agony in the garden|veronica|redeemer|saviou?r|\btrinity\b|god the father|our lady|immaculate|coronation of the virgin|assumption|nursing virgin|maest[àa]|sacra conversazione/i;

/** Fora do canone reformado de 66 livros. */
const APOCRYPHAL = /judith|holofernes|tobias|tobit|susanna|maccabee|bel and the dragon/i;

/**
 * Episodios narrativos, nao nomes soltos: buscar por "David" ou "Moses" traz
 * retratos de gente batizada assim, e "prophet"/"angel" trazem manuscritos
 * persas e fragmentos de retabulo.
 */
const REFORMED_SUBJECT =
  /adam and eve|expulsion from|garden of eden|cain and abel|\bnoah\b|tower of babel|abraham|sacrifice of isaac|isaac and rebecca|\bjacob\b|esau|potiphar|joseph interpreting|joseph and his brethren|\bmoses\b|burning bush|red sea|golden calf|ten commandments|brazen serpent|\bmanna\b|joshua|jericho|gideon|samson|delilah|\bruth\b|\bboaz\b|samuel|\bsaul\b|\bdavid\b|goliath|bathsheba|absalom|solomon|queen of sheba|elijah|elisha|naaman|jezebel|\bahab\b|\bjob\b|jonah|daniel|belshazzar|nebuchadnezzar|lions.? den|esther|ahasuerus|mordecai|isaiah|jeremiah|ezekiel|\blot\b|hagar|ishmael|rebecca at the well|prodigal|good samaritan|pentecost|conversion of saul|saint paul|patmos|annunciation|psalm/i;

/** Outra tradicao religiosa: os termos genericos arrastam manuscritos islamicos. */
const OTHER_TRADITION =
  /khamsa|nizami|\bjami\b|panj ganj|anwar|suhaili|shahnama|zulaykha|\bperi\b|persian|iranian|islamic|mughal|ottoman|hindu|buddh/i;

/** Fragmento, estudo ou pagina de manuscrito nao sustenta uma parede sozinho. */
const NOT_A_TABLEAU =
  /historiated initial|antiphonar|gradual|\bpinnacle\b|sketch for|sketch of|\bspandrel\b|tree of jesse|study of|study for|ceiling decoration|\brecto\b|\bverso\b|fragment|predella|cartoon for|page from|\bplate [IVXLC0-9]+\b|\bfolio\b|leaf from|manuscript|illuminat|\baltarpiece\b/i;

/** Devocao mariana e paramento catolico, rejeitados pela Reforma. */
const CATHOLIC_DEVOTION = /\bvirgin\b|sibyl|fathers of the church|\bdonor\b|reliquar|rosary|papal/i;

/**
 * "Moses Seymour Jr.", "Mary Sicard David": o titulo e so o nome de alguem.
 * Exige tres palavras capitalizadas sem artigo, ou sufixo de linhagem — duas
 * palavras derrubariam "The Annunciation".
 */
const PERSONAL_PORTRAIT =
  /[Pp]ortraits?\b|\b[Vv]alentine\b| as [A-Z]|(\bJr\.|\bSr\.|\bIII)$|\b(Mr|Mrs|Miss|Dr|Sir|Lady|Comte|Comtesse|Count|Countess|Duke|Duchess|Marquis|Baron|Madame|Monsieur)\b|^(?!The |A |An |To )[A-Z][a-zà-ÿ]+ ([A-Z][a-zà-ÿ.]+ )*[A-Z][a-zà-ÿ]+$/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status === 429 || res.status >= 500) throw new Error('HTTP ' + res.status);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      if (i === tries - 1) return null;
      await sleep(800 * (i + 1));
    }
  }
  return null;
}

/* ---------------------------------------------------------------- museus -- */

async function fromAIC(term) {
  const fields = 'id,title,artist_title,date_display,image_id,is_public_domain,thumbnail,artwork_type_title';
  const url =
    'https://api.artic.edu/api/v1/artworks/search?q=' + encodeURIComponent(term) +
    '&query[term][is_public_domain]=true&fields=' + fields + '&limit=60';
  const json = await getJson(url);
  if (!json || !json.data) return [];

  return json.data.flatMap((a) => {
    if (!a.image_id || !a.is_public_domain) return [];
    if (!IS_PAINTING.test(a.artwork_type_title || '')) return [];
    const w = (a.thumbnail && a.thumbnail.width) || 0;
    const h = (a.thumbnail && a.thumbnail.height) || 0;
    if (w && w < MIN_W) return [];
    // Sem altura suficiente a obra seria esticada; melhor nao trazer.
    if (h && h < TARGET_H) return [];
    const reqH = h ? Math.min(TARGET_H, h) : TARGET_H;
    return [{
      title: a.title,
      artist: a.artist_title || 'Autor desconhecido',
      date: a.date_display || '',
      museum: 'Art Institute of Chicago',
      credit: 'CC0 / dominio publico',
      pageUrl: 'https://www.artic.edu/artworks/' + a.id,
      imageUrl:
        'https://www.artic.edu/iiif/2/' + a.image_id + '/full/,' + reqH + '/0/default.jpg',
      width: w,
      height: h,
    }];
  });
}

async function fromMet(term, limit = 30) {
  const search = await getJson(
    'https://collectionapi.metmuseum.org/public/collection/v1/search?q=' +
      encodeURIComponent(term) + '&hasImages=true&medium=Paintings',
  );
  const ids = ((search && search.objectIDs) || []).slice(0, limit);
  const out = [];

  for (const id of ids) {
    const o = await getJson('https://collectionapi.metmuseum.org/public/collection/v1/objects/' + id);
    await sleep(120); // cortesia com a API publica do Met
    if (!o || !o.isPublicDomain || !o.primaryImage) continue;
    if (!IS_PAINTING.test(o.classification || '')) continue;
    out.push({
      title: o.title,
      artist: o.artistDisplayName || 'Autor desconhecido',
      date: o.objectDate || '',
      museum: 'The Metropolitan Museum of Art',
      credit: 'Open Access / dominio publico',
      pageUrl: o.objectURL,
      imageUrl: o.primaryImage,
      fallbackUrl: o.primaryImageSmall,
      width: 0,
      height: 0,
    });
  }
  return out;
}

async function fromCMA(term) {
  const url =
    'https://openaccess-api.clevelandart.org/api/artworks/?q=' + encodeURIComponent(term) +
    '&cc0=1&has_image=1&type=Painting&limit=40';
  const json = await getJson(url);
  if (!json || !json.data) return [];

  return json.data.flatMap((a) => {
    if (!IS_PAINTING.test(a.type || '')) return [];
    const print = a.images && a.images.print;
    const web = a.images && a.images.web;
    const img = (print && print.url) || (web && web.url);
    if (!img) return [];
    const w = Number((print && print.width) || (web && web.width) || 0);
    const h = Number((print && print.height) || (web && web.height) || 0);
    if (w && w < MIN_W) return [];
    if (h && h < TARGET_H) return [];
    const creator = a.creators && a.creators[0] && a.creators[0].description;
    return [{
      title: a.title,
      artist: (creator ? creator.replace(/\s*\(.*$/, '') : '') || 'Autor desconhecido',
      date: a.creation_date || '',
      museum: 'Cleveland Museum of Art',
      credit: 'CC0',
      pageUrl: a.url,
      imageUrl: img,
      width: w,
      height: h,
    }];
  });
}

/* ------------------------------------------------------------- utilidades -- */

/** Altura pelo marcador SOF, sem decodificar a imagem inteira. */
function jpegHeight(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return buf.readUInt16BE(i + 5);
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

const sanitize = (s) =>
  s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');

function fileNameFor(item) {
  const year = (item.date.match(/\d{3,4}/) || [])[0];
  const base = sanitize(item.title + ' \u2014 ' + item.artist + (year ? ' (' + year + ')' : ''));
  return base.slice(0, 120) + '.jpg';
}

const keyOf = (i) => (i.title + '|' + i.artist).toLowerCase().replace(/[^a-z0-9|]/g, '');

/** Retrato primeiro: o alvo do FrameCast e um monitor na vertical. */
function rank(a, b) {
  const ar = a.width && a.height ? a.width / a.height : 1.3;
  const br = b.width && b.height ? b.width / b.height : 1.3;
  const aP = ar <= 1.05 ? 0 : 1;
  const bP = br <= 1.05 ? 0 : 1;
  if (aP !== bP) return aP - bP;
  return (b.width || 0) - (a.width || 0);
}

async function download(item, dir) {
  const file = path.join(dir, fileNameFor(item));
  try {
    const existing = await fs.readFile(file);
    if (existing.length > 40000 && (jpegHeight(existing) || 0) >= TARGET_H) {
      return { file, skipped: true };
    }
  } catch { /* ainda nao existe */ }

  // artic.edu derruba conexoes de forma intermitente (ECONNRESET); sem retry
  // o acervo inteiro de um museu some em silencio.
  for (const url of [item.imageUrl, item.fallbackUrl].filter(Boolean)) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(url, { headers: UA });
        if (!res.ok) {
          if (res.status >= 500 || res.status === 429) throw new Error('HTTP ' + res.status);
          break; // 404/403 nao melhora com insistencia
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 40000) break; // placeholder ou miniatura

        // Ultima barreira: o Met so revela as dimensoes depois do download.
        const height = jpegHeight(buf);
        if (!height || height < TARGET_H) break;

        await fs.writeFile(file, buf);
        return { file, bytes: buf.length };
      } catch {
        await sleep(700 * (attempt + 1));
      }
    }
  }
  return null;
}

/* ---------------------------------------------------------------- coleta -- */

const CATEGORIES = [
  {
    slug: 'impressionismo',
    quota: 45,
    // Corta o que as buscas trazem de renascentista/barroco por casar no texto.
    filter: (item) => inPeriod(1840, 1935)(item) && !DEPICTS_CHRIST.test(item.title),
    sources: [
      ['aic', 'impressionism'], ['aic', 'Claude Monet'], ['aic', 'Pierre-Auguste Renoir'],
      ['aic', 'Edgar Degas'], ['aic', 'Camille Pissarro'], ['aic', 'Gustave Caillebotte'],
      ['aic', 'Berthe Morisot'], ['aic', 'Mary Cassatt'], ['aic', 'Alfred Sisley'],
      ['aic', 'Vincent van Gogh'], ['aic', 'Paul Cezanne'], ['aic', 'Georges Seurat'],
      ['aic', 'Paul Gauguin'], ['aic', 'Eugene Boudin'],
      ['met', 'Monet'], ['met', 'Renoir'], ['met', 'Degas'], ['met', 'Pissarro'],
      ['met', 'Van Gogh'], ['met', 'Morisot'], ['met', 'Cezanne'], ['met', 'Sisley'],
      ['cma', 'impressionism'], ['cma', 'Monet'], ['cma', 'Renoir'], ['cma', 'Degas'],
    ],
  },
  {
    slug: 'biblico',
    quota: 42,
    dedupeBy: REFORMED_SUBJECT,
    filter: (item) =>
      REFORMED_SUBJECT.test(item.title) &&
      ![DEPICTS_CHRIST, APOCRYPHAL, OTHER_TRADITION, NOT_A_TABLEAU, CATHOLIC_DEVOTION,
        PERSONAL_PORTRAIT].some((re) => re.test(item.title)),
    sources: [
      ['aic', 'Old Testament'], ['aic', 'Moses'], ['aic', 'Abraham'], ['aic', 'Jacob'],
      ['aic', 'prophet'], ['aic', 'Adam and Eve'], ['aic', 'angel'], ['aic', 'Rembrandt'],
      ['met', 'Moses'], ['met', 'Abraham Isaac'], ['met', 'Jacob'], ['met', 'Joseph Egypt'],
      ['met', 'David Goliath'], ['met', 'Solomon'], ['met', 'Elijah'], ['met', 'Daniel lions'],
      ['met', 'Esther'], ['met', 'Ruth Boaz'], ['met', 'Samson'], ['met', 'Noah'],
      ['met', 'Adam and Eve'], ['met', 'Tower of Babel'], ['met', 'Belshazzar'],
      ['met', 'Hagar'], ['met', 'prophet'], ['met', 'Saint Paul'], ['met', 'Pentecost'],
      ['met', 'prodigal son'], ['met', 'Bathsheba'], ['met', 'Jonah'],
      ['met', 'Judgment of Solomon'], ['met', 'Rebecca well'], ['met', 'Lot daughters'],
      ['met', 'Israelites'], ['met', 'Rembrandt Old Testament'],
      ['aic', 'Sacrifice of Isaac'], ['aic', 'Expulsion from Paradise'],
      ['aic', 'Elijah'], ['aic', 'Daniel'], ['aic', 'Esther'], ['aic', 'Solomon'],
      ['aic', 'Samson'], ['aic', 'Joseph Egypt'], ['aic', 'David Goliath'], ['aic', 'Jonah'],
      ['aic', 'Hagar'], ['aic', 'Bathsheba'], ['aic', 'Ruth'], ['aic', 'Tower of Babel'],
      ['aic', 'prodigal son'], ['aic', 'Saint Paul'], ['aic', 'Noah'], ['aic', 'Lot'],
      ['cma', 'Old Testament'], ['cma', 'Moses'], ['cma', 'Jacob'], ['cma', 'Adam Eve'],
      ['cma', 'Abraham'], ['cma', 'Elijah'], ['cma', 'Samson'], ['cma', 'Daniel'],
      ['cma', 'Esther'], ['cma', 'Solomon'], ['cma', 'Joseph'], ['cma', 'prodigal son'],
    ],
  },
  {
    slug: 'classicos',
    quota: 34,
    filter: (item) => inPeriod(1400, 1880)(item) && !DEPICTS_CHRIST.test(item.title),
    sources: [
      ['aic', 'Rembrandt'], ['aic', 'El Greco'], ['aic', 'Camille Corot'],
      ['aic', 'Caspar David Friedrich'], ['aic', 'romantic landscape'],
      ['met', 'Vermeer'], ['met', 'Rembrandt'], ['met', 'Caravaggio'],
      ['met', 'Turner landscape'], ['met', 'Bierstadt'], ['met', 'Velazquez'],
      ['met', 'Titian'], ['met', 'Goya'], ['met', 'Poussin'], ['met', 'Ruisdael'],
      ['cma', 'baroque'], ['cma', 'Turner'], ['cma', 'landscape romanticism'],
      ['cma', 'Dutch seventeenth century'],
    ],
  },
];

const FETCHERS = { aic: fromAIC, met: fromMet, cma: fromCMA };

const seen = new Set();
const manifest = [];

for (const cat of CATEGORIES) {
  const dir = path.join(OUT, cat.slug);
  await fs.mkdir(dir, { recursive: true });

  const pool = [];
  for (const [source, term] of cat.sources) {
    const items = await FETCHERS[source](term);
    for (const item of items) {
      if (!item.title || seen.has(keyOf(item))) continue;
      if (cat.filter && !cat.filter(item)) continue;
      seen.add(keyOf(item));
      pool.push(item);
    }
    console.log('  ' + cat.slug + ' | ' + source + ' "' + term + '" -> ' + pool.length + ' candidatos');
  }

  // Intercala os museus. Sem isso, quem devolve as dimensoes já na busca
  // (Cleveland) ocupa a cota inteira e o Met, que nao devolve, nunca entra.
  const byMuseum = new Map();
  for (const item of pool) {
    if (!byMuseum.has(item.museum)) byMuseum.set(item.museum, []);
    byMuseum.get(item.museum).push(item);
  }
  const groups = [...byMuseum.values()];
  for (const list of groups) list.sort(rank);

  const queue = [];
  const deepest = Math.max(0, ...groups.map((g) => g.length));
  for (let round = 0; round < deepest; round++) {
    for (const list of groups) if (list[round]) queue.push(list[round]);
  }

  let saved = 0;
  const keep = new Set();
  const perSubject = new Map();
  const MAX_PER_SUBJECT = 3;
  // A chave e o conjunto de termos do titulo, nao o primeiro: so "abraham"
  // fundiria a hospitalidade, o sacrificio e Melquisedeque num episodio so.
  const subjectKey = (title) => {
    const all = [...title.matchAll(new RegExp(cat.dedupeBy.source, 'gi'))];
    return all.length ? all.map((m) => m[0].toLowerCase()).sort().join('+') : null;
  };
  const workers = Array.from({ length: 5 }, async () => {
    while (saved < cat.quota) {
      const item = queue.shift();
      if (!item) break;

      // Reserva a vaga antes do await: os cinco workers competem pela mesma cota.
      let subject = null;
      if (cat.dedupeBy) {
        subject = subjectKey(item.title);
        if (subject) {
          const used = perSubject.get(subject) || 0;
          if (used >= MAX_PER_SUBJECT) continue;
          perSubject.set(subject, used + 1);
        }
      }

      const result = await download(item, dir);
      if (!result) {
        if (subject) perSubject.set(subject, perSubject.get(subject) - 1);
        continue;
      }
      saved++;
      keep.add(path.basename(result.file));
      manifest.push({
        categoria: cat.slug,
        arquivo: path.basename(result.file),
        titulo: item.title,
        artista: item.artist,
        data: item.date,
        museu: item.museum,
        licenca: item.credit,
        fonte: item.pageUrl,
      });
    }
  });
  await Promise.all(workers);

  // Remove sobras de execucoes anteriores que nao passam no filtro atual.
  const onDisk = await fs.readdir(dir);
  for (const name of onDisk) {
    if (keep.has(name)) continue;
    await fs.rm(path.join(dir, name));
    console.log('  descartado: ' + name);
  }

  console.log('OK ' + cat.slug + ': ' + saved + ' obras');
}

await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

const credits = [
  '# Créditos das obras',
  '',
  'Todas as imagens são de domínio público / CC0, obtidas pelas APIs de acesso aberto',
  'do Art Institute of Chicago, do Metropolitan Museum of Art e do Cleveland Museum of Art.',
  '',
  ...['impressionismo', 'biblico', 'classicos'].flatMap((slug) => [
    '## ' + slug,
    '',
    ...manifest
      .filter((m) => m.categoria === slug)
      .map((m) => '- **' + m.titulo + '** — ' + m.artista + (m.data ? ', ' + m.data : '') +
        ' · ' + m.museu + ' · [ficha](' + m.fonte + ')'),
    '',
  ]),
].join('\n');
await fs.writeFile(path.join(OUT, 'CREDITS.md'), credits, 'utf8');

console.log('\nTotal: ' + manifest.length + ' obras em ' + OUT);
