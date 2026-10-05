package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/xhanjo/gaming-stats-dashboard/internal/faceit"
)

type MockDB struct {
	GetPlayerFunc  func(ctx context.Context, nickname string) (*faceit.PlayerProfile, error)
	SavePlayerFunc func(ctx context.Context, profile *faceit.PlayerProfile) error
}

func (m *MockDB) GetPlayer(ctx context.Context, nickname string) (*faceit.PlayerProfile, error) {
	if m.GetPlayerFunc != nil {
		return m.GetPlayerFunc(ctx, nickname)
	}
	if nickname == "cached_user" {
		return &faceit.PlayerProfile{
			Nickname: "cached_user",
			PlayerID: "12345",
			Games: map[string]faceit.GameInfo{
				"cs2": {FaceitElo: 2500, SkillLevel: 10},
			},
			Recent: &faceit.RecentForm{
				MatchHistory: []faceit.PlayerMatchStats{
					{MatchId: "mock_match_123", Kills: "20", Deaths: "10"},
				},
			},
		}, nil
	}
	return nil, sql.ErrNoRows
}

func (m *MockDB) SavePlayer(ctx context.Context, profile *faceit.PlayerProfile) error {
	if m.SavePlayerFunc != nil {
		return m.SavePlayerFunc(ctx, profile)
	}
	return nil
}

type MockFaceitService struct {
	GetPlayerProfileFunc    func(ctx context.Context, nickname string) (*faceit.PlayerProfile, error)
	GetCS2StatsFunc         func(ctx context.Context, playerID string) (*faceit.CS2Stats, error)
	CalculateRecentFormFunc func(ctx context.Context, playerID string, limit, currentElo int) (*faceit.RecentForm, error)
}

func (m *MockFaceitService) GetPlayerProfile(ctx context.Context, nickname string) (*faceit.PlayerProfile, error) {
	if m.GetPlayerProfileFunc != nil {
		return m.GetPlayerProfileFunc(ctx, nickname)
	}
	return nil, nil
}

func (m *MockFaceitService) GetCS2Stats(ctx context.Context, playerID string) (*faceit.CS2Stats, error) {
	if m.GetCS2StatsFunc != nil {
		return m.GetCS2StatsFunc(ctx, playerID)
	}
	return nil, nil
}

func (m *MockFaceitService) CalculateRecentForm(ctx context.Context, playerID string, limit, currentElo int) (*faceit.RecentForm, error) {
	if m.CalculateRecentFormFunc != nil {
		return m.CalculateRecentFormFunc(ctx, playerID, limit, currentElo)
	}
	return nil, nil
}

func TestGetPlayerStats_FromDB(t *testing.T) {
	mockDB := &MockDB{}
	mockFaceit := &MockFaceitService{}

	r := chi.NewRouter()
	r.Get("/api/player/{nickname}", GetPlayerStats(mockDB, mockFaceit))

	req, _ := http.NewRequest(http.MethodGet, "/api/player/cached_user", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("Expected status %v, got %v", http.StatusOK, status)
	}

	var profile faceit.PlayerProfile
	if err := json.NewDecoder(rr.Body).Decode(&profile); err != nil {
		t.Fatalf("JSON decode error: %v", err)
	}

	if profile.Nickname != "cached_user" {
		t.Errorf("Expected nickname 'cached_user', got '%v'", profile.Nickname)
	}
	if profile.Games["cs2"].FaceitElo != 2500 {
		t.Errorf("Expected Elo 2500, got %v", profile.Games["cs2"].FaceitElo)
	}
}

func TestGetPlayerStats_FromFaceit(t *testing.T) {
	savedCalled := false
	mockDB := &MockDB{
		GetPlayerFunc: func(ctx context.Context, nickname string) (*faceit.PlayerProfile, error) {
			return nil, sql.ErrNoRows // cache miss
		},
		SavePlayerFunc: func(ctx context.Context, profile *faceit.PlayerProfile) error {
			savedCalled = true
			return nil
		},
	}

	mockFaceit := &MockFaceitService{
		GetPlayerProfileFunc: func(ctx context.Context, nickname string) (*faceit.PlayerProfile, error) {
			return &faceit.PlayerProfile{
				PlayerID: "player_999",
				Nickname: "live_user",
				Games: map[string]faceit.GameInfo{
					"cs2": {FaceitElo: 2100, SkillLevel: 9},
				},
			}, nil
		},
		GetCS2StatsFunc: func(ctx context.Context, playerID string) (*faceit.CS2Stats, error) {
			return &faceit.CS2Stats{
				Lifetime: faceit.LifetimeStats{AverageKD: "1.25", WinRate: "55%", Matches: "120"},
			}, nil
		},
		CalculateRecentFormFunc: func(ctx context.Context, playerID string, limit, currentElo int) (*faceit.RecentForm, error) {
			return &faceit.RecentForm{
				MatchesAnalyzed: 20,
				MatchHistory: []faceit.PlayerMatchStats{
					{MatchId: "m1", Kills: "22", Deaths: "12"},
				},
			}, nil
		},
	}

	r := chi.NewRouter()
	r.Get("/api/player/{nickname}", GetPlayerStats(mockDB, mockFaceit))

	req, _ := http.NewRequest(http.MethodGet, "/api/player/live_user", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", rr.Code)
	}

	if !savedCalled {
		t.Errorf("Expected SavePlayer to be called on cache miss")
	}

	var profile faceit.PlayerProfile
	if err := json.NewDecoder(rr.Body).Decode(&profile); err != nil {
		t.Fatalf("JSON decode error: %v", err)
	}
	if profile.Nickname != "live_user" {
		t.Errorf("Expected nickname 'live_user', got '%s'", profile.Nickname)
	}
}

func TestGetPlayerStats_FaceitError(t *testing.T) {
	mockDB := &MockDB{
		GetPlayerFunc: func(ctx context.Context, nickname string) (*faceit.PlayerProfile, error) {
			return nil, sql.ErrNoRows
		},
	}

	mockFaceit := &MockFaceitService{
		GetPlayerProfileFunc: func(ctx context.Context, nickname string) (*faceit.PlayerProfile, error) {
			return nil, errors.New("rate limited")
		},
	}

	r := chi.NewRouter()
	r.Get("/api/player/{nickname}", GetPlayerStats(mockDB, mockFaceit))

	req, _ := http.NewRequest(http.MethodGet, "/api/player/error_user", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("Expected status 500, got %d", rr.Code)
	}

	var resp errorResponse
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("Failed to decode JSON error: %v", err)
	}
	if resp.Error == "" {
		t.Errorf("Expected non-empty error message in response")
	}
}

func TestGetPlayerStats_ValidationErrors(t *testing.T) {
	mockDB := &MockDB{}
	mockFaceit := &MockFaceitService{}

	r := chi.NewRouter()
	r.Get("/api/player/", GetPlayerStats(mockDB, mockFaceit))
	r.Get("/api/player/{nickname}", GetPlayerStats(mockDB, mockFaceit))

	tests := []struct {
		name       string
		path       string
		wantStatus int
		wantError  string
	}{
		{
			name:       "empty nickname",
			path:       "/api/player/",
			wantStatus: http.StatusBadRequest,
			wantError:  "Будь ласка, вкажіть параметр nickname",
		},
		{
			name:       "negative limit",
			path:       "/api/player/test_user?limit=-5",
			wantStatus: http.StatusBadRequest,
			wantError:  "Параметр limit має бути числом від 1 до 200",
		},
		{
			name:       "zero limit",
			path:       "/api/player/test_user?limit=0",
			wantStatus: http.StatusBadRequest,
			wantError:  "Параметр limit має бути числом від 1 до 200",
		},
		{
			name:       "too large limit",
			path:       "/api/player/test_user?limit=201",
			wantStatus: http.StatusBadRequest,
			wantError:  "Параметр limit має бути числом від 1 до 200",
		},
		{
			name:       "non-numeric limit",
			path:       "/api/player/test_user?limit=abc",
			wantStatus: http.StatusBadRequest,
			wantError:  "Параметр limit має бути числом від 1 до 200",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest(http.MethodGet, tt.path, nil)
			rr := httptest.NewRecorder()
			r.ServeHTTP(rr, req)

			if rr.Code != tt.wantStatus {
				t.Errorf("status code = %d, want %d", rr.Code, tt.wantStatus)
			}

			var resp errorResponse
			if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
				t.Fatalf("failed to decode error json: %v", err)
			}
			if resp.Error != tt.wantError {
				t.Errorf("error msg = %q, want %q", resp.Error, tt.wantError)
			}
		})
	}
}

func TestGetPlayerStats_StaleCache_MergesMatchesWithoutDowngrade(t *testing.T) {
	// Симуляція: у БД вже збережено 50 матчів, але кеш старіший за 1 годину.
	// Користувач відкриває застосунок (limit=30).
	// Сервіс не повинен скидати 50 матчів до 30! Він має об'єднати їх і повернути повний набір!
	var dbHistory []faceit.PlayerMatchStats
	for i := 1; i <= 50; i++ {
		dbHistory = append(dbHistory, faceit.PlayerMatchStats{
			MatchId: fmt.Sprintf("old_match_%d", i),
			Kills:   "20", Deaths: "15", ADR: "80", HeadshotsPc: "50", KRRatio: "1.0",
		})
	}

	cachedProfile := &faceit.PlayerProfile{
		PlayerID:    "player_100",
		Nickname:    "veteran_user",
		LastUpdated: time.Now().Add(-2 * time.Hour), // 2 години тому (застарілий кеш)
		Games:       map[string]faceit.GameInfo{"cs2": {FaceitElo: 2200, SkillLevel: 10}},
		Recent: &faceit.RecentForm{
			MatchesAnalyzed: len(dbHistory),
			MatchHistory:    dbHistory,
		},
	}

	savedProfileMatches := 0
	mockDB := &MockDB{
		GetPlayerFunc: func(ctx context.Context, nickname string) (*faceit.PlayerProfile, error) {
			return cachedProfile, nil
		},
		SavePlayerFunc: func(ctx context.Context, profile *faceit.PlayerProfile) error {
			if profile.Recent != nil {
				savedProfileMatches = len(profile.Recent.MatchHistory)
			}
			return nil
		},
	}

	// Faceit API повертає 5 нових матчів + 5 з тих, що вже були
	var apiHistory []faceit.PlayerMatchStats
	apiHistory = append(apiHistory,
		faceit.PlayerMatchStats{MatchId: "new_match_1", Kills: "25", Deaths: "10", ADR: "95", HeadshotsPc: "60", KRRatio: "1.2"},
		faceit.PlayerMatchStats{MatchId: "new_match_2", Kills: "18", Deaths: "12", ADR: "75", HeadshotsPc: "40", KRRatio: "0.9"},
		faceit.PlayerMatchStats{MatchId: "old_match_1", Kills: "20", Deaths: "15", ADR: "80", HeadshotsPc: "50", KRRatio: "1.0"}, // існуючий
	)

	mockFaceit := &MockFaceitService{
		GetPlayerProfileFunc: func(ctx context.Context, nickname string) (*faceit.PlayerProfile, error) {
			return &faceit.PlayerProfile{
				PlayerID: "player_100",
				Nickname: "veteran_user",
				Games:    map[string]faceit.GameInfo{"cs2": {FaceitElo: 2225, SkillLevel: 10}},
			}, nil
		},
		GetCS2StatsFunc: func(ctx context.Context, playerID string) (*faceit.CS2Stats, error) {
			return &faceit.CS2Stats{}, nil
		},
		CalculateRecentFormFunc: func(ctx context.Context, playerID string, limit, currentElo int) (*faceit.RecentForm, error) {
			return &faceit.RecentForm{
				MatchesAnalyzed: len(apiHistory),
				MatchHistory:    apiHistory,
			}, nil
		},
	}

	r := chi.NewRouter()
	r.Get("/api/player/{nickname}", GetPlayerStats(mockDB, mockFaceit))

	req, _ := http.NewRequest(http.MethodGet, "/api/player/veteran_user?limit=30", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", rr.Code)
	}

	var response faceit.PlayerProfile
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Fatalf("Decode response error: %v", err)
	}

	// 50 старих + 2 нових = 52 матчі (old_match_1 здедупліковано)
	expectedTotal := 52
	if response.Recent == nil || len(response.Recent.MatchHistory) != expectedTotal {
		t.Fatalf("Expected %d matches in response history, got %d", expectedTotal, len(response.Recent.MatchHistory))
	}

	if response.Recent.MatchesAnalyzed != expectedTotal {
		t.Errorf("Expected MatchesAnalyzed = %d, got %d", expectedTotal, response.Recent.MatchesAnalyzed)
	}

	if savedProfileMatches != expectedTotal {
		t.Errorf("Expected SavePlayer to be called with %d matches, got %d", expectedTotal, savedProfileMatches)
	}
}

func TestGetPlayerStats_StaleCache_FallbackOnFaceitError(t *testing.T) {
	// Якщо Faceit API падає (429 або timeout), але у нас є збережені дані в БД - віддаємо кеш!
	cachedProfile := &faceit.PlayerProfile{
		PlayerID:    "player_fallback",
		Nickname:    "fallback_user",
		LastUpdated: time.Now().Add(-3 * time.Hour),
		Games:       map[string]faceit.GameInfo{"cs2": {FaceitElo: 2000, SkillLevel: 8}},
		Recent: &faceit.RecentForm{
			MatchesAnalyzed: 10,
			MatchHistory: []faceit.PlayerMatchStats{
				{MatchId: "saved_1", Kills: "20", Deaths: "10"},
			},
		},
	}

	mockDB := &MockDB{
		GetPlayerFunc: func(ctx context.Context, nickname string) (*faceit.PlayerProfile, error) {
			return cachedProfile, nil
		},
	}

	mockFaceit := &MockFaceitService{
		GetPlayerProfileFunc: func(ctx context.Context, nickname string) (*faceit.PlayerProfile, error) {
			return nil, errors.New("faceit api 429 rate limit")
		},
	}

	r := chi.NewRouter()
	r.Get("/api/player/{nickname}", GetPlayerStats(mockDB, mockFaceit))

	req, _ := http.NewRequest(http.MethodGet, "/api/player/fallback_user", nil)
	rr := httptest.NewRecorder()

	r.ServeHTTP(rr, req)

	// Повинно повернути 200 OK з кешованими даними, а не 500!
	if rr.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK fallback, got %d", rr.Code)
	}

	var response faceit.PlayerProfile
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Fatalf("Decode error: %v", err)
	}

	if response.Nickname != "fallback_user" {
		t.Errorf("Expected fallback profile 'fallback_user', got %s", response.Nickname)
	}
}
