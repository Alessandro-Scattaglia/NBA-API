export function buildTeamLogoUrl(teamId: number) {
  return `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`;
}

export function buildPlayerHeadshotUrl(playerId: number) {
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;
}
