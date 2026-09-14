package models

import "math"

// USD is the platform's selling currency. CDF remains only so historical rows
// keep saying what they always said; nothing new is priced in it.
const (
	CurrencyUSD = "USD"
	CurrencyCDF = "CDF"
)

// RoundMoney snaps an amount to the minor unit. Money is held as float64 across
// this codebase and DECIMAL(15,2) in PostgreSQL; rounding at every boundary
// where an amount is computed keeps the two from drifting apart (0.1 + 0.2
// must store as 0.30, not 0.30000000000000004).
func RoundMoney(amount float64) float64 {
	return math.Round(amount*100) / 100
}

// PercentOf applies a percentage to a base and rounds to the minor unit, so a
// 3% markup on 25.50 is exactly 0.77 rather than 0.7649999999999999.
func PercentOf(base, percent float64) float64 {
	return RoundMoney(base * percent / 100)
}
