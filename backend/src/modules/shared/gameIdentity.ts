export interface GameIdentity {
  canonicalGameId: string;
  nbaGameId: string | null;
  espnEventId: string | null;
  date: string;
  homeCode: string;
  awayCode: string;
}

const identities = new Map<string, GameIdentity>();

export function canonicalGameId(date: string, homeCode: string, awayCode: string) {
  return `game:${date.slice(0, 10)}:${awayCode}:${homeCode}`;
}

export function registerGameIdentity(identity: GameIdentity) {
  const current = identities.get(identity.canonicalGameId);
  identities.set(identity.canonicalGameId, {
    ...current,
    ...identity,
    nbaGameId: identity.nbaGameId ?? current?.nbaGameId ?? null,
    espnEventId: identity.espnEventId ?? current?.espnEventId ?? null
  });
}

export function getGameIdentity(canonicalGameIdValue: string) {
  return identities.get(canonicalGameIdValue) ?? null;
}

export function parseCanonicalGameId(gameId: string) {
  const match = gameId.match(/^game:(\d{4}-\d{2}-\d{2}):([A-Z0-9]+):([A-Z0-9]+)$/);
  return match ? { date: match[1], awayCode: match[2], homeCode: match[3] } : null;
}

export function resolveGameIdentity(gameId: string): Pick<GameIdentity, "nbaGameId" | "espnEventId"> {
  if (gameId.startsWith("game:")) {
    const identity = getGameIdentity(gameId);
    return {
      nbaGameId: identity?.nbaGameId ?? null,
      espnEventId: identity?.espnEventId ?? null
    };
  }

  const knownIdentity = [...identities.values()].find(
    (identity) => identity.espnEventId === gameId || identity.nbaGameId === gameId
  );
  if (knownIdentity?.espnEventId === gameId) {
    return { nbaGameId: knownIdentity.nbaGameId, espnEventId: gameId };
  }

  if (knownIdentity?.nbaGameId === gameId) {
    return { nbaGameId: gameId, espnEventId: knownIdentity.espnEventId };
  }

  return { nbaGameId: gameId, espnEventId: null };
}
