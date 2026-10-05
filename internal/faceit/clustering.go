package faceit

import "math"

func calculateClusters(matches []PlayerMatchStats) ClusterReport {
	n := len(matches)
	if n == 0 {
		return ClusterReport{}
	}

	var starPts, midPts, lowPts []ClusterPoint

	for i, m := range matches {
		k := parseFloatSafe(m.Kills)
		d := parseFloatSafe(m.Deaths)
		if d <= 0 {
			d = 1
		}
		kd := k / d
		adr := parseFloatSafe(m.ADR)

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
