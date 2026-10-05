package faceit

import (
	"math"
	"strconv"
)

func parseFloatSafe(s string) float64 {
	if s == "" {
		return 0
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return v
}

func parseIntSafe(s string) int {
	if s == "" {
		return 0
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return v
}

// AnalyticsReport містить усю бізнес-аналітику, розраховану бекендом
type AnalyticsReport struct {
	Playstyle     PlaystyleReport     `json:"playstyle"`
	Stability     StabilityReport     `json:"stability"`
	Clustering    ClusterReport       `json:"clustering"`
	EloScenarios  EloScenariosReport  `json:"elo_scenarios"`
	WinConditions WinConditionsReport `json:"win_conditions"`
}

type PlaystyleReport struct {
	Role          string    `json:"role"`
	RadarScores   []float64 `json:"radar_scores"`   // normalized 0-100: Sniper, Entry, Assists, Multi, HS%, ADR
	RawRadarStats []string  `json:"raw_radar_stats"` // formatted string tooltips
}

type StabilityReport struct {
	Score      int     `json:"score"` // 0-100
	StatusText string  `json:"status_text"`
	ColorHex   string  `json:"color_hex"`
	KDStdDev   float64 `json:"kd_std_dev"`
	MeanKD     float64 `json:"mean_kd"`
}

type ClusterPoint struct {
	KD         float64 `json:"kd"`
	ADR        float64 `json:"adr"`
	MatchIndex int     `json:"match_index"`
	Cluster    int     `json:"cluster"` // 0: Carry, 1: Average, 2: Low Impact
}

type ClusterReport struct {
	StarPoints    []ClusterPoint `json:"star_points"`
	MidPoints     []ClusterPoint `json:"mid_points"`
	LowPoints     []ClusterPoint `json:"low_points"`
	StarPercent   int            `json:"star_percent"`
	MidPercent    int            `json:"mid_percent"`
	LowPercent    int            `json:"low_percent"`
}

type EloScenariosReport struct {
	CurrentElo       int     `json:"current_elo"`
	PredictedElo     int     `json:"predicted_elo"`
	ExpectedPath     []int   `json:"expected_path"`
	OptimisticPath   []int   `json:"optimistic_path"`
	PessimisticPath  []int   `json:"pessimistic_path"`
	FinalExpected    int     `json:"final_expected"`
	FinalOptimistic  int     `json:"final_optimistic"`
	FinalPessimistic int     `json:"final_pessimistic"`
	OptWins          int     `json:"opt_wins"`
	PesWins          int     `json:"pes_wins"`
	ExpWins          int     `json:"exp_wins"`
	FutureSteps      int     `json:"future_steps"`
}

type WinConditionMetric struct {
	Label            string `json:"label"`
	Description      string `json:"description"`
	ThresholdVal     string `json:"threshold_val"`
	WinRate          int    `json:"win_rate"`
	DiffFromBaseline int    `json:"diff_from_baseline"`
	TotalMatches     int    `json:"total_matches"`
	ColorClass       string `json:"color_class"`
}

type WinConditionsReport struct {
	BaselineWinRate int                `json:"baseline_win_rate"`
	HighADR         WinConditionMetric `json:"high_adr"`
	HighKD          WinConditionMetric `json:"high_kd"`
	HighKills       WinConditionMetric `json:"high_kills"`
	HighEntry       WinConditionMetric `json:"high_entry"`
	HighAssists     WinConditionMetric `json:"high_assists"`
}

type HourlyStat struct {
	Hour    int `json:"hour"`
	Matches int `json:"matches"`
	Wins    int `json:"wins"`
}

type DailyStat struct {
	DayName string `json:"day_name"`
	Matches int    `json:"matches"`
	Wins    int    `json:"wins"`
}

type PlayActivityReport struct {
	TotalMatches           int            `json:"total_matches"`
	TotalWins              int            `json:"total_wins"`
	UniqueDaysCount        int            `json:"unique_days_count"`
	CurrentMonthName       string         `json:"current_month_name"` // legacy alias for most active month
	CurrentMonthMatches    int            `json:"current_month_matches"`
	MostActiveMonthName    string         `json:"most_active_month_name"`
	MostActiveMonthMatches int            `json:"most_active_month_matches"`
	MostActiveHour         int            `json:"most_active_hour"`
	MostActiveHourDisplay  string         `json:"most_active_hour_display"`
	MostActiveHourWinrate  float64        `json:"most_active_hour_winrate"`
	AvgDailyMatches        float64        `json:"avg_daily_matches"`
	DailyTrendDelta        float64        `json:"daily_trend_delta"`
	DailyTrendDisplay      string         `json:"daily_trend_display"`
	DailyTrendDirection    string         `json:"daily_trend_direction"`
	AvgWeeklyMatches       float64        `json:"avg_weekly_matches"`
	HourlyDistribution     []HourlyStat   `json:"hourly_distribution"`
	DailyDistribution      []DailyStat    `json:"daily_distribution"`
	MatchCountsByDate      map[string]int `json:"match_counts_by_date"`
}

// CalculateAnalytics генерує повний аналітичний звіт на основі історії матчів
func CalculateAnalytics(matches []PlayerMatchStats, currentElo int, role string, avgSniper, avgEntry, avgAssists, avgADR, avgHS, avgMulti float64) *AnalyticsReport {
	if len(matches) == 0 {
		return nil
	}

	return &AnalyticsReport{
		Playstyle:     calculatePlaystyle(role, avgSniper, avgEntry, avgAssists, avgADR, avgHS, avgMulti),
		Stability:     calculateStability(matches),
		Clustering:    calculateClusters(matches),
		EloScenarios:  simulateEloScenarios(currentElo, matches, 10),
		WinConditions: calculateWinConditions(matches, avgADR),
	}
}

func calculatePlaystyle(role string, avgSniper, avgEntry, avgAssists, avgADR, avgHS, avgMulti float64) PlaystyleReport {
	nSniper := math.Min((avgSniper/8.0)*100.0, 100.0)
	nEntry := math.Min((avgEntry/3.5)*100.0, 100.0)
	nAssists := math.Min((avgAssists/6.0)*100.0, 100.0)
	nMulti := math.Min((avgMulti/1.2)*100.0, 100.0)
	nHS := math.Min((avgHS/60.0)*100.0, 100.0)
	nADR := math.Min((avgADR/105.0)*100.0, 100.0)

	rawStats := []string{
		strconv.FormatFloat(avgSniper, 'f', 2, 64) + " AWP кілів / матч",
		strconv.FormatFloat(avgEntry, 'f', 2, 64) + " First kills / матч",
		strconv.FormatFloat(avgAssists, 'f', 2, 64) + " Асистів / матч",
		strconv.FormatFloat(avgMulti, 'f', 2, 64) + " Мультикілів (3k+) / матч",
		strconv.FormatFloat(avgHS, 'f', 1, 64) + "% Headshots (в сер.)",
		strconv.FormatFloat(avgADR, 'f', 1, 64) + " ADR (в сер.)",
	}

	return PlaystyleReport{
		Role:          role,
		RadarScores:   []float64{nSniper, nEntry, nAssists, nMulti, nHS, nADR},
		RawRadarStats: rawStats,
	}
}
