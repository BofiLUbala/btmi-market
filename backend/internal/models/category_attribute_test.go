package models

import (
	"encoding/json"
	"testing"
)

func TestMissingAttributesError(t *testing.T) {
	err := &MissingAttributesError{
		CategorySlug:    "fashion",
		SubcategorySlug: "shoes",
		MissingKeys:     []string{"color", "shoe_size"},
		MissingLabelsFr: []string{"Couleur", "Pointure"},
	}

	expectedMsg := "Complétez les caractéristiques obligatoires avant de publier : Couleur, Pointure."
	if err.Error() != expectedMsg {
		t.Errorf("Error() = %q, want %q", err.Error(), expectedMsg)
	}

	bytes, jsonErr := json.Marshal(err)
	if jsonErr != nil {
		t.Fatalf("json.Marshal failed: %v", jsonErr)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(bytes, &parsed); err != nil {
		t.Fatalf("json.Unmarshal failed: %v", err)
	}

	if parsed["category"] != "fashion" {
		t.Errorf("category = %v, want fashion", parsed["category"])
	}
	if parsed["subcategory"] != "shoes" {
		t.Errorf("subcategory = %v, want shoes", parsed["subcategory"])
	}

	missingKeys, ok := parsed["missing_keys"].([]interface{})
	if !ok || len(missingKeys) != 2 {
		t.Fatalf("missing_keys invalid: %v", parsed["missing_keys"])
	}
	if missingKeys[0] != "color" || missingKeys[1] != "shoe_size" {
		t.Errorf("missing_keys = %v, want [color, shoe_size]", missingKeys)
	}

	missingFR, ok := parsed["missing_labels_fr"].([]interface{})
	if !ok || len(missingFR) != 2 {
		t.Fatalf("missing_labels_fr invalid: %v", parsed["missing_labels_fr"])
	}
	if missingFR[0] != "Couleur" || missingFR[1] != "Pointure" {
		t.Errorf("missing_labels_fr = %v, want [Couleur, Pointure]", missingFR)
	}
}

func TestCategoryAttributeDefinition(t *testing.T) {
	def := &CategoryAttributeDefinition{
		Key:              "color",
		LabelEn:          "Color",
		LabelFr:          "Couleur",
		Required:         true,
		VariantAttribute: true,
		InputType:        "TEXT",
		AllowedValues:    []string{"Black", "White", "Blue"},
		DisplayOrder:     1,
		Status:           "ACTIVE",
	}

	if def.Key != "color" || !def.Required || !def.VariantAttribute {
		t.Errorf("unexpected attribute definition values: %+v", def)
	}
}
