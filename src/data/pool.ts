/**
 * Hand-picked hikipedia articles, every one verified to exist and to be long
 * enough to have outgoing links. Used as the fallback pool for the dice and as
 * suggestions before the player has typed anything.
 */
export const CURATED: string[] = [
  'Urho Kaleva Kekkonen',
  'Suomi',
  'Sauna',
  'Salmiakki',
  'Nokia',
  'Tappara',
  'Helsinki',
  'Tampere',
  'Turku',
  'Oulu',
  'Matti Nykänen',
  'Mämmi',
  'Kalevala',
  'Jokerit',
  'Juice Leskinen',
  'Jääkiekko',
  'Pesäpallo',
  'Joulupukki',
  'Muumit',
  'Kalja',
  'Talvisota',
  'Carl Gustaf Emil Mannerheim',
  'Lordi',
  'Mökkeily',
  'Kesämökki',
  'Poro',
  'Sonni',
  'Ruotsi',
  'Venäjä',
  'Viro',
  'Jari Litmanen',
  'Teemu Selänne',
  'Kimi Räikkönen',
  'Internet',
  'Seth Silander',
]

export function randomFromPool(exclude?: string): string {
  const pool = exclude
    ? CURATED.filter((t) => t.toLowerCase() !== exclude.toLowerCase())
    : CURATED
  return pool[Math.floor(Math.random() * pool.length)]
}
