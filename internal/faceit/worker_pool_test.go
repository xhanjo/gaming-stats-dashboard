package faceit

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCalculateRecentForm_ContextCancellation(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Mock history endpoint
		if r.URL.Path == "/players/p123/history" {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"items": [
				{"match_id": "m1", "started_at": 1700000000},
				{"match_id": "m2", "started_at": 1700000010},
				{"match_id": "m3", "started_at": 1700000020}
			]}`))
			return
		}
		// Slow match stats endpoint
		time.Sleep(100 * time.Millisecond)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"rounds": []}`))
	}))
	defer srv.Close()

	client := NewClient("dummy_key", WithBaseURL(srv.URL))

	ctx, cancel := context.WithCancel(context.Background())
	// Cancel almost immediately to test worker pool abort
	time.AfterFunc(20*time.Millisecond, cancel)

	start := time.Now()
	_, err := client.CalculateRecentForm(ctx, "p123", 3, 2000)
	elapsed := time.Since(start)

	if err == nil {
		t.Fatal("expected error due to context cancellation, got nil")
	}

	// Because workers cleanly return on ctx.Done(), elapsed time should be small
	if elapsed > 1*time.Second {
		t.Errorf("worker pool took too long to abort on cancelled context: %v", elapsed)
	}
}
