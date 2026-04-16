package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/xhanjo/gaming-stats-dashboard/internal/faceit"
)

type MockDB struct{}

func (m *MockDB) GetPlayer(nickname string) (*faceit.PlayerProfile, error) {
	if nickname == "test_user" {
		return &faceit.PlayerProfile{
			Nickname: "test_user",
			PlayerID: "12345",
			Games: map[string]faceit.GameInfo{
				"cs2": {FaceitElo: 2500, SkillLevel: 10},
			},
		}, nil
	}
	return nil, nil
}

func (m *MockDB) SavePlayer(profile *faceit.PlayerProfile) error {
	return nil
}

func TestGetPlayerStats_FromDB(t *testing.T) {
	mockDB := &MockDB{}
	fakeAPIKey := "no-need-key"

	r := chi.NewRouter()
	r.Get("/api/player/{nickname}", GetPlayerStats(mockDB, fakeAPIKey))

	req, _ := http.NewRequest("GET", "/api/player/test_user", nil)

	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Очікувався статус %v, отримано %v", http.StatusOK, status)
	}

	var profile faceit.PlayerProfile
	err := json.NewDecoder(rr.Body).Decode(&profile)
	if err != nil {
		t.Fatalf("Помилка декодування JSON: %v", err)
	}

	if profile.Nickname != "test_user" {
		t.Errorf("Очікувався nickname 'test_user', отримано '%v'", profile.Nickname)
	}

	if profile.Games["cs2"].FaceitElo != 2500 {
		t.Errorf("Очікувалось Elo 2500, отримано %v", profile.Games["cs2"].FaceitElo)
	}
}
