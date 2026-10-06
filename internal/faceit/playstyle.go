package faceit

import (
	"math"
)

// DeterminePlaystyle розраховує роль гравця на основі зваженого скорингу (Role Scoring Engine),
// що враховує мету CS2 (MR12), запобігає затіненню ролей каскадами if-else та узгоджений з радар-чартом.
func DeterminePlaystyle(avgKills, avgSniper, avgEntry, avgAssists, avgADR, avgHS, avgMulti float64) string {
	if avgKills <= 0 {
		avgKills = math.Max(1.0, avgSniper+avgEntry+10.0)
	}

	// 1. Частка снайперських кілів
	sniperShare := (avgSniper / avgKills) * 100.0

	// 2. Розрахунок скорингу ролей (0..100)

	// --- 🎯 Main AWPer ---
	// Висока кількість кілів з AWP (8+ за матч = 100) та значна частка від усіх кілів (38%+ = 100)
	normSniperVol := math.Min((avgSniper/7.5)*100.0, 100.0)
	normSniperShare := math.Min((sniperShare/38.0)*100.0, 100.0)
	awpScore := 0.50*normSniperVol + 0.50*normSniperShare
	if avgSniper < 4.0 {
		awpScore *= (avgSniper / 4.0)
	}

	// --- ⚡ Entry Fragger ---
	// Опенер: високий First Kills (у MR12 2.8+ це топ рівень) + темповий імпакт
	normEntry := math.Min((avgEntry/2.8)*100.0, 100.0)
	normEntryADR := math.Min((avgADR/82.0)*100.0, 100.0)
	entryScore := 0.70*normEntry + 0.30*normEntryADR
	if avgEntry < 1.8 {
		entryScore *= (avgEntry / 1.8)
	}
	if sniperShare > 30.0 {
		entryScore *= 0.70
	}

	// --- 🌟 Star Rifler ---
	// Головний рифлер/кері: високий ADR (92+) + точність хедшотів (58%+) + мультикіли на гвинтівках
	normStarADR := math.Min((avgADR/92.0)*100.0, 100.0)
	normStarHS := math.Min((avgHS/58.0)*100.0, 100.0)
	normStarMulti := math.Min((avgMulti/0.9)*100.0, 100.0)
	starScore := 0.50*normStarADR + 0.30*normStarHS + 0.20*normStarMulti
	if avgADR < 78.0 {
		starScore *= (avgADR / 78.0)
	}
	if sniperShare > 25.0 {
		starScore *= math.Max(0.2, 1.0-(sniperShare-25.0)/35.0)
	}

	// --- 🤝 Support ---
	// Гравці підтримки: фокус на асистах розкидками та розмінами (4.5+ у MR12 = 100)
	normAssists := math.Min((avgAssists/4.5)*100.0, 100.0)
	supportScore := normAssists
	if avgAssists < 3.5 {
		supportScore *= (avgAssists / 3.5)
	}
	if avgEntry > 2.2 || avgSniper > 3.5 {
		supportScore *= 0.80
	}

	// --- 🛡️ Anchor ---
	// Опорник пленту: зупиняє раші мультикілами (0.9+ = 100), грає пасивну позицію (Entry < 1.6), помірний ADR
	normAnchorMulti := math.Min((avgMulti/0.9)*100.0, 100.0)
	normAnchorADR := math.Min((avgADR/80.0)*100.0, 100.0)
	anchorScore := 0.65*normAnchorMulti + 0.35*normAnchorADR
	if avgMulti < 0.7 {
		anchorScore *= (avgMulti / 0.7)
	}
	if avgEntry > 1.6 {
		anchorScore *= math.Max(0.3, 1.0-(avgEntry-1.6)/1.5)
	}
	if avgADR > 92.0 {
		anchorScore *= 0.80 // при шаленому ADR гравець є кері/стар-рифлером, а не класичним опорником
	}
	if sniperShare > 25.0 {
		anchorScore *= 0.70
	}

	scores := map[string]float64{
		"Main AWPer":    awpScore,
		"Entry Fragger": entryScore,
		"Star Rifler":   starScore,
		"Support":       supportScore,
		"Anchor":        anchorScore,
	}

	// 3. Пошук домінуючої ролі
	bestRole := "Flex"
	maxScore := 0.0

	for role, score := range scores {
		if score > maxScore {
			maxScore = score
			bestRole = role
		}
	}

	// 4. Поріг виразності ролі (Dominance Threshold)
	// Якщо максимальний бал нижче 55, гравець є універсалом (Flex) без явного перекосу
	if maxScore < 55.0 {
		return "Flex"
	}

	return bestRole
}
