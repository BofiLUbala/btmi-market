package search

import (
	"log"
	"sync"
	"time"
)

// SynonymEntry is one row of search_synonyms: Term belongs to the group named
// Canonical. All terms of a group are interchangeable.
type SynonymEntry struct {
	Term      string
	Canonical string
}

// SynonymSet answers "which words mean the same as this one?".
type SynonymSet struct {
	groupOf map[string]string
	members map[string][]string
}

// NewSynonymSet indexes entries. Terms are expected normalized; the
// search_synonyms CHECK constraints guarantee that for database rows.
func NewSynonymSet(entries []SynonymEntry) *SynonymSet {
	s := &SynonymSet{groupOf: map[string]string{}, members: map[string][]string{}}
	for _, e := range entries {
		if e.Term == "" || e.Canonical == "" {
			continue
		}
		s.groupOf[e.Term] = e.Canonical
		s.members[e.Canonical] = append(s.members[e.Canonical], e.Term)
	}
	// The canonical word is always part of its own group.
	for canonical := range s.members {
		if _, ok := s.groupOf[canonical]; !ok {
			s.groupOf[canonical] = canonical
			s.members[canonical] = append(s.members[canonical], canonical)
		}
	}
	return s
}

// Expand returns every member of term's group, term included, or nil.
func (s *SynonymSet) Expand(term string) []string {
	if s == nil {
		return nil
	}
	return s.members[s.groupOf[term]]
}

// SynonymCache keeps the synonym table in process memory. Synonyms change
// rarely, and keeping them here (rather than in Redis) means search keeps its
// synonyms when Redis is down. A failed reload keeps serving the last good set.
type SynonymCache struct {
	load func() ([]SynonymEntry, error)
	ttl  time.Duration

	mu       sync.Mutex
	set      *SynonymSet
	loadedAt time.Time
}

func NewSynonymCache(load func() ([]SynonymEntry, error), ttl time.Duration) *SynonymCache {
	return &SynonymCache{load: load, ttl: ttl}
}

// Get returns the current set, reloading it when older than the TTL.
func (c *SynonymCache) Get() *SynonymSet {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.set != nil && time.Since(c.loadedAt) < c.ttl {
		return c.set
	}
	entries, err := c.load()
	if err != nil {
		log.Printf("WARN: search synonyms reload failed, keeping previous set: %v", err)
		c.loadedAt = time.Now() // back off for one TTL instead of hammering the DB
		return c.set
	}
	c.set = NewSynonymSet(entries)
	c.loadedAt = time.Now()
	return c.set
}

// Invalidate forces the next Get to reload (after an admin edit).
func (c *SynonymCache) Invalidate() {
	c.mu.Lock()
	c.loadedAt = time.Time{}
	c.mu.Unlock()
}
