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

const (
	httpClientTimeout     = 10 * time.Second
	maxRetries            = 3
	retryBaseWait         = 500 * time.Millisecond
	matchHistoryBatchSize = 100
	batchDelay            = 200 * time.Millisecond
	numWorkers            = 5
	workerThrottle        = 150 * time.Millisecond
	eloChangePerMatch     = 25
)

var httpClient = &http.Client{
	Timeout: httpClientTimeout,
}

// doFaceitRequest виконує GET-запит до FACEIT API з retry та exponential backoff для 429.
func doFaceitRequest(ctx context.Context, url, apiKey string, result interface{}) error {
	for attempt := 0; attempt <= maxRetries; attempt++ {
		req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
		if err != nil {
			return fmt.Errorf("create request: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)

		resp, err := httpClient.Do(req)
		if err != nil {
			return fmt.Errorf("http request: %w", err)
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()
			if attempt == maxRetries {
				return fmt.Errorf("FACEIT API rate limited after %d retries", maxRetries)
			}
			wait := retryBaseWait * time.Duration(1<<attempt)
			select {
			case <-time.After(wait):
				continue
			case <-ctx.Done():
				return ctx.Err()
			}
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return fmt.Errorf("FACEIT API: status %d", resp.StatusCode)
		}

		defer resp.Body.Close()
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return fmt.Errorf("FACEIT API: exhausted retries")
}

func GetPlayerProfile(ctx context.Context, nickname, apiKey string) (*PlayerProfile, error) {
	url := fmt.Sprintf("https://open.faceit.com/data/v4/players?nickname=%s", nickname)

	var profile PlayerProfile
	if err := doFaceitRequest(ctx, url, apiKey, &profile); err != nil {
		return nil, fmt.Errorf("get player profile: %w", err)
	}
	return &profile, nil
}

func GetCS2Stats(ctx context.Context, playerID, apiKey string) (*CS2Stats, error) {
	url := fmt.Sprintf("https://open.faceit.com/data/v4/players/%s/stats/cs2", playerID)

	var stats CS2Stats
	if err := doFaceitRequest(ctx, url, apiKey, &stats); err != nil {
		return nil, fmt.Errorf("get cs2 stats: %w", err)
	}
	return &stats, nil
}

func GetPlayerMatchHistory(ctx context.Context, playerID, apiKey string, limit int) ([]MatchHistoryItem, error) {
	var allItems []MatchHistoryItem

	for offset := 0; offset < limit; offset += matchHistoryBatchSize {
		if offset > 0 {
			select {
			case <-time.After(batchDelay):
			case <-ctx.Done():
				return allItems, ctx.Err()
			}
		}

		fetchSize := matchHistoryBatchSize
		if limit-offset < matchHistoryBatchSize {
			fetchSize = limit - offset
		}

		url := fmt.Sprintf("https://open.faceit.com/data/v4/players/%s/history?game=cs2&offset=%d&limit=%d", playerID, offset, fetchSize)

		var historyResponse MatchHistoryResponse
		if err := doFaceitRequest(ctx, url, apiKey, &historyResponse); err != nil {
			if len(allItems) > 0 {
				break // повертаємо часткові результати
			}
			return nil, fmt.Errorf("match history: %w", err)
		}

		allItems = append(allItems, historyResponse.Items...)

		if len(historyResponse.Items) < fetchSize {
			break
		}
	}

	return allItems, nil
}

func GetMatchStatsForPlayer(ctx context.Context, matchID, targetPlayerID, apiKey string) (*PlayerMatchStats, error) {
	url := fmt.Sprintf("https://open.faceit.com/data/v4/matches/%s/stats", matchID)

	var matchResp MatchStatsResponse
	if err := doFaceitRequest(ctx, url, apiKey, &matchResp); err != nil {
		return nil, fmt.Errorf("match %s: %w", matchID, err)
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

func DeterminePlaystyle(avgSniper, avgEntry, avgAssists, avgADR, avgHS, avgMulti float64) string {
	if avgSniper >= 6.0 {
		return "Main AWPer"
	}
	if avgEntry >= 2.5 && avgADR >= 85.0 {
		return "Entry Fragger"
	}
	if avgMulti >= 0.8 && avgADR >= 80.0 {
		return "Anchor"
	}
	if avgHS >= 50.0 && avgADR >= 85.0 {
		return "Star Rifler"
	}
	if avgAssists >= 4.5 {
		return "Support"
	}
	return "Flex"
}

func CalculateEloRegression(currentElo int, matches []PlayerMatchStats) (float64, int) {
	if len(matches) == 0 {
		return 0, currentElo
	}

	n := len(matches)
	eloHistory := make([]int, n)
	current := currentElo

	for i := 0; i < n; i++ {
		eloHistory[n-1-i] = current

		res := matches[i].Result
		isWin := res == "1" || res == "true"

		if isWin {
			current -= eloChangePerMatch
		} else {
			current += eloChangePerMatch
		}
	}

	var sumX, sumY, sumXY, sumX2 float64
	numPoints := float64(n)

	for i, elo := range eloHistory {
		x := float64(i + 1)
		y := float64(elo)
		sumX += x
		sumY += y
		sumXY += x * y
		sumX2 += x * x
	}

	m := (numPoints*sumXY - sumX*sumY) / (numPoints*sumX2 - sumX*sumX)
	b := (sumY - m*sumX) / numPoints

	predictedElo := m*(numPoints+1) + b

	return m, int(predictedElo)
}

func CalculateStatsFromHistory(formHistory []PlayerMatchStats, currentElo int) *RecentForm {
	if len(formHistory) == 0 {
		return nil
	}

	var totalKills, totalADR, totalHS, totalKR, totalAssists float64
	var totalEntry, totalSniper, totalMulti int
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
		if val, err := strconv.ParseFloat(stats.Assists, 64); err == nil {
			totalAssists += val
		}
		if val, err := strconv.Atoi(stats.FirstKills); err == nil {
			totalEntry += val
		}
		if val, err := strconv.Atoi(stats.SniperKills); err == nil {
			totalSniper += val
		}

		// Рахуємо мультикіли для Опорника
		if val, err := strconv.Atoi(stats.TripleKills); err == nil {
			totalMulti += val
		}
		if val, err := strconv.Atoi(stats.QuadroKills); err == nil {
			totalMulti += val
		}
		if val, err := strconv.Atoi(stats.PentaKills); err == nil {
			totalMulti += val
		}
	}

	avgSniper := float64(totalSniper) / float64(successfulMatches)
	avgEntry := float64(totalEntry) / float64(successfulMatches)
	avgAssists := totalAssists / float64(successfulMatches)
	avgADR := totalADR / float64(successfulMatches)
	avgHS := totalHS / float64(successfulMatches)
	avgMulti := float64(totalMulti) / float64(successfulMatches)

	role := DeterminePlaystyle(avgSniper, avgEntry, avgAssists, avgADR, avgHS, avgMulti)

	trendM, predictedElo := CalculateEloRegression(currentElo, formHistory)

	analytics := CalculateAnalytics(formHistory, currentElo, role, avgSniper, avgEntry, avgAssists, avgADR, avgHS, avgMulti)
	activity := CalculatePlayActivity(formHistory)

	return &RecentForm{
		MatchesAnalyzed:  successfulMatches,
		AvgKills:         totalKills / float64(successfulMatches),
		AvgADR:           avgADR,
		AvgHSPercentage:  avgHS,
		AvgKRRatio:       totalKR / float64(successfulMatches),
		TotalEntryKills:  totalEntry,
		TotalSniperKills: totalSniper,
		PlaystyleRole:    role,
		PredictedElo:     predictedElo,
		EloTrend:         trendM,
		Analytics:        analytics,
		Activity:         activity,
		MatchHistory:     formHistory,
	}
}

func CalculateRecentForm(ctx context.Context, playerID, apiKey string, limit int, currentElo int) (*RecentForm, error) {
	matchItems, err := GetPlayerMatchHistory(ctx, playerID, apiKey, limit)
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

	for w := 1; w <= numWorkers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for job := range jobs {
				select {
				case <-ctx.Done():
					results <- matchResult{index: job.index, err: ctx.Err()}
					continue
				default:
				}

				time.Sleep(workerThrottle)

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

	return CalculateStatsFromHistory(formHistory, currentElo), nil
}
