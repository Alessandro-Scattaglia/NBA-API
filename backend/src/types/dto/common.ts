export type Conference = "East" | "West";
export type PlayoffStatus = "playoff" | "play-in" | "eliminated" | "in-the-hunt";
export type GameStatus = "scheduled" | "live" | "final";
export type GamePhase = "preseason" | "regular-season" | "play-in" | "playoffs" | "other";
export type GameDataAvailabilityStatus = "available" | "scheduled" | "pending";

export interface ApiEnvelope<T> {
  data: T;
  meta: {
    updatedAt: string;
    stale: boolean;
    source: string[];
  };
}
