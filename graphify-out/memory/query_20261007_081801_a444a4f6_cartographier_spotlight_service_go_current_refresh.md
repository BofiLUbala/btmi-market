---
type: "query"
date: "2026-10-07T08:18:01.733956+00:00"
question: "Cartographier spotlight_service.go Current/refresh et la chaine de presence (presence_service, monitoring_service, main.go, presence.ts) avant de tester les deux correctifs"
contributor: "graphify"
outcome: "useful"
source_nodes: [".Current()", ".refresh()", "SpotlightService", ".Heartbeat()", "PresenceService", "MonitoringService", ".ListActiveSessions()", ".Summary()", "PresenceBeacon()"]
---

# Q: Cartographier spotlight_service.go Current/refresh et la chaine de presence (presence_service, monitoring_service, main.go, presence.ts) avant de tester les deux correctifs

## Answer

Expanded from original query via graph vocab: [spotlight, spotlights, current, refresh, marketplace, home, wide, pick] then [presence, monitoring, sessions, active, seen, heartbeat, online, platform, redis, users, summary]. The graph (AST of 28 Sep) held the PRE-fix shape and that is what made it useful: it showed the cycle .Current() <-> .refresh() inside spotlight_service.go, which is exactly the bug (every request rebuilt the pools). It also showed MonitoringService had no edge at all to PresenceService, confirming SetPresence is the new wiring. .Heartbeat() had no Redis edge beyond prune/visitorKey/knownKey, confirming presence:user:<uid> is new. A find the graph gave for free: web-app/src/lib/presence.tsx:46 is a SECOND presence beacon (the admin console) and it already excludes /admin paths, so a Direction admin viewing the sessions page does not count itself as online. Verified against the live API afterwards: spotlights 15ms cold / 4ms warm, three distinct products, no error card on the web home; presence last_active_at went 120.0 min -> 0.0 s after one heartbeat without the token row moving; redis key TTL 7.0 days; by_platform {web: 2} from the real browser app.

## Outcome

- Signal: useful

## Source Nodes

- .Current()
- .refresh()
- SpotlightService
- .Heartbeat()
- PresenceService
- MonitoringService
- .ListActiveSessions()
- .Summary()
- PresenceBeacon()