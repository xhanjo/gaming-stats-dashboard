package faceit

func CalculateEloRegression(currentElo int, matches []PlayerMatchStats) (float64, int) {
	if len(matches) <= 1 {
		return 0, currentElo
	}

	n := len(matches)
	eloHistory := make([]int, n)
	current := currentElo

	for i := 0; i < n; i++ {
		eloHistory[n-1-i] = current

		res := matches[i].Result
		isWin := res == "1" || res == "true"

		if isWin {
			current -= eloChangePerMatch
		} else {
			current += eloChangePerMatch
		}
	}

	var sumX, sumY, sumXY, sumX2 float64
	numPoints := float64(n)

	for i, elo := range eloHistory {
		x := float64(i + 1)
		y := float64(elo)
		sumX += x
		sumY += y
		sumXY += x * y
		sumX2 += x * x
	}

	denom := numPoints*sumX2 - sumX*sumX
	if denom == 0 {
		return 0, currentElo
	}

	m := (numPoints*sumXY - sumX*sumY) / denom
	b := (sumY - m*sumX) / numPoints

	predictedElo := m*(numPoints+1) + b

	return m, int(predictedElo)
}
