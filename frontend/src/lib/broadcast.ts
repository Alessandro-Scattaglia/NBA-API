export interface BroadcastLink {
  name: string;
  url: string;
}

const BROADCAST_URLS: Array<[string, string]> = [
  ["prime video", "https://www.primevideo.com/"],
  ["amazon prime", "https://www.primevideo.com/"],
  ["sky sport", "https://sport.sky.it/basket/nba"],
  ["sky", "https://sport.sky.it/basket/nba"],
  ["dazn", "https://www.dazn.com/"],
  ["nba tv", "https://www.nba.com/watch"],
  ["league pass", "https://www.nba.com/watch/league-pass"],
  ["espn+", "https://www.espn.com/watch/"],
  ["espn", "https://www.espn.com/watch/"],
  ["abc", "https://abc.com/watch-live"],
  ["tnt", "https://www.tntdrama.com/watchtnt"],
  ["peacock", "https://www.peacocktv.com/sports"],
  ["nbc", "https://www.nbc.com/live"],
  ["ncaa", "https://www.ncaa.com/"],
  ["youtube tv", "https://tv.youtube.com/"]
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
