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
}

type GameInfo struct {
	SkillLevel int `json:"skill_level"`
	FaceitElo  int `json:"faceit_elo"`
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
