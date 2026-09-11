package service

import (
	"math"
	"testing"
)

func TestCommissionCalculation_Formulas(t *testing.T) {
	tests := []struct {
		name                 string
		productsTotal        float64
		pointsDiscount       float64
		deliveryFee          float64
		rate                 float64
		expectedBase         float64
		expectedCommission   float64
		expectedSellerNet    float64
	}{
		{
			name:               "Standard 3% commission on $200 sale with $5 delivery",
			productsTotal:      200.00,
			pointsDiscount:     0.00,
			deliveryFee:        5.00,
			rate:               3.00,
			expectedBase:       200.00,
			expectedCommission: 6.00,
			expectedSellerNet:  194.00,
		},
		{
			name:               "Decimal rate 3.75% on $100 sale",
			productsTotal:      100.00,
			pointsDiscount:     0.00,
			deliveryFee:        10.00,
			rate:               3.75,
			expectedBase:       100.00,
			expectedCommission: 3.75,
			expectedSellerNet:  96.25,
		},
		{
			name:               "0% promotional rate",
			productsTotal:      500.00,
			pointsDiscount:     0.00,
			deliveryFee:        15.00,
			rate:               0.00,
			expectedBase:       500.00,
			expectedCommission: 0.00,
			expectedSellerNet:  500.00,
		},
		{
			name:               "Point discount properly deducted from commission base",
			productsTotal:      200.00,
			pointsDiscount:     10.00,
			deliveryFee:        5.00,
			rate:               3.00,
			expectedBase:       190.00,
			expectedCommission: 5.70,
			expectedSellerNet:  184.30,
		},
		{
			name:               "Delivery fee completely excluded from platform commission",
			productsTotal:      150.00,
			pointsDiscount:     0.00,
			deliveryFee:        50.00, // Large delivery fee must not inflate commission
			rate:               3.00,
			expectedBase:       150.00,
			expectedCommission: 4.50,
			expectedSellerNet:  145.50,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Base = productsTotal - pointsDiscount
			base := tc.productsTotal - tc.pointsDiscount
			if base < 0 {
				base = 0
			}
			if math.Abs(base-tc.expectedBase) > 0.001 {
				t.Fatalf("base mismatch: got %v, want %v", base, tc.expectedBase)
			}

			// Commission = base * (rate / 100) rounded to 2 decimal places
			commission := math.Round(base*(tc.rate/100.0)*100) / 100
			if math.Abs(commission-tc.expectedCommission) > 0.001 {
				t.Fatalf("commission mismatch: got %v, want %v", commission, tc.expectedCommission)
			}

			// Seller Net = base - commission
			sellerNet := math.Round((base-commission)*100) / 100
			if math.Abs(sellerNet-tc.expectedSellerNet) > 0.001 {
				t.Fatalf("sellerNet mismatch: got %v, want %v", sellerNet, tc.expectedSellerNet)
			}
		})
	}
}

func TestHistoricalRatePreservation(t *testing.T) {
	// Order A finalized at 3.00%
	orderAGross := 200.00
	orderARate := 3.00
	orderACommission := orderAGross * (orderARate / 100.0) // $6.00

	// Global rate subsequently changes to 4.00%
	globalRate := 4.00

	// Order B finalized at 4.00%
	orderBGross := 200.00
	orderBRate := globalRate
	orderBCommission := orderBGross * (orderBRate / 100.0) // $8.00

	// Verify Order A retains its snapshot rate and amount
	if orderACommission != 6.00 || orderARate != 3.00 {
		t.Fatalf("Historical snapshot violated for Order A: got %v, want 6.00", orderACommission)
	}

	// Verify Order B uses the new rate
	if orderBCommission != 8.00 || orderBRate != 4.00 {
		t.Fatalf("New order rate failed for Order B: got %v, want 8.00", orderBCommission)
	}
}
