package faceit

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"
)

type PlayerProfile struct {
	PlayerID string              `json:"player_id"`
	Nickname string              `json:"nickname"`
	Avatar   string              `json:"avatar"`
	Country  string              `json:"country"`
	SteamID  string              `json:"steam_id_64"`
	Games    map[string]GameInfo `json:"games"`
	Stats    *CS2Stats           `json:"stats,omitempty"`
	Recent   *RecentForm         `json:"recent_form,omitempty"`
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
	MatchId     string      `json:"Match Id"`
	Kills       string      `json:"Kills"`
	Assists     string      `json:"Assists"`
	Deaths      string      `json:"Deaths"`
	ADR         string      `json:"ADR"`
	Headshots   string      `json:"Headshots"`
	HeadshotsPc string      `json:"Headshots %"`
	FirstKills  string      `json:"First Kills"`
	MVPs        string      `json:"MVPs"`
	PentaKills  string      `json:"Penta Kills"`
	QuadroKills string      `json:"Quadro Kills"`
	TripleKills string      `json:"Triple Kills"`
	SniperKills string      `json:"Sniper Kills"`
	KRRatio     string      `json:"K/R Ratio"`
	Result      string      `json:"Result"`
	I10         string      `json:"i10"`
	CreatedAt1  interface{} `json:"created_at"`
	UpdatedAt1  interface{} `json:"updated_at"`
	CreatedAt2  interface{} `json:"Created At"`
	UpdatedAt2  interface{} `json:"Updated At"`
	Map         string      `json:"map"`
	Score       string      `json:"score"`
}

type RecentForm struct {
	MatchesAnalyzed  int                `json:"matches_analyzed"`
	AvgKills         float64            `json:"avg_kills"`
	AvgADR           float64            `json:"avg_adr"`
	AvgHSPercentage  float64            `json:"avg_hs_percentage"`
	AvgKRRatio       float64            `json:"avg_kr_ratio"`
	TotalEntryKills  int                `json:"total_entry_kills"`
	TotalSniperKills int                `json:"total_sniper_kills"`
	MatchHistory     []PlayerMatchStats `json:"match_history"`
}

var httpClient = &http.Client{
	Timeout: 10 * time.Second,
}

func GetPlayerProfile(ctx context.Context, nickname, apiKey string) (*PlayerProfile, error) {
	url := fmt.Sprintf("https://open.faceit.com/data/v4/players?nickname=%s", nickname)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Add("Authorization", "Bearer "+apiKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("помилка API Faceit: статус %d", resp.StatusCode)
	}

	var profile PlayerProfile
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return nil, err
	}

	return &profile, nil
}

func GetCS2Stats(ctx context.Context, playerID, apiKey string) (*CS2Stats, error) {
	url := fmt.Sprintf("https://open.faceit.com/data/v4/players/%s/stats/cs2", playerID)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Add("Authorization", "Bearer "+apiKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("помилка отримання статистики: статус %d", resp.StatusCode)
	}

	var stats CS2Stats
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return nil, err
	}

	return &stats, nil
}

func GetPlayerMatchHistory(ctx context.Context, playerID, apiKey string, limit int, offset int) ([]MatchHistoryItem, error) {
	url := fmt.Sprintf("https://open.faceit.com/data/v4/players/%s/history?game=cs2&offset=%d&limit=%d", playerID, offset, limit)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Add("Authorization", "Bearer "+apiKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("помилка отримання історії матчів: статус %d", resp.StatusCode)
	}

	var historyResponse MatchHistoryResponse
	if err := json.NewDecoder(resp.Body).Decode(&historyResponse); err != nil {
		return nil, err
	}

	return historyResponse.Items, nil
}

func GetMatchStatsForPlayer(ctx context.Context, matchID, targetPlayerID, apiKey string) (*PlayerMatchStats, error) {
	url := fmt.Sprintf("https://open.faceit.com/data/v4/matches/%s/stats", matchID)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Add("Authorization", "Bearer "+apiKey)

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("помилка матчу %s: статус %d", matchID, resp.StatusCode)
	}

	var matchResp MatchStatsResponse
	if err := json.NewDecoder(resp.Body).Decode(&matchResp); err != nil {
		return nil, err
	}

	if len(matchResp.Rounds) == 0 {
		return nil, fmt.Errorf("матч %s не містить раундів", matchID)
	}

	for _, team := range matchResp.Rounds[0].Teams {
		for _, player := range team.Players {
			if player.PlayerID == targetPlayerID {
				player.PlayerStats.Map = matchResp.Rounds[0].RoundStats["Map"]
				player.PlayerStats.Score = matchResp.Rounds[0].RoundStats["Score"]
				player.PlayerStats.MatchId = matchID

				return &player.PlayerStats, nil
			}
		}
	}

	return nil, fmt.Errorf("гравця %s не знайдено в матчі %s", targetPlayerID, matchID)
}

func CalculateStatsFromHistory(formHistory []PlayerMatchStats) *RecentForm {
	if len(formHistory) == 0 {
		return nil
	}

	var totalKills, totalADR, totalHS, totalKR float64
	var totalEntry, totalSniper int
	var successfulMatches = len(formHistory)

	for _, stats := range formHistory {
		if val, err := strconv.ParseFloat(stats.Kills, 64); err == nil {
			totalKills += val
		}
		if val, err := strconv.ParseFloat(stats.ADR, 64); err == nil {
			totalADR += val
		}
		if val, err := strconv.ParseFloat(stats.HeadshotsPc, 64); err == nil {
			totalHS += val
		}
		if val, err := strconv.ParseFloat(stats.KRRatio, 64); err == nil {
			totalKR += val
		}
		if val, err := strconv.Atoi(stats.FirstKills); err == nil {
			totalEntry += val
		}
		if val, err := strconv.Atoi(stats.SniperKills); err == nil {
			totalSniper += val
		}
	}

	return &RecentForm{
		MatchesAnalyzed:  successfulMatches,
		AvgKills:         totalKills / float64(successfulMatches),
		AvgADR:           totalADR / float64(successfulMatches),
		AvgHSPercentage:  totalHS / float64(successfulMatches),
		AvgKRRatio:       totalKR / float64(successfulMatches),
		TotalEntryKills:  totalEntry,
		TotalSniperKills: totalSniper,
		MatchHistory:     formHistory,
	}
}

func CalculateRecentForm(ctx context.Context, playerID, apiKey string, limit int, offset int) (*RecentForm, error) {
	matchItems, err := GetPlayerMatchHistory(ctx, playerID, apiKey, limit, offset)
	if err != nil {
		return nil, err
	}

	if len(matchItems) == 0 {
		return nil, fmt.Errorf("у гравця немає зіграних матчів")
	}

	type matchJob struct {
		index int
		item  MatchHistoryItem
	}
	type matchResult struct {
		index int
		stats *PlayerMatchStats
		err   error
	}

	jobs := make(chan matchJob, len(matchItems))
	results := make(chan matchResult, len(matchItems))

	var wg sync.WaitGroup
	const numWorkers = 4

	for w := 1; w <= numWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for job := range jobs {
				// 🔥 Throttling: мікро-затримка, щоб не отримати бан від Faceit (HTTP 429)
				// 50 мілісекунд * 4 воркера = плавне викачування без перевантаження API
				time.Sleep(50 * time.Millisecond)

				stats, err := GetMatchStatsForPlayer(ctx, job.item.MatchID, playerID, apiKey)

				if err == nil && stats != nil {
					stats.CreatedAt1 = job.item.StartedAt
				}

				results <- matchResult{index: job.index, stats: stats, err: err}
			}
		}()
	}

	for i, item := range matchItems {
		jobs <- matchJob{index: i, item: item}
	}
	close(jobs)

	go func() {
		wg.Wait()
		close(results)
	}()

	orderedHistory := make([]*PlayerMatchStats, len(matchItems))
	for res := range results {
		if res.err == nil && res.stats != nil {
			orderedHistory[res.index] = res.stats
		}
	}

	var formHistory []PlayerMatchStats
	for _, stats := range orderedHistory {
		if stats == nil {
			continue
		}
		formHistory = append(formHistory, *stats)
	}

	if len(formHistory) == 0 {
		return nil, fmt.Errorf("не вдалося проаналізувати жодного матчу")
	}

	return CalculateStatsFromHistory(formHistory), nil
}
