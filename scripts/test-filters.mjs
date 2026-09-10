import fs from 'node:fs';

const src = fs.readFileSync('scripts/fetch-art.mjs', 'utf8');
const grab = (name) => eval(src.match(new RegExp('const ' + name + ' =\\s*(/.*?/i?);', 's'))[1]);

const SUBJECT = grab('REFORMED_SUBJECT');
const BLOCKS = ['DEPICTS_CHRIST', 'APOCRYPHAL', 'OTHER_TRADITION', 'NOT_A_TABLEAU',
  'CATHOLIC_DEVOTION', 'PERSONAL_PORTRAIT'].map(grab);

const ok = (t) => SUBJECT.test(t) && !BLOCKS.some((re) => re.test(t));

const rejeitar = [
  'A woman mistakes a cow for the Angel of Death, from a Lights of Canopus (Anwar-i Suhaili) of Kashifi',
  'Angel (Peri) Riding a Composite Camel',
  'Angel Playing a Lute',
  'Angel',
  'The Ascent of the Prophet to Heaven, Page from the Khamsa of Nizami',
  'Zulaykha in her palace and as an elderly woman with Joseph (recto), from a Panj Ganj',
  'Moses Seymour Jr.',
  'Portrait of Jean Terford David',
  'Portraits of Jean Terford David and Mary Sicard David',
  'Pinnacle with Angel',
  'Prophet in a Historiated Initial O from a Gradual',
  'The Annunciation in a Historiated Initial M from an Antiphonary',
  'Study of Ignudo in Sistine Chapel, Rome',
  'Sketch for The Four Prophets of Israel',
  'Ceiling Decoration with Four Fathers of the Church, Sibyls and Prophets',
  'The Virgin Crowned by Angels',
  'Saint Peter and a Donor (recto); Saint Thomas (verso)',
  'Prophet',
  'Listening Angel',
  'The Crucifixion',
  'Madonna and Child',
  'Judith and Holofernes',
  'The Holy Family',
  'The Baptism of Christ',
  'The Trinity',
  'Rest on the Flight into Egypt',
  'The Adoration of the Magi',
  'Daniel Hubbard',
  'Mrs. Daniel Hubbard (Mary Greene)',
  'Noah Smith',
  'Hermine David',
  'Jeremiah Belknap',
  'Amédée-David, the Comte de Pastoret',
  'To Esther (Valentine)',
  'Moses Seymour Jr.',
  'David Garrick as King Lear',
  'Noah’s Sacrifice, plate IX from The Creation and Early History of Man',
];

const aceitar = [
  'Abraham and Isaac',
  'The Sacrifice of Isaac',
  'Adam and Eve in Paradise',
  'Expulsion of Adam and Eve',
  'Lot and his Daughters',
  'Three Angels Appearing to Abraham',
  'The Oath of Abraham\u2019s Servant',
  'Moses Striding to the Left, Pointing with Left Hand',
  'The Annunciation',
  'Belshazzar\u2019s Feast',
  'Daniel in the Lions Den',
  'The Return of the Prodigal Son',
  'Esther before Ahasuerus',
  'Jacob Wrestling with the Angel',
  'Samson and Delilah',
  'David Oh, that I had wings like a Dove! Psalm 55',
  'The Judgment of Solomon',
  'Joseph Interpreting the Dreams',
  'Elijah Fed by the Ravens',
  'Hagar and Ishmael in the Wilderness',
  'Noah',
  'Moses Striding to the Left, Pointing with Left Hand',
  'Samson Killing a Philistine',
  'King Solomon Receiving the Queen of Sheba',
  'Lot and His Family Led Out of Sodom',
  'Conversion of Saint Paul',
  'Return of the Prodigal Son',
  'Esther, Ahasuerus, and Haman',
  'David with the Head of Goliath',
];

let erros = 0;
for (const t of rejeitar) if (ok(t)) { console.log('FALSO POSITIVO:', t); erros++; }
for (const t of aceitar) if (!ok(t)) { console.log('FALSO NEGATIVO:', t); erros++; }
console.log(erros === 0
  ? 'todos os ' + (rejeitar.length + aceitar.length) + ' casos ok'
  : erros + ' erro(s) de ' + (rejeitar.length + aceitar.length));
