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

func TestMissingRequiredDefinitionsRulePatterns(t *testing.T) {
	requiredColor := &models.CategoryAttributeDefinition{Key: "Color", LabelEn: "Color", LabelFr: "Couleur", Required: true, Status: "ACTIVE"}
	requiredSize := &models.CategoryAttributeDefinition{Key: "Size", LabelEn: "Size", LabelFr: "Taille", Required: true, Status: "ACTIVE"}
	optionalMaterial := &models.CategoryAttributeDefinition{Key: "Material", LabelEn: "Material", LabelFr: "Matière", Status: "ACTIVE"}
	inactiveLegacy := &models.CategoryAttributeDefinition{Key: "Legacy", LabelEn: "Legacy", LabelFr: "Ancien", Required: true, Status: "INACTIVE"}

	tests := []struct {
		name     string
		defs     []*models.CategoryAttributeDefinition
		variants []map[string]string
		want     []string
	}{
		{name: "no requirements", defs: []*models.CategoryAttributeDefinition{optionalMaterial}, variants: []map[string]string{{}}, want: nil},
		{name: "one required missing", defs: []*models.CategoryAttributeDefinition{requiredColor}, variants: []map[string]string{{}}, want: []string{"Color"}},
		{name: "several required complete", defs: []*models.CategoryAttributeDefinition{requiredColor, requiredSize}, variants: []map[string]string{{"Color": "Noir", "Size": "M"}}, want: nil},
		{name: "optional remains optional", defs: []*models.CategoryAttributeDefinition{requiredColor, optionalMaterial}, variants: []map[string]string{{"Color": "Noir"}}, want: nil},
		{name: "every variant must be complete", defs: []*models.CategoryAttributeDefinition{requiredColor}, variants: []map[string]string{{"Color": "Noir"}, {}}, want: []string{"Color"}},
		{name: "localized alias accepted", defs: []*models.CategoryAttributeDefinition{requiredColor}, variants: []map[string]string{{"Couleur": "Bleu"}}, want: nil},
		{name: "blank does not satisfy", defs: []*models.CategoryAttributeDefinition{requiredColor}, variants: []map[string]string{{"Color": "  "}}, want: []string{"Color"}},
		{name: "no variant cannot publish required rule", defs: []*models.CategoryAttributeDefinition{requiredColor}, variants: nil, want: []string{"Color"}},
		{name: "inactive legacy rule ignored", defs: []*models.CategoryAttributeDefinition{inactiveLegacy}, variants: []map[string]string{{}}, want: nil},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, _ := missingRequiredDefinitions(test.defs, test.variants)
			if len(got) != len(test.want) {
				t.Fatalf("missingRequiredDefinitions() = %#v, want %#v", got, test.want)
			}
			for i := range got {
				if got[i] != test.want[i] {
					t.Fatalf("missingRequiredDefinitions() = %#v, want %#v", got, test.want)
				}
			}
		})
	}
}
