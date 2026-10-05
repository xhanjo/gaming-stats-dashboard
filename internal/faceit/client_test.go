package faceit

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestPlayerMatchStatsParsing(t *testing.T) {
	mockJSON := []byte(`{
		"Match Id": "1_faceit_match_123",
		"Kills": "28",
		"Deaths": "14",
		"Result": "1",
		"created_at": 1712150000
	}`)

	var stats PlayerMatchStats
	err := json.Unmarshal(mockJSON, &stats)

	if err != nil {
		t.Fatalf("Очікувався успішний парсинг JSON, отримана помилка: %v", err)
	}

	if stats.MatchId != "1_faceit_match_123" {
		t.Errorf("Очікувався Match Id '1_faceit_match_123', отримано '%s'", stats.MatchId)
	}

	if stats.Kills != "28" {
		t.Errorf("Очікувалось 28 вбивств, отримано '%s'", stats.Kills)
	}

	if stats.Result != "1" {
		t.Errorf("Очікувався Result '1', отримано '%s'", stats.Result)
	}

	if stats.CreatedAt1 == nil {
		t.Errorf("Поле CreatedAt1 не повинно бути порожнім")
	}
}

func TestClient_Retry429_Success(t *testing.T) {
	var attempts int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		current := atomic.AddInt32(&attempts, 1)
		if current < 3 {
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error": "rate limit"}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"player_id": "p123", "nickname": "pro_player"}`))
	}))
	defer srv.Close()

	client := NewClient("dummy_key",
		WithBaseURL(srv.URL),
		WithRetryBaseWait(5*time.Millisecond),
	)

	ctx := context.Background()
	profile, err := client.GetPlayerProfile(ctx, "pro_player")
	if err != nil {
		t.Fatalf("expected request to succeed after retry, got err: %v", err)
	}

	if profile.Nickname != "pro_player" {
		t.Errorf("expected nickname 'pro_player', got '%s'", profile.Nickname)
	}

	if atomic.LoadInt32(&attempts) != 3 {
		t.Errorf("expected 3 attempts, got %d", attempts)
	}
}

func TestClient_Retry5xx_Success(t *testing.T) {
	var attempts int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		current := atomic.AddInt32(&attempts, 1)
		if current == 1 {
			w.WriteHeader(http.StatusBadGateway)
			w.Write([]byte(`Bad Gateway`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"lifetime": {"Average K/D Ratio": "1.30"}}`))
	}))
	defer srv.Close()

	client := NewClient("dummy_key",
		WithBaseURL(srv.URL),
		WithRetryBaseWait(5*time.Millisecond),
	)

	ctx := context.Background()
	stats, err := client.GetCS2Stats(ctx, "player_xyz")
	if err != nil {
		t.Fatalf("expected request to succeed after 5xx retry, got err: %v", err)
	}

	if stats.Lifetime.AverageKD != "1.30" {
		t.Errorf("expected AverageKD '1.30', got '%s'", stats.Lifetime.AverageKD)
	}

	if atomic.LoadInt32(&attempts) != 2 {
		t.Errorf("expected 2 attempts, got %d", attempts)
	}
}

func TestClient_ExhaustedRetries(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer srv.Close()

	client := NewClient("dummy_key",
		WithBaseURL(srv.URL),
		WithRetryBaseWait(2*time.Millisecond),
	)

	ctx := context.Background()
	_, err := client.GetPlayerProfile(ctx, "pro_player")
	if err == nil {
		t.Fatal("expected error after exhausted retries, got nil")
	}
}

func TestClient_ContextCancellation(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
	}))
	defer srv.Close()

	client := NewClient("dummy_key",
		WithBaseURL(srv.URL),
		WithRetryBaseWait(500*time.Millisecond),
	)

	ctx, cancel := context.WithCancel(context.Background())
	// Cancel almost immediately
	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	_, err := client.GetPlayerProfile(ctx, "pro_player")
	if err == nil {
		t.Fatal("expected error on cancelled context, got nil")
	}
	if !errors.Is(err, context.Canceled) {
		t.Logf("got error on cancellation: %v", err)
	}
}
