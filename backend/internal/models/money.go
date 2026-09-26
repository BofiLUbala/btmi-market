package models

import (
	"fmt"
	"math"
	"strconv"
)

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

// CurrencySnapshot reads back a stored currency, treating the blank left by
// rows written before the column existed as the platform default.
func CurrencySnapshot(currency string) string {
	if currency == "" {
		return CurrencyUSD
	}
	return currency
}

// PercentOf applies a percentage to a base and rounds to the minor unit, so a
// 3% markup on 25.50 is exactly 0.77 rather than 0.7649999999999999.
func PercentOf(base, percent float64) float64 {
	return RoundMoney(base * percent / 100)
}

// FormatMoneyFR writes an amount the way the French-language notifications show
// it, in the currency the amount was actually priced in: 25,00 $ for USD and
// 25 000 FC for legacy CDF rows. Hardcoding a label here once told sellers a
// USD order was in FCFA.
func FormatMoneyFR(amount float64, currency string) string {
	code := CurrencySnapshot(currency)
	rounded := RoundMoney(amount)
	sign := ""
	if rounded < 0 {
		sign = "-"
		rounded = -rounded
	}
	whole := int64(rounded)
	cents := int64(math.Round((rounded - float64(whole)) * 100))
	digits := strconv.FormatInt(whole, 10)
	grouped := ""
	for i, r := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			grouped += " "
		}
		grouped += string(r)
	}
	number := grouped
	if code == CurrencyUSD || cents != 0 {
		number = fmt.Sprintf("%s,%02d", grouped, cents)
	}
	label := code
	switch code {
	case CurrencyUSD:
		label = "$"
	case CurrencyCDF:
		label = "FC"
	}
	return sign + number + " " + label
}
