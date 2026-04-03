package storage

import (
	"database/sql"
	"encoding/json"
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
		avatar TEXT,
		country TEXT,
		steam_id TEXT,
		cs2_level INTEGER,
		cs2_elo INTEGER,
		cs2_kd TEXT,
		cs2_winrate TEXT,
		cs2_matches TEXT,
		map_stats TEXT,
		recent_matches_analyzed INTEGER,
		recent_avg_kills REAL,
		recent_avg_adr REAL,
		recent_avg_hs REAL,
		recent_avg_kr REAL,
		recent_total_entry INTEGER,
		recent_total_sniper INTEGER,
		recent_history TEXT,
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
	var mapStatsJSON []byte

	if profile.Stats != nil {
		kd = profile.Stats.Lifetime.AverageKD
		winrate = profile.Stats.Lifetime.WinRate
		matches = profile.Stats.Lifetime.Matches
		mapStatsJSON, _ = json.Marshal(profile.Stats.Segments)
	}

	var rMatches, rEntry, rSniper int
	var rKills, rADR, rHS, rKR float64
	var historyJSON []byte

	if profile.Recent != nil {
		rMatches = profile.Recent.MatchesAnalyzed
		rKills = profile.Recent.AvgKills
		rADR = profile.Recent.AvgADR
		rHS = profile.Recent.AvgHSPercentage
		rKR = profile.Recent.AvgKRRatio
		rEntry = profile.Recent.TotalEntryKills
		rSniper = profile.Recent.TotalSniperKills

		var oldHistoryText string
		_ = s.db.QueryRow("SELECT recent_history FROM players WHERE player_id = ?", profile.PlayerID).Scan(&oldHistoryText)

		var combinedHistory []faceit.PlayerMatchStats
		existingMatches := make(map[string]bool)

		if oldHistoryText != "" {
			json.Unmarshal([]byte(oldHistoryText), &combinedHistory)
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

		finalHistory := append(newMatches, combinedHistory...)

		if len(finalHistory) > 1000 {
			finalHistory = finalHistory[:1000]
		}

		profile.Recent.MatchHistory = finalHistory
		historyJSON, _ = json.Marshal(finalHistory)
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

	_, err := s.db.Exec(query, profile.PlayerID, profile.Nickname, profile.Avatar, profile.Country, profile.SteamID, cs2Stats.SkillLevel, cs2Stats.FaceitElo, kd, winrate, matches, string(mapStatsJSON),
		rMatches, rKills, rADR, rHS, rKR, rEntry, rSniper, string(historyJSON))
	return err
}

func (s *Storage) GetPlayer(nickname string) (*faceit.PlayerProfile, error) {
	query := `
	SELECT player_id, nickname, avatar, country, steam_id, cs2_level, cs2_elo, cs2_kd, cs2_winrate, cs2_matches, map_stats,
		recent_matches_analyzed, recent_avg_kills, recent_avg_adr, recent_avg_hs, recent_avg_kr, recent_total_entry, recent_total_sniper, recent_history
	FROM players WHERE nickname = ? AND last_updated >= datetime('now', '-1 hour')`

	row := s.db.QueryRow(query, nickname)

	var p faceit.PlayerProfile
	var cs2Level, cs2Elo int
	var kd, winrate, matches, mapStatsText string
	var rMatches, rEntry, rSniper int
	var rKills, rADR, rHS, rKR float64
	var historyText string

	err := row.Scan(&p.PlayerID, &p.Nickname, &p.Avatar, &p.Country, &p.SteamID, &cs2Level, &cs2Elo, &kd, &winrate, &matches, &mapStatsText,
		&rMatches, &rKills, &rADR, &rHS, &rKR, &rEntry, &rSniper, &historyText)
	if err != nil {
		return nil, err
	}

	p.Games = map[string]faceit.GameInfo{"cs2": {SkillLevel: cs2Level, FaceitElo: cs2Elo}}

	var segments []faceit.Segment
	if mapStatsText != "" {
		json.Unmarshal([]byte(mapStatsText), &segments)
	}
	p.Stats = &faceit.CS2Stats{
		Lifetime: faceit.LifetimeStats{AverageKD: kd, WinRate: winrate, Matches: matches},
		Segments: segments,
	}

	if rMatches > 0 {
		var matchHistory []faceit.PlayerMatchStats
		if historyText != "" {
			json.Unmarshal([]byte(historyText), &matchHistory)
		}
		p.Recent = &faceit.RecentForm{
			MatchesAnalyzed: rMatches, AvgKills: rKills, AvgADR: rADR,
			AvgHSPercentage: rHS, AvgKRRatio: rKR, TotalEntryKills: rEntry, TotalSniperKills: rSniper,
			MatchHistory: matchHistory,
		}
	}

	return &p, nil
}
