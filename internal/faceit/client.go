package faceit

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

type PlayerProfile struct {
	PlayerID string              `json:"player_id"`
	Nickname string              `json:"nickname"`
	Avatar   string              `json:"avatar"`
	SteamID  string              `json:"steam_id_64"`
	Games    map[string]GameInfo `json:"games"`
	Stats    *CS2Stats           `json:"stats,omitempty"`
	Recent   *RecentForm         `json:"recent_form,omitempty"`
}

type GameInfo struct {
	SkillLevel int `json:"skill_level"`
	FaceitElo  int `json:"faceit_elo"`
}

type CS2Stats struct {
	Lifetime LifetimeStats `json:"lifetime"`
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
	MatchID string `json:"match_id"`
}

type MatchStatsResponse struct {
	Rounds []MatchRound `json:"rounds"`
}

type MatchRound struct {
	Teams []MatchTeam `json:"teams"`
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

func GetPlayerProfile(nickname, apiKey string) (*PlayerProfile, error) {
	url := fmt.Sprintf("https://open.faceit.com/data/v4/players?nickname=%s", nickname)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Add("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
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

func GetCS2Stats(playerID, apiKey string) (*CS2Stats, error) {
	url := fmt.Sprintf("https://open.faceit.com/data/v4/players/%s/stats/cs2", playerID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Add("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
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

func GetPlayerMatchHistory(playerID, apiKey string, limit int) ([]string, error) {
	url := fmt.Sprintf("https://open.faceit.com/data/v4/players/%s/history?game=cs2&offset=0&limit=%d", playerID, limit)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Add("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
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

	var matchIDs []string

	for _, item := range historyResponse.Items {
		matchIDs = append(matchIDs, item.MatchID)
	}

	return matchIDs, nil
}

func GetMatchStatsForPlayer(matchID, targetPlayerID, apiKey string) (*PlayerMatchStats, error) {
	url := fmt.Sprintf("https://open.faceit.com/data/v4/matches/%s/stats", matchID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Add("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
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
				return &player.PlayerStats, nil
			}
		}
	}

	return nil, fmt.Errorf("гравця %s не знайдено в матчі %s", targetPlayerID, matchID)
}

func CalculateRecentForm(playerID, apiKey string, limit int) (*RecentForm, error) {
	matchIDs, err := GetPlayerMatchHistory(playerID, apiKey, limit)
	if err != nil {
		return nil, err
	}

	if len(matchIDs) == 0 {
		return nil, fmt.Errorf("у гравця немає зіграних матчів")
	}

	var totalKills, totalADR, totalHS, totalKR float64
	var totalEntry, totalSniper int
	var successfulMatches int
	var formHistory []PlayerMatchStats

	for _, matchID := range matchIDs {
		stats, err := GetMatchStatsForPlayer(matchID, playerID, apiKey)
		if err != nil {
			continue
		}

		formHistory = append(formHistory, *stats)

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

		successfulMatches++
	}

	if successfulMatches == 0 {
		return nil, fmt.Errorf("не вдалося проаналізувати жодного матчу")
	}

	form := &RecentForm{
		MatchesAnalyzed:  successfulMatches,
		AvgKills:         totalKills / float64(successfulMatches),
		AvgADR:           totalADR / float64(successfulMatches),
		AvgHSPercentage:  totalHS / float64(successfulMatches),
		AvgKRRatio:       totalKR / float64(successfulMatches),
		TotalEntryKills:  totalEntry,
		TotalSniperKills: totalSniper,
		MatchHistory:     formHistory,
	}

	return form, nil
}
