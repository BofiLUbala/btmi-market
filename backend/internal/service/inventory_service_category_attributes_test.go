package service

import (
	"testing"

	"github.com/btmi-ai-market/backend/internal/models"
)

func TestVariantHasRequiredAttribute(t *testing.T) {
	definition := &models.CategoryAttributeDefinition{
		Key:     "shoe_size",
		LabelEn: "Shoe Size",
		LabelFr: "Pointure",
	}

	tests := []struct {
		name       string
		attributes map[string]string
		want       bool
	}{
		{name: "canonical key", attributes: map[string]string{"shoe_size": "42"}, want: true},
		{name: "localized label and case", attributes: map[string]string{"POINTURE": "42"}, want: true},
		{name: "english label", attributes: map[string]string{"Shoe Size": "42"}, want: true},
		{name: "blank value", attributes: map[string]string{"shoe_size": "  "}, want: false},
		{name: "unrelated value", attributes: map[string]string{"color": "Noir"}, want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := variantHasRequiredAttribute(test.attributes, definition); got != test.want {
				t.Fatalf("variantHasRequiredAttribute() = %v, want %v", got, test.want)
			}
		})
	}
}

func TestCanonicalizeVariantAttributes(t *testing.T) {
	defs := []*models.CategoryAttributeDefinition{
		{Key: "Color", LabelEn: "Color", LabelFr: "Couleur"},
		{Key: "Shoe Size", LabelEn: "Shoe Size", LabelFr: "Pointure"},
	}

	got := canonicalizeVariantAttributes(map[string]string{
		"Couleur":  "Bleu",
		"Pointure": "36",
	}, defs)
	if got["Color"] != "Bleu" || got["Shoe Size"] != "36" {
		t.Fatalf("canonicalizeVariantAttributes() = %#v", got)
	}
	if _, ok := got["Couleur"]; ok {
		t.Fatal("expected localized Couleur key to be rewritten")
	}

	preferred := canonicalizeVariantAttributes(map[string]string{
		"Color":    "Noir",
		"Couleur":  "Bleu",
		"Pointure": "40",
	}, defs)
	if preferred["Color"] != "Noir" {
		t.Fatalf("canonical key should win, got %#v", preferred)
	}
}
