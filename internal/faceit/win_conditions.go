package faceit

import (
	"fmt"
	"math"
	"strconv"
)

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

		adr := parseFloatSafe(m.ADR)
		if adr >= avgADR && avgADR > 0 {
			highAdrMatches++
			if isWin {
				highAdrWins++
			}
		}

		k := parseFloatSafe(m.Kills)
		d := parseFloatSafe(m.Deaths)
		if d <= 0 {
			d = 1
		}
		if (k / d) >= 1.15 {
			highKdMatches++
			if isWin {
				highKdWins++
			}
		}

		killsInt := parseIntSafe(m.Kills)
		if killsInt >= 18 {
			highKillsMatches++
			if isWin {
				highKillsWins++
			}
		}

		entryInt := parseIntSafe(m.FirstKills)
		if entryInt >= 2 {
			highEntryMatches++
			if isWin {
				highEntryWins++
			}
		}

		ast := parseIntSafe(m.Assists)
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
