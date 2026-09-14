package models

import "github.com/google/uuid"

// Province / City / Commune model the real RDC administrative hierarchy that
// every delivery address is resolved against. Rows are seeded by migration 077.
type Province struct {
	ID     uuid.UUID `json:"id"`
	Code   string    `json:"code"`
	Name   string    `json:"name"`
	Active bool      `json:"active"`
}

type City struct {
	ID         uuid.UUID `json:"id"`
	ProvinceID uuid.UUID `json:"province_id"`
	Code       string    `json:"code"`
	Name       string    `json:"name"`
	Active     bool      `json:"active"`
}

type Commune struct {
	ID     uuid.UUID `json:"id"`
	CityID uuid.UUID `json:"city_id"`
	Code   string    `json:"code"`
	Name   string    `json:"name"`
	Active bool      `json:"active"`
}

// ResolvedAddress is the hierarchy triple validated together: a commune that
// really belongs to that city, in that province.
type ResolvedAddress struct {
	Province Province
	City     City
	Commune  Commune
}
