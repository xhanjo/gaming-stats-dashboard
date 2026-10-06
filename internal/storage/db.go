package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/xhanjo/gaming-stats-dashboard/internal/faceit"
	_ "modernc.org/sqlite"
)

const maxHistorySize = faceit.MaxHistorySize

type Storage struct {
	db *sql.DB
}

func New(dbPath string) (*Storage, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	// SQLite краще працює з одним writer з'єднанням
	db.SetMaxOpenConns(1)

	// Обов'язкові PRAGMA для конкурентного доступу
	pragmas := []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA busy_timeout=5000",
		"PRAGMA synchronous=NORMAL",
		"PRAGMA foreign_keys=ON",
	}
	for _, p := range pragmas {
		if _, err := db.Exec(p); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("exec %q: %w", p, err)
		}
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}
	return &Storage{db: db}, nil
}

func (s *Storage) Close() error {
	return s.db.Close()
}

func (s *Storage) InitTable(ctx context.Context) error {
	query := `
	CREATE TABLE IF NOT EXISTS players (
		player_id TEXT PRIMARY KEY,
		nickname TEXT UNIQUE NOT NULL,
		avatar TEXT DEFAULT '' NOT NULL,
		country TEXT DEFAULT '' NOT NULL,
		steam_id TEXT DEFAULT '' NOT NULL,
		cs2_level INTEGER DEFAULT 0 NOT NULL,
		cs2_elo INTEGER DEFAULT 0 NOT NULL,
		cs2_kd TEXT DEFAULT '' NOT NULL,
		cs2_winrate TEXT DEFAULT '' NOT NULL,
		cs2_matches TEXT DEFAULT '' NOT NULL,
		map_stats TEXT DEFAULT '' NOT NULL,
		recent_matches_analyzed INTEGER DEFAULT 0 NOT NULL,
		recent_avg_kills REAL DEFAULT 0 NOT NULL,
		recent_avg_adr REAL DEFAULT 0 NOT NULL,
		recent_avg_hs REAL DEFAULT 0 NOT NULL,
		recent_avg_kr REAL DEFAULT 0 NOT NULL,
		recent_total_entry INTEGER DEFAULT 0 NOT NULL,
		recent_total_sniper INTEGER DEFAULT 0 NOT NULL,
		recent_history TEXT DEFAULT '' NOT NULL,
		last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	if _, err := s.db.ExecContext(ctx, query); err != nil {
		return fmt.Errorf("create table: %w", err)
	}
	return nil
}

func (s *Storage) SavePlayer(ctx context.Context, profile *faceit.PlayerProfile) error {
	cs2Stats, ok := profile.Games["cs2"]
	if !ok {
		return fmt.Errorf("player %s has no CS2 stats", profile.Nickname)
	}

	kd, winrate, matches := "", "", ""
	var mapStatsJSON []byte

	if profile.Stats != nil {
		kd = profile.Stats.Lifetime.AverageKD
		winrate = profile.Stats.Lifetime.WinRate
		matches = profile.Stats.Lifetime.Matches
		var marshalErr error
		mapStatsJSON, marshalErr = json.Marshal(profile.Stats.Segments)
		if marshalErr != nil {
			return fmt.Errorf("marshal map stats: %w", marshalErr)
		}
	}

	var rMatches, rEntry, rSniper int
	var rKills, rADR, rHS, rKR float64
	var historyJSON []byte

	// Атомарний read-modify-write через транзакцію
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	if profile.Recent != nil {
		rMatches = profile.Recent.MatchesAnalyzed
		rKills = profile.Recent.AvgKills
		rADR = profile.Recent.AvgADR
		rHS = profile.Recent.AvgHSPercentage
		rKR = profile.Recent.AvgKRRatio
		rEntry = profile.Recent.TotalEntryKills
		rSniper = profile.Recent.TotalSniperKills

		var oldHistoryText string
		readErr := tx.QueryRowContext(ctx, "SELECT COALESCE(recent_history, '') FROM players WHERE player_id = ?", profile.PlayerID).Scan(&oldHistoryText)
		if readErr != nil && readErr != sql.ErrNoRows {
			return fmt.Errorf("read history: %w", readErr)
		}

		var combinedHistory []faceit.PlayerMatchStats
		existingMatches := make(map[string]bool)

		if oldHistoryText != "" {
			if unmarshalErr := json.Unmarshal([]byte(oldHistoryText), &combinedHistory); unmarshalErr != nil {
				log.Printf("WARN: corrupt recent_history for %s: %v", profile.Nickname, unmarshalErr)
				combinedHistory = nil
			}
			for _, m := range combinedHistory {
				if m.MatchId != "" {
					existingMatches[m.MatchId] = true
				}
			}
		}

		var newMatches []faceit.PlayerMatchStats
		for _, m := range profile.Recent.MatchHistory {
			if m.MatchId != "" && !existingMatches[m.MatchId] {
				newMatches = append(newMatches, m)
				existingMatches[m.MatchId] = true
			} else if m.MatchId == "" {
				newMatches = append(newMatches, m)
			}
		}

		finalHistory := make([]faceit.PlayerMatchStats, 0, len(newMatches)+len(combinedHistory))
		finalHistory = append(finalHistory, newMatches...)
		finalHistory = append(finalHistory, combinedHistory...)

		// Гарантуємо хронологічний порядок від найновішого до найстарішого
		faceit.SortMatchesDescending(finalHistory)

		if len(finalHistory) > maxHistorySize {
			finalHistory = finalHistory[:maxHistorySize]
		}

		if len(finalHistory) > 0 {
			profile.Recent = faceit.CalculateStatsFromHistory(finalHistory, cs2Stats.FaceitElo)
		}

		if profile.Recent != nil {
			rMatches = profile.Recent.MatchesAnalyzed
			rKills = profile.Recent.AvgKills
			rADR = profile.Recent.AvgADR
			rHS = profile.Recent.AvgHSPercentage
			rKR = profile.Recent.AvgKRRatio
			rEntry = profile.Recent.TotalEntryKills
			rSniper = profile.Recent.TotalSniperKills
		}

		var marshalErr error
		historyJSON, marshalErr = json.Marshal(finalHistory)
		if marshalErr != nil {
			return fmt.Errorf("marshal history: %w", marshalErr)
		}
	}

	query := `
	INSERT INTO players (
		player_id, nickname, avatar, country, steam_id, cs2_level, cs2_elo, cs2_kd, cs2_winrate, cs2_matches, map_stats,
		recent_matches_analyzed, recent_avg_kills, recent_avg_adr, recent_avg_hs, recent_avg_kr, recent_total_entry, recent_total_sniper, recent_history
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(player_id) DO UPDATE SET
		nickname = excluded.nickname, avatar = excluded.avatar, country = excluded.country, steam_id = excluded.steam_id,
		cs2_level = excluded.cs2_level, cs2_elo = excluded.cs2_elo,
		cs2_kd = excluded.cs2_kd, cs2_winrate = excluded.cs2_winrate, cs2_matches = excluded.cs2_matches, map_stats = excluded.map_stats,
		recent_matches_analyzed = excluded.recent_matches_analyzed, recent_avg_kills = excluded.recent_avg_kills,
		recent_avg_adr = excluded.recent_avg_adr, recent_avg_hs = excluded.recent_avg_hs, recent_avg_kr = excluded.recent_avg_kr,
		recent_total_entry = excluded.recent_total_entry, recent_total_sniper = excluded.recent_total_sniper,
		recent_history = excluded.recent_history,
		last_updated = CURRENT_TIMESTAMP;`

	_, err = tx.ExecContext(ctx, query, profile.PlayerID, profile.Nickname, profile.Avatar, profile.Country, profile.SteamID, cs2Stats.SkillLevel, cs2Stats.FaceitElo, kd, winrate, matches, string(mapStatsJSON),
		rMatches, rKills, rADR, rHS, rKR, rEntry, rSniper, string(historyJSON))
	if err != nil {
		return fmt.Errorf("upsert player: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit player: %w", err)
	}
	profile.LastUpdated = time.Now().UTC()
	return nil
}

func (s *Storage) GetPlayer(ctx context.Context, nickname string) (*faceit.PlayerProfile, error) {
	query := `
	SELECT player_id, nickname,
		COALESCE(avatar, ''), COALESCE(country, ''), COALESCE(steam_id, ''),
		COALESCE(cs2_level, 0), COALESCE(cs2_elo, 0),
		COALESCE(cs2_kd, ''), COALESCE(cs2_winrate, ''), COALESCE(cs2_matches, ''), COALESCE(map_stats, ''),
		COALESCE(recent_matches_analyzed, 0), COALESCE(recent_avg_kills, 0), COALESCE(recent_avg_adr, 0),
		COALESCE(recent_avg_hs, 0), COALESCE(recent_avg_kr, 0), COALESCE(recent_total_entry, 0), COALESCE(recent_total_sniper, 0),
		COALESCE(recent_history, ''),
		last_updated
	FROM players WHERE nickname = ? COLLATE NOCASE`

	row := s.db.QueryRowContext(ctx, query, nickname)

	var p faceit.PlayerProfile
	var cs2Level, cs2Elo int
	var kd, winrate, matches, mapStatsText string
	var rMatches, rEntry, rSniper int
	var rKills, rADR, rHS, rKR float64
	var historyText string
	var lastUpdatedStr sql.NullString

	err := row.Scan(&p.PlayerID, &p.Nickname, &p.Avatar, &p.Country, &p.SteamID, &cs2Level, &cs2Elo, &kd, &winrate, &matches, &mapStatsText,
		&rMatches, &rKills, &rADR, &rHS, &rKR, &rEntry, &rSniper, &historyText, &lastUpdatedStr)
	if err != nil {
		return nil, err
	}

	if lastUpdatedStr.Valid && lastUpdatedStr.String != "" {
		for _, layout := range []string{"2006-01-02 15:04:05", time.RFC3339, "2006-01-02T15:04:05Z"} {
			if t, parseErr := time.Parse(layout, lastUpdatedStr.String); parseErr == nil {
				p.LastUpdated = t
				break
			}
		}
	}

	p.Games = map[string]faceit.GameInfo{"cs2": {SkillLevel: cs2Level, FaceitElo: cs2Elo}}

	var segments []faceit.Segment
	if mapStatsText != "" {
		if unmarshalErr := json.Unmarshal([]byte(mapStatsText), &segments); unmarshalErr != nil {
			log.Printf("WARN: corrupt map_stats for %s: %v", p.Nickname, unmarshalErr)
		}
	}
	p.Stats = &faceit.CS2Stats{
		Lifetime: faceit.LifetimeStats{AverageKD: kd, WinRate: winrate, Matches: matches},
		Segments: segments,
	}

	if rMatches > 0 || historyText != "" {
		var matchHistory []faceit.PlayerMatchStats
		if historyText != "" {
			if unmarshalErr := json.Unmarshal([]byte(historyText), &matchHistory); unmarshalErr != nil {
				log.Printf("WARN: corrupt recent_history for %s: %v", p.Nickname, unmarshalErr)
			}
		}
		if len(matchHistory) > 0 {
			faceit.SortMatchesDescending(matchHistory)
			p.Recent = faceit.CalculateStatsFromHistory(matchHistory, cs2Elo)
		}
		if p.Recent == nil && rMatches > 0 {
			p.Recent = &faceit.RecentForm{
				MatchesAnalyzed: rMatches, AvgKills: rKills, AvgADR: rADR,
				AvgHSPercentage: rHS, AvgKRRatio: rKR, TotalEntryKills: rEntry, TotalSniperKills: rSniper,
				MatchHistory: matchHistory,
			}
		}
	}

	return &p, nil
}
