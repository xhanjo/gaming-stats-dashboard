package faceit

import "time"

const MaxHistorySize = 1000

type PlayerProfile struct {
	PlayerID    string              `json:"player_id"`
	Nickname    string              `json:"nickname"`
	Avatar      string              `json:"avatar"`
	Country     string              `json:"country"`
	SteamID     string              `json:"steam_id_64"`
	Games       map[string]GameInfo `json:"games"`
	Stats       *CS2Stats           `json:"stats,omitempty"`
	Recent      *RecentForm         `json:"recent_form,omitempty"`
	LastUpdated time.Time           `json:"last_updated,omitempty"`
}

type GameInfo struct {
	SkillLevel int `json:"skill_level"`
	FaceitElo  int `json:"faceit_elo"`
}

type Segment struct {
	Type  string            `json:"type"`
	Mode  string            `json:"mode"`
	Label string            `json:"label"`
	Stats map[string]string `json:"stats"`
}

type CS2Stats struct {
	Lifetime LifetimeStats `json:"lifetime"`
	Segments []Segment     `json:"segments"`
}

type LifetimeStats struct {
	AverageKD string `json:"Average K/D Ratio"`
	WinRate   string `json:"Win Rate %"`
	Matches   string `json:"Matches"`
}

type MatchHistoryResponse struct {
	Items []MatchHistoryItem `json:"items"`
}

type MatchHistoryItem struct {
	MatchID   string `json:"match_id"`
	StartedAt int64  `json:"started_at"`
}

type MatchStatsResponse struct {
	Rounds []MatchRound `json:"rounds"`
}

type MatchRound struct {
	Teams      []MatchTeam       `json:"teams"`
	RoundStats map[string]string `json:"round_stats"`
}

type MatchTeam struct {
	Players []MatchPlayer `json:"players"`
}

type MatchPlayer struct {
	PlayerID    string           `json:"player_id"`
	Nickname    string           `json:"nickname"`
	PlayerStats PlayerMatchStats `json:"player_stats"`
}

type PlayerMatchStats struct {
	MatchId     string `json:"Match Id"`
	Kills       string `json:"Kills"`
	Assists     string `json:"Assists"`
	Deaths      string `json:"Deaths"`
	ADR         string `json:"ADR"`
	Headshots   string `json:"Headshots"`
	HeadshotsPc string `json:"Headshots %"`
	FirstKills  string `json:"First Kills"`
	MVPs        string `json:"MVPs"`
	PentaKills  string `json:"Penta Kills"`
	QuadroKills string `json:"Quadro Kills"`
	TripleKills string `json:"Triple Kills"`
	SniperKills string `json:"Sniper Kills"`
	KRRatio     string `json:"K/R Ratio"`
	Result      string `json:"Result"`
	I10         string `json:"i10"`
	CreatedAt1  any    `json:"created_at"`
	UpdatedAt1  any    `json:"updated_at"`
	CreatedAt2  any    `json:"Created At"`
	UpdatedAt2  any    `json:"Updated At"`
	Map         string `json:"map"`
	Score       string `json:"score"`
}

type RecentForm struct {
	MatchesAnalyzed  int                 `json:"matches_analyzed"`
	AvgKills         float64             `json:"avg_kills"`
	AvgADR           float64             `json:"avg_adr"`
	AvgHSPercentage  float64             `json:"avg_hs_percentage"`
	AvgKRRatio       float64             `json:"avg_kr_ratio"`
	TotalEntryKills  int                 `json:"total_entry_kills"`
	TotalSniperKills int                 `json:"total_sniper_kills"`
	PlaystyleRole    string              `json:"playstyle_role"`
	PredictedElo     int                 `json:"predicted_elo"`
	EloTrend         float64             `json:"elo_trend"`
	Analytics        *AnalyticsReport    `json:"analytics,omitempty"`
	Activity         *PlayActivityReport `json:"activity,omitempty"`
	MatchHistory     []PlayerMatchStats  `json:"match_history"`
}
