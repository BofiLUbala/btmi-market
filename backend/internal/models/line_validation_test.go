package models

import (
	"strings"
	"testing"

	"github.com/gin-gonic/gin/binding"
)

// Request bodies carrying lines must validate every line, not only the list length:
// without `dive` a zero or negative quantity reached pricing and stock code.
func TestLineItemsAreValidatedOneByOne(t *testing.T) {
	cart := func(q int) []CartLineInput {
		return []CartLineInput{{ProductID: "p", VariantID: "v", ShopID: "s", Quantity: q}}
	}
	order := func(q int) []OrderLineInput {
		return []OrderLineInput{{ProductID: "p", VariantID: "v", Quantity: q}}
	}
	receipt := func(q int) []ReceiptLineInput {
		return []ReceiptLineInput{{VariantID: "v", Quantity: q}}
	}

	for _, q := range []int{-2, 0} {
		cases := map[string]interface{}{
			"cart preview":   &CartPreviewRequest{Items: cart(q)},
			"checkout":       &CheckoutCreateRequest{Items: cart(q)},
			"shop order":     &CreateOrderRequest{Lines: order(q)},
			"buyer order":    &BuyerCreateOrderRequest{Items: order(q)},
			"points preview": &PointRedemptionPreviewRequest{Items: order(q)},
			"stock receipt":  &CreateReceiptRequest{ShopID: "s", Lines: receipt(q)},
		}
		for name, req := range cases {
			err := binding.Validator.ValidateStruct(req)
			if err == nil || !strings.Contains(err.Error(), ".Quantity") {
				t.Errorf("%s: quantity %d not rejected on the line (err: %v)", name, q, err)
			}
		}
	}

	valid := map[string]interface{}{
		"cart preview":  &CartPreviewRequest{Items: cart(1)},
		"stock receipt": &CreateReceiptRequest{ShopID: "s", Lines: receipt(3)},
	}
	for name, req := range valid {
		if err := binding.Validator.ValidateStruct(req); err != nil {
			t.Errorf("%s rejected a valid line: %v", name, err)
		}
	}
}
