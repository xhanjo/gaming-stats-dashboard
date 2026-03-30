package storage

import (
	"database/sql"
	"fmt"

	"github.com/xhanjo/gaming-stats-dashboard/internal/faceit"
	_ "modernc.org/sqlite"
)

type Storage struct {
	db *sql.DB
}

func New(dbPath string) (*Storage, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	return &Storage{db: db}, nil
}

func (s *Storage) InitTable() error {
	query := `
	CREATE TABLE IF NOT EXISTS players (
		player_id TEXT PRIMARY KEY,
		nickname TEXT UNIQUE NOT NULL,
		cs2_level INTEGER,
		cs2_elo INTEGER,
		cs2_kd TEXT,
		cs2_winrate TEXT,
		cs2_matches TEXT,
		last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	_, err := s.db.Exec(query)
	if err != nil {
		return fmt.Errorf("помилка створення таблиці: %v", err)
	}

	return nil
}

func (s *Storage) SavePlayer(profile *faceit.PlayerProfile) error {
	cs2Stats, ok := profile.Games["cs2"]
	if !ok {
		return fmt.Errorf("гравець %s не має статистики CS2", profile.Nickname)
	}

	kd, winrate, matches := "", "", ""
	if profile.Stats != nil {
		kd = profile.Stats.Lifetime.AverageKD
		winrate = profile.Stats.Lifetime.WinRate
		matches = profile.Stats.Lifetime.Matches
	}

	query := `
	INSERT INTO players (player_id, nickname, cs2_level, cs2_elo, cs2_kd, cs2_winrate, cs2_matches)
	VALUES (?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(player_id) DO UPDATE SET
		nickname = excluded.nickname,
		cs2_level = excluded.cs2_level,
		cs2_elo = excluded.cs2_elo,
		cs2_kd = excluded.cs2_kd,
		cs2_winrate = excluded.cs2_winrate,
		cs2_matches = excluded.cs2_matches,
		last_updated = CURRENT_TIMESTAMP;`

	_, err := s.db.Exec(query, profile.PlayerID, profile.Nickname, cs2Stats.SkillLevel, cs2Stats.FaceitElo, kd, winrate, matches)
	return err
}

func (s *Storage) GetPlayer(nickname string) (*faceit.PlayerProfile, error) {
	query := `
	SELECT player_id, nickname, cs2_level, cs2_elo, cs2_kd, cs2_winrate, cs2_matches 
	FROM players 
	WHERE nickname = ? AND last_updated >= datetime('now', '-1 hour')`

	row := s.db.QueryRow(query, nickname)

	var profile faceit.PlayerProfile
	var cs2Level, cs2Elo int
	var kd, winrate, matches string

	err := row.Scan(&profile.PlayerID, &profile.Nickname, &cs2Level, &cs2Elo, &kd, &winrate, &matches)
	if err != nil {
		return nil, err
	}

	profile.Games = map[string]faceit.GameInfo{
		"cs2": {
			SkillLevel: cs2Level,
			FaceitElo:  cs2Elo,
		},
	}

	// Відновлюємо розширену статистику
	profile.Stats = &faceit.CS2Stats{
		Lifetime: faceit.LifetimeStats{
			AverageKD: kd,
			WinRate:   winrate,
			Matches:   matches,
		},
	}

	return &profile, nil
}
