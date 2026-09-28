package marketplace

import (
	"encoding/xml"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/btmi-ai-market/backend/internal/repository"
	"github.com/gin-gonic/gin"
)

// SEOHandler serves robots.txt and sitemap.xml for the public web app. Nginx
// maps /robots.txt and /sitemap.xml to these routes. It is independent of the
// internal search ranking: it only lists what is publicly visible.
type SEOHandler struct {
	repo    *repository.MarketplaceRepository
	baseURL string

	mu       sync.Mutex
	sitemap  []byte
	built    time.Time
	cacheTTL time.Duration
}

func NewSEOHandler(repo *repository.MarketplaceRepository, publicBaseURL string) *SEOHandler {
	return &SEOHandler{repo: repo, baseURL: strings.TrimRight(publicBaseURL, "/"), cacheTTL: time.Hour}
}

// Private areas are excluded; everything else (home, catalog, product and
// shop pages) may be crawled.
var robotsDisallow = []string{
	"/account", "/activate", "/activate-account", "/admin", "/cart", "/checkout", "/courier", "/employee",
	"/favorites", "/forgot-password", "/livreur", "/login", "/notifications", "/orders", "/points",
	"/register", "/reinitialize-registration", "/resend-activation", "/reset-password", "/reviews",
	"/search", "/seller", "/api/",
}

// GET /api/v1/seo/robots.txt
func (h *SEOHandler) Robots(c *gin.Context) {
	var b strings.Builder
	b.WriteString("User-agent: *\nAllow: /\n")
	for _, path := range robotsDisallow {
		b.WriteString("Disallow: " + path + "\n")
	}
	b.WriteString("\nSitemap: " + h.baseURL + "/sitemap.xml\n")
	c.Header("Cache-Control", "public, max-age=3600")
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(b.String()))
}

type sitemapURL struct {
	Loc     string `xml:"loc"`
	LastMod string `xml:"lastmod,omitempty"`
}

type sitemapURLSet struct {
	XMLName xml.Name     `xml:"urlset"`
	Xmlns   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

// GET /api/v1/seo/sitemap.xml
func (h *SEOHandler) Sitemap(c *gin.Context) {
	body, err := h.cachedSitemap()
	if err != nil {
		c.Status(http.StatusServiceUnavailable)
		return
	}
	c.Header("Cache-Control", "public, max-age=3600")
	c.Data(http.StatusOK, "application/xml; charset=utf-8", body)
}

func (h *SEOHandler) cachedSitemap() ([]byte, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.sitemap != nil && time.Since(h.built) < h.cacheTTL {
		return h.sitemap, nil
	}
	entries, err := h.repo.ListSitemapEntries(repository.MaxSitemapURLs - 3)
	if err != nil {
		if h.sitemap != nil {
			return h.sitemap, nil // serve the last good copy
		}
		return nil, err
	}
	set := sitemapURLSet{Xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9"}
	for _, path := range []string{"/", "/categories", "/shops"} {
		set.URLs = append(set.URLs, sitemapURL{Loc: h.baseURL + path})
	}
	for _, e := range entries {
		u := sitemapURL{Loc: h.baseURL + e.Path}
		if !e.LastMod.IsZero() {
			u.LastMod = e.LastMod.UTC().Format("2006-01-02")
		}
		set.URLs = append(set.URLs, u)
	}
	out, err := xml.MarshalIndent(set, "", "  ")
	if err != nil {
		return nil, err
	}
	h.sitemap = append([]byte(xml.Header), out...)
	h.built = time.Now()
	return h.sitemap, nil
}
