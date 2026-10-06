package faceit

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

var ErrNotFound = errors.New("not found")

const (
	defaultHTTPTimeout    = 10 * time.Second
	defaultBaseURL        = "https://open.faceit.com/data/v4"
	maxRetries            = 3
	defaultRetryBaseWait  = 500 * time.Millisecond
	matchHistoryBatchSize = 100
	batchDelay            = 200 * time.Millisecond
	numWorkers            = 5
	workerThrottle        = 150 * time.Millisecond
	eloChangePerMatch     = 25
)

// HTTPClient represents any HTTP client implementation (e.g. *http.Client or mock)
type HTTPClient interface {
	Do(req *http.Request) (*http.Response, error)
}

// Client interacts with the official FACEIT Open API v4
type Client struct {
	apiKey        string
	baseURL       string
	httpClient    HTTPClient
	retryBaseWait time.Duration
}

// Option configures a Client instance
type Option func(*Client)

// WithHTTPClient overrides the default HTTP transport client
func WithHTTPClient(client HTTPClient) Option {
	return func(c *Client) {
		if client != nil {
			c.httpClient = client
		}
	}
}

// WithBaseURL overrides the API base URL (useful for httptest.Server)
func WithBaseURL(baseURL string) Option {
	return func(c *Client) {
		c.baseURL = baseURL
	}
}

// WithRetryBaseWait configures retry backoff duration (useful for faster tests)
func WithRetryBaseWait(wait time.Duration) Option {
	return func(c *Client) {
		c.retryBaseWait = wait
	}
}

// NewClient initializes a new FACEIT API client
func NewClient(apiKey string, opts ...Option) *Client {
	c := &Client{
		apiKey:        apiKey,
		baseURL:       defaultBaseURL,
		httpClient:    &http.Client{Timeout: defaultHTTPTimeout},
		retryBaseWait: defaultRetryBaseWait,
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// doRequest performs an HTTP request with exponential backoff on 429 and 5xx errors
func (c *Client) doRequest(ctx context.Context, targetURL string, result any) error {
	for attempt := 0; attempt <= maxRetries; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
		if err != nil {
			return fmt.Errorf("create request: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+c.apiKey)

		resp, err := c.httpClient.Do(req)
		if err != nil {
			if attempt == maxRetries {
				return fmt.Errorf("http request: %w", err)
			}
			wait := c.retryBaseWait * time.Duration(1<<attempt)
			select {
			case <-time.After(wait):
				continue
			case <-ctx.Done():
				return ctx.Err()
			}
		}

		if resp.StatusCode == http.StatusTooManyRequests || (resp.StatusCode >= 500 && resp.StatusCode <= 599) {
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			if attempt == maxRetries {
				return fmt.Errorf("FACEIT API: status %d after %d retries", resp.StatusCode, maxRetries)
			}
			wait := c.retryBaseWait * time.Duration(1<<attempt)
			select {
			case <-time.After(wait):
				continue
			case <-ctx.Done():
				return ctx.Err()
			}
		}

		if resp.StatusCode != http.StatusOK {
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			if resp.StatusCode == http.StatusNotFound {
				return ErrNotFound
			}
			return fmt.Errorf("FACEIT API: status %d", resp.StatusCode)
		}

		decodeErr := json.NewDecoder(resp.Body).Decode(result)
		resp.Body.Close()
		if decodeErr != nil {
			return fmt.Errorf("decode response: %w", decodeErr)
		}
		return nil
	}
	return fmt.Errorf("FACEIT API: exhausted retries")
}

// GetPlayerProfile fetches player profile by their nickname
func (c *Client) GetPlayerProfile(ctx context.Context, nickname string) (*PlayerProfile, error) {
	reqURL := fmt.Sprintf("%s/players?nickname=%s", c.baseURL, url.QueryEscape(nickname))

	var profile PlayerProfile
	if err := c.doRequest(ctx, reqURL, &profile); err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, fmt.Errorf("get player profile: %w", ErrNotFound)
		}
		return nil, fmt.Errorf("get player profile: %w", err)
	}
	return &profile, nil
}

// GetCS2Stats fetches CS2 statistics for a player
func (c *Client) GetCS2Stats(ctx context.Context, playerID string) (*CS2Stats, error) {
	reqURL := fmt.Sprintf("%s/players/%s/stats/cs2", c.baseURL, url.PathEscape(playerID))

	var stats CS2Stats
	if err := c.doRequest(ctx, reqURL, &stats); err != nil {
		return nil, fmt.Errorf("get cs2 stats: %w", err)
	}
	return &stats, nil
}

// GetPlayerMatchHistory retrieves match history items up to limit
func (c *Client) GetPlayerMatchHistory(ctx context.Context, playerID string, limit int) ([]MatchHistoryItem, error) {
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

		reqURL := fmt.Sprintf("%s/players/%s/history?game=cs2&offset=%d&limit=%d", c.baseURL, url.PathEscape(playerID), offset, fetchSize)

		var historyResponse MatchHistoryResponse
		if err := c.doRequest(ctx, reqURL, &historyResponse); err != nil {
			if len(allItems) > 0 {
				break
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

// GetMatchStatsForPlayer retrieves player-specific stats in a match
func (c *Client) GetMatchStatsForPlayer(ctx context.Context, matchID, targetPlayerID string) (*PlayerMatchStats, error) {
	reqURL := fmt.Sprintf("%s/matches/%s/stats", c.baseURL, url.PathEscape(matchID))

	var matchResp MatchStatsResponse
	if err := c.doRequest(ctx, reqURL, &matchResp); err != nil {
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

// Legacy package-level functions for backward compatibility:

func GetPlayerProfile(ctx context.Context, nickname, apiKey string) (*PlayerProfile, error) {
	return NewClient(apiKey).GetPlayerProfile(ctx, nickname)
}

func GetCS2Stats(ctx context.Context, playerID, apiKey string) (*CS2Stats, error) {
	return NewClient(apiKey).GetCS2Stats(ctx, playerID)
}

func GetPlayerMatchHistory(ctx context.Context, playerID, apiKey string, limit int) ([]MatchHistoryItem, error) {
	return NewClient(apiKey).GetPlayerMatchHistory(ctx, playerID, limit)
}

func GetMatchStatsForPlayer(ctx context.Context, matchID, targetPlayerID, apiKey string) (*PlayerMatchStats, error) {
	return NewClient(apiKey).GetMatchStatsForPlayer(ctx, matchID, targetPlayerID)
}
