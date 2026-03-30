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

	query := `
	INSERT INTO players (player_id, nickname, cs2_level, cs2_elo)
	VALUES (?, ?, ?, ?)
	ON CONFLICT(player_id) DO UPDATE SET
		nickname = excluded.nickname,
		cs2_level = excluded.cs2_level,
		cs2_elo = excluded.cs2_elo,
		last_updated = CURRENT_TIMESTAMP;`

	_, err := s.db.Exec(query, profile.PlayerID, profile.Nickname, cs2Stats.SkillLevel, cs2Stats.FaceitElo)
	return err
}

func (s *Storage) GetPlayer(nickname string) (*faceit.PlayerProfile, error) {
	query := `
	SELECT player_id, nickname, cs2_level, cs2_elo 
	FROM players 
	WHERE nickname = ? AND last_updated >= datetime('now', '-1 hour')`

	row := s.db.QueryRow(query, nickname)

	var profile faceit.PlayerProfile
	var cs2Level, cs2Elo int

	err := row.Scan(&profile.PlayerID, &profile.Nickname, &cs2Level, &cs2Elo)
	if err != nil {
		return nil, err
	}

	profile.Games = map[string]faceit.GameInfo{
		"cs2": {
			SkillLevel: cs2Level,
			FaceitElo:  cs2Elo,
		},
	}

	return &profile, nil
}
