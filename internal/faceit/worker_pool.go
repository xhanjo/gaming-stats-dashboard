package faceit

import (
	"context"
	"fmt"
	"sync"
	"time"
)

func (c *Client) CalculateRecentForm(ctx context.Context, playerID string, limit int, currentElo int) (*RecentForm, error) {
	matchItems, err := c.GetPlayerMatchHistory(ctx, playerID, limit)
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
				case <-time.After(workerThrottle):
				}

				stats, err := c.GetMatchStatsForPlayer(ctx, job.item.MatchID, playerID)
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

// CalculateRecentForm legacy standalone function for backwards compatibility
func CalculateRecentForm(ctx context.Context, playerID, apiKey string, limit int, currentElo int) (*RecentForm, error) {
	return NewClient(apiKey).CalculateRecentForm(ctx, playerID, limit, currentElo)
}
