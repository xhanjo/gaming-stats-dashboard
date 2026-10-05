package faceit

func CalculateStatsFromHistory(formHistory []PlayerMatchStats, currentElo int) *RecentForm {
	if len(formHistory) == 0 {
		return nil
	}

	var totalKills, totalADR, totalHS, totalKR, totalAssists float64
	var totalEntry, totalSniper, totalMulti int
	successfulMatches := len(formHistory)

	for _, stats := range formHistory {
		totalKills += parseFloatSafe(stats.Kills)
		totalADR += parseFloatSafe(stats.ADR)
		totalHS += parseFloatSafe(stats.HeadshotsPc)
		totalKR += parseFloatSafe(stats.KRRatio)
		totalAssists += parseFloatSafe(stats.Assists)
		totalEntry += parseIntSafe(stats.FirstKills)
		totalSniper += parseIntSafe(stats.SniperKills)

		// Рахуємо мультикіли для Опорника
		totalMulti += parseIntSafe(stats.TripleKills)
		totalMulti += parseIntSafe(stats.QuadroKills)
		totalMulti += parseIntSafe(stats.PentaKills)
	}

	avgSniper := float64(totalSniper) / float64(successfulMatches)
	avgEntry := float64(totalEntry) / float64(successfulMatches)
	avgAssists := totalAssists / float64(successfulMatches)
	avgADR := totalADR / float64(successfulMatches)
	avgHS := totalHS / float64(successfulMatches)
	avgMulti := float64(totalMulti) / float64(successfulMatches)

	role := DeterminePlaystyle(avgSniper, avgEntry, avgAssists, avgADR, avgHS, avgMulti)

	trendM, predictedElo := CalculateEloRegression(currentElo, formHistory)

	analytics := CalculateAnalytics(formHistory, currentElo, role, avgSniper, avgEntry, avgAssists, avgADR, avgHS, avgMulti)
	activity := CalculatePlayActivity(formHistory)

	return &RecentForm{
		MatchesAnalyzed:  successfulMatches,
		AvgKills:         totalKills / float64(successfulMatches),
		AvgADR:           avgADR,
		AvgHSPercentage:  avgHS,
		AvgKRRatio:       totalKR / float64(successfulMatches),
		TotalEntryKills:  totalEntry,
		TotalSniperKills: totalSniper,
		PlaystyleRole:    role,
		PredictedElo:     predictedElo,
		EloTrend:         trendM,
		Analytics:        analytics,
		Activity:         activity,
		MatchHistory:     formHistory,
	}
}
