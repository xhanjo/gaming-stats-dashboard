package faceit

func DeterminePlaystyle(avgSniper, avgEntry, avgAssists, avgADR, avgHS, avgMulti float64) string {
	if avgSniper >= 6.0 {
		return "Main AWPer"
	}
	if avgEntry >= 2.5 && avgADR >= 85.0 {
		return "Entry Fragger"
	}
	if avgMulti >= 0.8 && avgADR >= 80.0 {
		return "Anchor"
	}
	if avgHS >= 50.0 && avgADR >= 85.0 {
		return "Star Rifler"
	}
	if avgAssists >= 4.5 {
		return "Support"
	}
	return "Flex"
}
