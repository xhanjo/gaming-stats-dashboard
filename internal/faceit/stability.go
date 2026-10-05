package faceit

import "math"

func calculateStability(matches []PlayerMatchStats) StabilityReport {
	n := len(matches)
	if n == 0 {
		return StabilityReport{Score: 0, StatusText: "Низька", ColorHex: "#ef4444"}
	}

	kdArray := make([]float64, n)
	var sumKD float64
	for i, m := range matches {
		k := parseFloatSafe(m.Kills)
		d := parseFloatSafe(m.Deaths)
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
