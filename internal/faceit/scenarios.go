package faceit

import "math"

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
