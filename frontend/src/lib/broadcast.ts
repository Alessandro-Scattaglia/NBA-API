export interface BroadcastLink {
  name: string;
  url: string;
}

const BROADCAST_URLS: Array<[string, string]> = [
  ["prime video", "https://www.primevideo.com/"],
  ["amazon prime", "https://www.primevideo.com/"],
  ["sky sport", "https://sport.sky.it/basket/nba"],
  ["sky", "https://sport.sky.it/basket/nba"]
];

function findBroadcastUrl(name: string) {
  const normalizedName = name.trim().toLowerCase();
  return BROADCAST_URLS.find(([label]) => normalizedName.includes(label))?.[1] ?? null;
}

export function getBroadcastLinks(names: string[]): BroadcastLink[] {
  return names
    .map((name) => {
      const url = findBroadcastUrl(name);
      return url ? { name, url } : null;
    })
    .filter((link): link is BroadcastLink => link !== null)
    .filter((link, index, links) => links.findIndex((item) => item.url === link.url) === index);
}
