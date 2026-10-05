package faceit

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
)

// CalculatePlayActivity розраховує погодинний і поденний розподіл матчів та формує матрицю активності для поточного часу
func CalculatePlayActivity(matches []PlayerMatchStats) *PlayActivityReport {
	return CalculatePlayActivityAt(matches, time.Now())
}

// CalculatePlayActivityAt розраховує активність відносно заданого моменту часу (для детермінованого тестування)
func CalculatePlayActivityAt(matches []PlayerMatchStats, now time.Time) *PlayActivityReport {
	if len(matches) == 0 {
		return nil
	}

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
	uniqueWeeks := make(map[string]bool)
	monthCounts := make(map[time.Month]int)
	matchTimes := make([]time.Time, len(matches))

	utcHours := make([]int, 24)
	utcWins := make([]int, 24)

	totalMatches := 0
	totalWins := 0

	for i, m := range matches {
		matchTime := parseMatchTimeAt(m, i, now)
		matchTimes[i] = matchTime

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

		utcH := matchTime.UTC().Hour()
		utcHours[utcH]++
		if isWin {
			utcWins[utcH]++
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

		y, w := matchTime.ISOWeek()
		uniqueWeeks[fmt.Sprintf("%d-W%02d", y, w)] = true

		monthCounts[matchTime.Month()]++
	}

	// 1. Пошук найактивнішої години:
	// FACEIT використовує стандартні 3-годинні інтервали UTC (..., 8-11, 11-14, 14-17, 17-20, 20-23).
	// Якщо знайдено інтервал із високою концентрацією матчів, беремо його вінрейт та пікову годину в локальному часі.
	bestWinStart := -1
	bestWinMatches := 0
	bestWinWins := 0
	for h := 2; h < 24; h += 3 {
		mCnt := 0
		wCnt := 0
		for offset := 0; offset < 3; offset++ {
			idx := (h + offset) % 24
			mCnt += utcHours[idx]
			wCnt += utcWins[idx]
		}
		if mCnt > bestWinMatches {
			bestWinMatches = mCnt
			bestWinWins = wCnt
			bestWinStart = h
		}
	}

	maxLocalHour := 0
	maxLocalHourVal := -1
	for i, h := range hours {
		if h.Matches > maxLocalHourVal {
			maxLocalHourVal = h.Matches
			maxLocalHour = i
		}
	}

	var mostActiveHour int
	var mostActiveHourWR float64

	if bestWinMatches > maxLocalHourVal && bestWinMatches >= 3 {
		peakUtc := (bestWinStart + 1) % 24
		maxUtcInWin := 0
		for offset := 0; offset < 3; offset++ {
			idx := (bestWinStart + offset) % 24
			if utcHours[idx] > maxUtcInWin {
				maxUtcInWin = utcHours[idx]
				peakUtc = idx
			}
		}
		loc := now.Location()
		if len(matchTimes) > 0 {
			loc = matchTimes[0].Location()
		}
		sampleT := time.Date(now.Year(), now.Month(), now.Day(), peakUtc, 0, 0, 0, time.UTC).In(loc)
		mostActiveHour = sampleT.Hour()
		mostActiveHourWR = math.Round((float64(bestWinWins)/float64(bestWinMatches)*100)*10) / 10
	} else {
		mostActiveHour = maxLocalHour
		if maxLocalHourVal > 0 {
			mostActiveHourWR = math.Round((float64(hours[maxLocalHour].Wins)/float64(maxLocalHourVal)*100)*10) / 10
		}
	}

	mostActiveHourDisplay := formatHourDisplay(mostActiveHour)

	// 2. Розрахунок середньої кількості матчів на день та тренду
	daysDiv := len(uniqueDays)
	if daysDiv <= 0 {
		daysDiv = 1
	}
	avgDailyMatches := math.Round(float64(totalMatches) / float64(daysDiv))

	trendDelta, trendDisplay, trendDirection := calculateDailyTrend(matchTimes)

	// 3. Розрахунок середньої кількості матчів на тиждень (за унікальними ISO календарними тижнями)
	weeksDiv := float64(len(uniqueWeeks))
	if weeksDiv <= 0 {
		weeksDiv = 1.0
	}
	avgWeeklyMatches := math.Round((float64(totalMatches)/weeksDiv)*10) / 10

	monthNames := map[time.Month]string{
		time.January: "січень", time.February: "лютий", time.March: "березень",
		time.April: "квітень", time.May: "травень", time.June: "червень",
		time.July: "липень", time.August: "серпень", time.September: "вересень",
		time.October: "жовтень", time.November: "листопад", time.December: "грудень",
	}

	mostActiveMonth := now.Month()
	maxMonthMatches := 0
	for m, count := range monthCounts {
		if count > maxMonthMatches {
			maxMonthMatches = count
			mostActiveMonth = m
		}
	}

	activeMonthName := monthNames[mostActiveMonth]
	if maxMonthMatches == 0 {
		activeMonthName = monthNames[now.Month()]
	}

	return &PlayActivityReport{
		TotalMatches:           totalMatches,
		TotalWins:              totalWins,
		UniqueDaysCount:        len(uniqueDays),
		CurrentMonthName:       activeMonthName,
		CurrentMonthMatches:    maxMonthMatches,
		MostActiveMonthName:    activeMonthName,
		MostActiveMonthMatches: maxMonthMatches,
		MostActiveHour:         mostActiveHour,
		MostActiveHourDisplay:  mostActiveHourDisplay,
		MostActiveHourWinrate:  mostActiveHourWR,
		AvgDailyMatches:        avgDailyMatches,
		DailyTrendDelta:        trendDelta,
		DailyTrendDisplay:      trendDisplay,
		DailyTrendDirection:    trendDirection,
		AvgWeeklyMatches:       avgWeeklyMatches,
		HourlyDistribution:     hours,
		DailyDistribution:      days,
		MatchCountsByDate:      matchCountsByDate,
	}
}

func formatHourDisplay(h int) string {
	ampm := "дп"
	d := h
	if h >= 12 {
		ampm = "пп"
	}
	if h > 12 {
		d = h - 12
	} else if h == 0 {
		d = 12
	}
	return fmt.Sprintf("%d%s", d, ampm)
}

func calculateDailyTrend(matchTimes []time.Time) (float64, string, string) {
	if len(matchTimes) < 2 {
		return 0, "", ""
	}

	latest := matchTimes[0]
	for _, mt := range matchTimes {
		if mt.After(latest) {
			latest = mt
		}
	}

	w1Start := latest.AddDate(0, 0, -14)
	w2Start := latest.AddDate(0, 0, -28)

	p1Matches, p2Matches := 0, 0
	p1Days := make(map[string]bool)
	p2Days := make(map[string]bool)

	for _, mt := range matchTimes {
		dStr := mt.Format("2006-01-02")
		if mt.After(w1Start) && !mt.After(latest) {
			p1Matches++
			p1Days[dStr] = true
		} else if mt.After(w2Start) && !mt.After(w1Start) {
			p2Matches++
			p2Days[dStr] = true
		}
	}

	var delta float64
	if len(p1Days) > 0 && len(p2Days) > 0 {
		avg1 := float64(p1Matches) / float64(len(p1Days))
		avg2 := float64(p2Matches) / float64(len(p2Days))
		delta = avg1 - avg2
	} else if len(p1Days) > 0 {
		allDays := make(map[string]bool)
		for _, mt := range matchTimes {
			allDays[mt.Format("2006-01-02")] = true
		}
		overall := float64(len(matchTimes)) / float64(len(allDays))
		avg1 := float64(p1Matches) / float64(len(p1Days))
		delta = avg1 - overall
	}

	deltaRounded := math.Round(math.Abs(delta)*10) / 10
	valStr := strings.Replace(fmt.Sprintf("%.1f", deltaRounded), ".", ",", 1)

	if delta < -0.05 {
		return -deltaRounded, fmt.Sprintf("↓ %s", valStr), "down"
	} else if delta > 0.05 {
		return deltaRounded, fmt.Sprintf("↑ %s", valStr), "up"
	}
	return 0, "", ""
}

func isMatchWin(m PlayerMatchStats) bool {
	res := m.Result
	if res == "" {
		res = m.I10
	}
	return res == "1" || res == "true"
}

func parseMatchTime(m PlayerMatchStats, fallbackIndex int) time.Time {
	return parseMatchTimeAt(m, fallbackIndex, time.Now())
}

func parseMatchTimeAt(m PlayerMatchStats, fallbackIndex int, refTime time.Time) time.Time {
	extractTimestamp := func(val any) int64 {
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
	d := refTime.AddDate(0, 0, -(fallbackIndex % 5))
	return time.Date(d.Year(), d.Month(), d.Day(), 12, 0, 0, 0, d.Location())
}
