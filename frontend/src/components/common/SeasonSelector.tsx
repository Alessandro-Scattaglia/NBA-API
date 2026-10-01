interface SeasonSelectorProps {
  seasons: string[];
  value: string;
  currentSeason: string;
  onChange: (value: string) => void;
}

export function SeasonSelector({ seasons, value, currentSeason, onChange }: SeasonSelectorProps) {
  const safeSeasons = seasons.length > 0 ? seasons : [currentSeason];

  return (
    <div className="season-selector" aria-label="Selezione stagione">
      <label htmlFor="season-select" className="season-selector-label">
        Stagione
      </label>
      <select
        id="season-select"
        className="season-selector-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {safeSeasons.map((season) => (
          <option key={season} value={season}>
            {season}
          </option>
        ))}
      </select>
      <button type="button" className="season-selector-reset" onClick={() => onChange(currentSeason)}>
        Torna alla stagione corrente
      </button>
    </div>
  );
}
