package faceit

import (
	"fmt"
	"math"
	"strconv"
	"time"
)

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
	TotalMatches          int            `json:"total_matches"`
	TotalWins             int            `json:"total_wins"`
	UniqueDaysCount       int            `json:"unique_days_count"`
	CurrentMonthName      string         `json:"current_month_name"`
	CurrentMonthMatches   int            `json:"current_month_matches"`
	MostActiveHour        int            `json:"most_active_hour"`
	MostActiveHourDisplay string         `json:"most_active_hour_display"`
	MostActiveHourWinrate int            `json:"most_active_hour_winrate"`
	AvgDailyMatches       float64        `json:"avg_daily_matches"`
	AvgWeeklyMatches      float64        `json:"avg_weekly_matches"`
	HourlyDistribution    []HourlyStat   `json:"hourly_distribution"`
	DailyDistribution     []DailyStat    `json:"daily_distribution"`
	MatchCountsByDate     map[string]int `json:"match_counts_by_date"`
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

func calculateStability(matches []PlayerMatchStats) StabilityReport {
	n := len(matches)
	if n == 0 {
		return StabilityReport{Score: 0, StatusText: "Низька", ColorHex: "#ef4444"}
	}

	kdArray := make([]float64, n)
	var sumKD float64
	for i, m := range matches {
		k, _ := strconv.ParseFloat(m.Kills, 64)
		d, _ := strconv.ParseFloat(m.Deaths, 64)
		if d <= 0 {
			d = 1
		}
		kd := k / d
		kdArray[i] = kd
		sumKD += kd
	}

	meanKD := sumKD / float64(n)

	var sumSquaredDiffs float64
	for _, kd := range kdArray {
		diff := kd - meanKD
		sumSquaredDiffs += diff * diff
	}
	kdStdDev := math.Sqrt(sumSquaredDiffs / float64(n))

	rawScore := math.Max(0, 100.0-(kdStdDev*75.0))
	score := int(math.Round(rawScore))

	statusText := "Максимальна"
	colorHex := "#10b981"
	if score < 85 {
		statusText = "Висока"
		colorHex = "#3b82f6"
	}
	if score < 70 {
		statusText = "Середня"
		colorHex = "#f59e0b"
	}
	if score < 30 {
		statusText = "Низька"
		colorHex = "#ef4444"
	}

	return StabilityReport{
		Score:      score,
		StatusText: statusText,
		ColorHex:   colorHex,
		KDStdDev:   kdStdDev,
		MeanKD:     meanKD,
	}
}

func calculateClusters(matches []PlayerMatchStats) ClusterReport {
	n := len(matches)
	if n == 0 {
		return ClusterReport{}
	}

	var starPts, midPts, lowPts []ClusterPoint

	for i, m := range matches {
		k, _ := strconv.ParseFloat(m.Kills, 64)
		d, _ := strconv.ParseFloat(m.Deaths, 64)
		if d <= 0 {
			d = 1
		}
		kd := k / d
		adr, _ := strconv.ParseFloat(m.ADR, 64)

		pt := ClusterPoint{
			KD:         math.Round(kd*100) / 100,
			ADR:        math.Round(adr*10) / 10,
			MatchIndex: i,
		}

		if (kd >= 1.15 && adr >= 90) || kd >= 1.3 {
			pt.Cluster = 0
			starPts = append(starPts, pt)
		} else if (kd < 0.95 && adr < 65) || adr < 55 {
			pt.Cluster = 2
			lowPts = append(lowPts, pt)
		} else {
			pt.Cluster = 1
			midPts = append(midPts, pt)
		}
	}

	starPct := int(math.Round(float64(len(starPts)) / float64(n) * 100))
	midPct := int(math.Round(float64(len(midPts)) / float64(n) * 100))
	lowPct := int(math.Round(float64(len(lowPts)) / float64(n) * 100))

	return ClusterReport{
		StarPoints:  starPts,
		MidPoints:   midPts,
		LowPoints:   lowPts,
		StarPercent: starPct,
		MidPercent:  midPct,
		LowPercent:  lowPct,
	}
}

func simulateEloScenarios(currentElo int, matches []PlayerMatchStats, futureSteps int) EloScenariosReport {
	n := len(matches)
	if n == 0 || futureSteps <= 0 {
		return EloScenariosReport{CurrentElo: currentElo, PredictedElo: currentElo}
	}

	wins := 0
	for _, m := range matches {
		if isMatchWin(m) {
			wins++
		}
	}

	wr := float64(wins) / float64(n)
	if wr < 0.2 {
		wr = 0.2
	} else if wr > 0.8 {
		wr = 0.8
	}

	expWins := int(math.Round(float64(futureSteps) * wr))
	mcStdDev := int(math.Round(math.Sqrt(float64(futureSteps) * wr * (1 - wr))))

	optWins := expWins + mcStdDev + 1
	if optWins > futureSteps {
		optWins = futureSteps
	}

	pesWins := expWins - mcStdDev - 1
	if pesWins < 0 {
		pesWins = 0
	}

	expectedPath := generateDeterministicPath(currentElo, futureSteps, expWins)
	optimisticPath := generateDeterministicPath(currentElo, futureSteps, optWins)
	pessimisticPath := generateDeterministicPath(currentElo, futureSteps, pesWins)

	finalExp := currentElo
	if len(expectedPath) > 0 {
		finalExp = expectedPath[len(expectedPath)-1]
	}
	finalOpt := currentElo
	if len(optimisticPath) > 0 {
		finalOpt = optimisticPath[len(optimisticPath)-1]
	}
	finalPes := currentElo
	if len(pessimisticPath) > 0 {
		finalPes = pessimisticPath[len(pessimisticPath)-1]
	}

	return EloScenariosReport{
		CurrentElo:       currentElo,
		PredictedElo:     finalExp,
		ExpectedPath:     expectedPath,
		OptimisticPath:   optimisticPath,
		PessimisticPath:  pessimisticPath,
		FinalExpected:    finalExp,
		FinalOptimistic:  finalOpt,
		FinalPessimistic: finalPes,
		OptWins:          optWins,
		PesWins:          pesWins,
		ExpWins:          expWins,
		FutureSteps:      futureSteps,
	}
}

// generateDeterministicPath створює реалістичну траєкторію Elo без випадковості, щоб відповідь API була ідемпотентною
func generateDeterministicPath(startElo, totalSteps, winsCount int) []int {
	path := make([]int, totalSteps)
	current := startElo

	// Рівномірний розподіл перемог і поразок за алгоритмом Брезенхема
	accum := 0
	for i := 0; i < totalSteps; i++ {
		accum += winsCount
		if accum >= totalSteps {
			current += eloChangePerMatch
			accum -= totalSteps
		} else {
			current -= eloChangePerMatch
		}
		path[i] = current
	}

	return path
}

func calculateWinConditions(matches []PlayerMatchStats, avgADR float64) WinConditionsReport {
	n := len(matches)
	if n == 0 {
		return WinConditionsReport{}
	}

	totalWins := 0
	var highAdrMatches, highAdrWins int
	var highKdMatches, highKdWins int
	var highKillsMatches, highKillsWins int
	var highEntryMatches, highEntryWins int
	var highAssistMatches, highAssistWins int

	for _, m := range matches {
		isWin := isMatchWin(m)
		if isWin {
			totalWins++
		}

		adr, _ := strconv.ParseFloat(m.ADR, 64)
		if adr >= avgADR && avgADR > 0 {
			highAdrMatches++
			if isWin {
				highAdrWins++
			}
		}

		k, _ := strconv.ParseFloat(m.Kills, 64)
		d, _ := strconv.ParseFloat(m.Deaths, 64)
		if d <= 0 {
			d = 1
		}
		if (k / d) >= 1.15 {
			highKdMatches++
			if isWin {
				highKdWins++
			}
		}

		killsInt, _ := strconv.Atoi(m.Kills)
		if killsInt >= 18 {
			highKillsMatches++
			if isWin {
				highKillsWins++
			}
		}

		entryInt, _ := strconv.Atoi(m.FirstKills)
		if entryInt >= 2 {
			highEntryMatches++
			if isWin {
				highEntryWins++
			}
		}

		ast, _ := strconv.Atoi(m.Assists)
		if ast >= 5 {
			highAssistMatches++
			if isWin {
				highAssistWins++
			}
		}
	}

	baseline := int(math.Round(float64(totalWins) / float64(n) * 100))

	calcWR := func(wins, total int) int {
		if total == 0 {
			return 0
		}
		return int(math.Round(float64(wins) / float64(total) * 100))
	}

	highAdrWR := calcWR(highAdrWins, highAdrMatches)
	highKdWR := calcWR(highKdWins, highKdMatches)
	highKillsWR := calcWR(highKillsWins, highKillsMatches)
	highEntryWR := calcWR(highEntryWins, highEntryMatches)
	highAssistWR := calcWR(highAssistWins, highAssistMatches)

	getColor := func(wr, base int) string {
		if wr >= base+5 {
			return "text-green-400"
		}
		if wr <= base-5 {
			return "text-red-400"
		}
		return "text-yellow-400"
	}

	roundedADR := int(math.Round(avgADR))

	return WinConditionsReport{
		BaselineWinRate: baseline,
		HighADR: WinConditionMetric{
			Label:            fmt.Sprintf("ADR вище норми (≥%d)", roundedADR),
			Description:      fmt.Sprintf("Шкода за раунд вища за ваш середній показник (%d)", roundedADR),
			ThresholdVal:     strconv.Itoa(roundedADR),
			WinRate:          highAdrWR,
			DiffFromBaseline: highAdrWR - baseline,
			TotalMatches:     highAdrMatches,
			ColorClass:       getColor(highAdrWR, baseline),
		},
		HighKD: WinConditionMetric{
			Label:            "K/D більше 1.15",
			Description:      "Упевнений позитивний баланс кілів до смертей",
			ThresholdVal:     "1.15",
			WinRate:          highKdWR,
			DiffFromBaseline: highKdWR - baseline,
			TotalMatches:     highKdMatches,
			ColorClass:       getColor(highKdWR, baseline),
		},
		HighKills: WinConditionMetric{
			Label:            "18+ Кілів за гру",
			Description:      "Високий індивідуальний імпакт та фрагінг (MR12)",
			ThresholdVal:     "18",
			WinRate:          highKillsWR,
			DiffFromBaseline: highKillsWR - baseline,
			TotalMatches:     highKillsMatches,
			ColorClass:       getColor(highKillsWR, baseline),
		},
		HighEntry: WinConditionMetric{
			Label:            "2+ First Kills (Ентрі)",
			Description:      "Відкриття раундів першим фрагом у раунді",
			ThresholdVal:     "2",
			WinRate:          highEntryWR,
			DiffFromBaseline: highEntryWR - baseline,
			TotalMatches:     highEntryMatches,
			ColorClass:       getColor(highEntryWR, baseline),
		},
		HighAssists: WinConditionMetric{
			Label:            "5+ Асистів за гру",
			Description:      "Командна підтримка, асисти та спільні розміни",
			ThresholdVal:     "5",
			WinRate:          highAssistWR,
			DiffFromBaseline: highAssistWR - baseline,
			TotalMatches:     highAssistMatches,
			ColorClass:       getColor(highAssistWR, baseline),
		},
	}
}

// CalculatePlayActivity розраховує погодинний і поденний розподіл матчів та формує матрицю активності
func CalculatePlayActivity(matches []PlayerMatchStats) *PlayActivityReport {
	if len(matches) == 0 {
		return nil
	}

	now := time.Now()
	sixMonthsAgo := now.AddDate(0, -6, 0)
	sixMonthsAgo = time.Date(sixMonthsAgo.Year(), sixMonthsAgo.Month(), 1, 0, 0, 0, 0, sixMonthsAgo.Location())

	hours := make([]HourlyStat, 24)
	for i := 0; i < 24; i++ {
		hours[i].Hour = i
	}

	dayNames := []string{"Пн", "Вв", "Ср", "Чт", "Пт", "Сб", "Нд"}
	days := make([]DailyStat, 7)
	for i := 0; i < 7; i++ {
		days[i].DayName = dayNames[i]
	}

	matchCountsByDate := make(map[string]int)
	uniqueDays := make(map[string]bool)

	totalMatches := 0
	totalWins := 0
	currentMonthMatches := 0

	for i, m := range matches {
		matchTime := parseMatchTime(m, i)

		if matchTime.Before(sixMonthsAgo) {
			continue
		}

		totalMatches++
		isWin := isMatchWin(m)
		if isWin {
			totalWins++
		}

		hour := matchTime.Hour()
		hours[hour].Matches++
		if isWin {
			hours[hour].Wins++
		}

		// weekday: Sunday=0 -> 6, Monday=1 -> 0
		wd := int(matchTime.Weekday())
		jsDay := wd - 1
		if jsDay < 0 {
			jsDay = 6
		}
		days[jsDay].Matches++
		if isWin {
			days[jsDay].Wins++
		}

		dateStr := matchTime.Format("2006-01-02")
		uniqueDays[dateStr] = true
		matchCountsByDate[dateStr]++

		if matchTime.Month() == now.Month() && matchTime.Year() == now.Year() {
			currentMonthMatches++
		}
	}

	maxHour := 0
	maxHourVal := -1
	for i, h := range hours {
		if h.Matches > maxHourVal {
			maxHourVal = h.Matches
			maxHour = i
		}
	}

	ampm := "AM"
	displayHour := maxHour
	if maxHour >= 12 {
		ampm = "PM"
	}
	if maxHour > 12 {
		displayHour = maxHour - 12
	} else if maxHour == 0 {
		displayHour = 12
	}
	mostActiveHourDisplay := strconv.Itoa(displayHour) + ampm

	mostActiveHourWR := 0
	if maxHourVal > 0 {
		mostActiveHourWR = int(math.Round(float64(hours[maxHour].Wins) / float64(maxHourVal) * 100))
	}

	daysDiv := len(uniqueDays)
	if daysDiv <= 0 {
		daysDiv = 1
	}
	weeksDiv := float64(daysDiv) / 7.0
	if weeksDiv < 1.0 {
		weeksDiv = 1.0
	}

	monthNames := map[time.Month]string{
		time.January: "Січень", time.February: "Лютий", time.March: "Березень",
		time.April: "Квітень", time.May: "Травень", time.June: "Червень",
		time.July: "Липень", time.August: "Серпень", time.September: "Вересень",
		time.October: "Жовтень", time.November: "Листопад", time.December: "Грудень",
	}

	return &PlayActivityReport{
		TotalMatches:          totalMatches,
		TotalWins:             totalWins,
		UniqueDaysCount:       len(uniqueDays),
		CurrentMonthName:      monthNames[now.Month()],
		CurrentMonthMatches:   currentMonthMatches,
		MostActiveHour:        maxHour,
		MostActiveHourDisplay: mostActiveHourDisplay,
		MostActiveHourWinrate: mostActiveHourWR,
		AvgDailyMatches:       math.Round((float64(totalMatches)/float64(daysDiv))*10) / 10,
		AvgWeeklyMatches:      math.Round((float64(totalMatches)/weeksDiv)*10) / 10,
		HourlyDistribution:    hours,
		DailyDistribution:     days,
		MatchCountsByDate:     matchCountsByDate,
	}
}

func isMatchWin(m PlayerMatchStats) bool {
	res := m.Result
	if res == "" {
		res = m.I10
	}
	return res == "1" || res == "true"
}

func parseMatchTime(m PlayerMatchStats, fallbackIndex int) time.Time {
	extractTimestamp := func(val interface{}) int64 {
		if val == nil {
			return 0
		}
		switch v := val.(type) {
		case float64:
			return int64(v)
		case int64:
			return v
		case int:
			return int64(v)
		case string:
			if ts, err := strconv.ParseInt(v, 10, 64); err == nil {
				return ts
			}
			if t, err := time.Parse(time.RFC3339, v); err == nil {
				return t.Unix()
			}
		}
		return 0
	}

	ts := extractTimestamp(m.CreatedAt1)
	if ts == 0 {
		ts = extractTimestamp(m.UpdatedAt1)
	}
	if ts == 0 {
		ts = extractTimestamp(m.CreatedAt2)
	}
	if ts == 0 {
		ts = extractTimestamp(m.UpdatedAt2)
	}

	if ts > 0 {
		if ts > 10000000000 {
			ts /= 1000 // convert ms to seconds
		}
		return time.Unix(ts, 0)
	}

	// Fallback для синтетичних або тестових даних
	d := time.Now().AddDate(0, 0, -(fallbackIndex % 5))
	return time.Date(d.Year(), d.Month(), d.Day(), 12, 0, 0, 0, d.Location())
}
