package faceit

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type PlayerProfile struct {
	PlayerID string              `json:"player_id"`
	Nickname string              `json:"nickname"`
	Games    map[string]GameInfo `json:"games"`
	Stats    *CS2Stats           `json:"stats,omitempty"`
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
