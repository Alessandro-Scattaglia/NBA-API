interface StatsResultSet {
  name?: string;
  headers?: string[];
  rowSet?: unknown[][];
}

interface StatsResponseShape {
  resultSets?: StatsResultSet[] | { name?: string; headers?: string[]; rowSet?: unknown[][] };
  resultSet?: StatsResultSet;
}

export function getResultSet(response: unknown, name?: string) {
  const stats = response as StatsResponseShape;
  const resultSets = stats.resultSets;

  if (Array.isArray(resultSets)) {
    if (name) {
      return resultSets.find((item) => item.name === name) ?? null;
    }

    return resultSets[0] ?? null;
  }

  if (resultSets && !Array.isArray(resultSets)) {
    return resultSets;
  }

  if (stats.resultSet) {
    return stats.resultSet;
  }

  return null;
}

export function mapStatsRows<T extends Record<string, unknown>>(response: unknown, resultSetName?: string): T[] {
  const resultSet = getResultSet(response, resultSetName);
  if (!resultSet?.headers || !resultSet.rowSet) {
    return [];
  }

  return resultSet.rowSet.map((row) =>
    Object.fromEntries(resultSet.headers!.map((header, index) => [header, row[index]])) as T
  );
}

export function mapAllStatsRows<T extends Record<string, unknown>>(response: unknown): T[] {
  const stats = response as StatsResponseShape;
  const resultSets = stats.resultSets;

  if (Array.isArray(resultSets)) {
    return resultSets.flatMap((resultSet) => {
      if (!resultSet.headers || !resultSet.rowSet) {
        return [];
      }

      return resultSet.rowSet.map(
        (row) => Object.fromEntries(resultSet.headers!.map((header, index) => [header, row[index]])) as T
      );
    });
  }

  return mapStatsRows<T>(response);
}
