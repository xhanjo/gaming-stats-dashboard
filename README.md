# Gaming Stats Dashboard

![Go](https://img.shields.io/badge/go-%2300ADD8.svg?style=for-the-badge&logo=go&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Chart.js](https://img.shields.io/badge/chart.js-%23F5788D.svg?style=for-the-badge&logo=chart.js&logoColor=white)

**Gaming Stats Dashboard** is a high-performance CS2 analytics platform designed to aggregate, compute, and visualize player statistics. Built with a Go backend and a modular Vanilla JavaScript frontend (native ES6+ modules without build overhead), it integrates with the FACEIT Data API to perform statistical modeling, heuristic role clustering, deterministic Elo regression, and win-condition impact analysis.

---

## Architecture & Engineering Highlights

```
┌─────────────────────────────────────────────────────────────┐
│                 Client Layer (Browser)                      │
│   Native ES6+ Modules • Reactive Store • Chart.js Lifecycles │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON (CORS-enabled)
┌──────────────────────────────▼──────────────────────────────┐
│                    Go Backend Engine                        │
│   Chi Router • Context Propagation • Graceful Shutdown      │
├──────────────────────────────┬──────────────────────────────┤
│      Analytics Engine        │      FACEIT Worker Pool      │
│  Stability • Heuristics      │  Bounded Concurrency         │
│  Elo Trajectories • Win Cond │  Backoff & Rate Limit Retry  │
└──────────────────────────────┴──────────────┬───────────────┘
                                              │
                               ┌──────────────▼───────────────┐
                               │     SQLite Data Warehouse    │
                               │  WAL Mode • Busy Timeout 5s  │
                               │  MaxOpenConns(1) • Atomic Tx │
                               └──────────────────────────────┘
```

### 1. Backend Analytics Engine (`internal/faceit/analytics.go`)
Heavy business analytics and mathematical computations run server-side in Go as the Single Source of Truth:
- **K/D Stability Index (`CalculateStability`):** Computes mean, variance, and standard deviation of K/D across matches, mapping volatility to a normalized stability score (0–100%).
- **Rule-Based Impact Clustering (`CalculateClusters`):** Classifies matches into Carry, Average, and Low Impact tiers using esports performance thresholds.
- **Deterministic Elo Projections (`SimulateEloScenarios`):** Simulates future match trajectories (+10 matches) across Expected, Optimistic, and Pessimistic scenarios using Bresenham distribution for idempotent API responses.
- **Win Conditions Matrix (`CalculateWinConditions`):** Evaluates how exceeding key performance thresholds impacts victory probabilities vs. baseline win rate across 5 drivers:
  - ADR above personal average (`ADR ≥ player mean`)
  - Positive K/D ratio (`K/D ≥ 1.15`)
  - High fragging volume (`18+ Kills` in MR12)
  - Round opener impact (`2+ First Kills / Entry`)
  - Teamplay and trades (`5+ Assists`)
- **Activity & Heatmap Generation (`CalculatePlayActivity`):** Generates 24-hour and 7-day distribution matrices alongside a 6-month calendar activity matrix.

### 2. SQLite Concurrency & Storage (`internal/storage/db.go`)
- **WAL Mode & Single-Writer Optimization:** Configured with `_journal_mode=WAL`, `_busy_timeout=5000`, and `SetMaxOpenConns(1)` to eliminate `database is locked` errors during concurrent operations.
- **Parameterized & Atomic Transactions:** Employs parameterized queries and atomic transactions with deferred rollbacks (`defer tx.Rollback()`) to prevent SQL injection and transaction corruption.
- **Context-Aware I/O:** All queries execute via `QueryRowContext` and `ExecContext`, honoring client disconnections and timeouts.

### 3. Resilient API Client & Worker Pool (`internal/faceit/client.go`)
- **Bounded Concurrency:** Uses a worker pool pattern (`sync.WaitGroup` with buffered channels) bounded to 5 concurrent workers.
- **Rate Limit Resilience (HTTP 429):** Automatic exponential backoff retry mechanism with context-aware aborts on cancellation.
- **Strict HTTP Timeouts:** All external HTTP requests have explicit timeouts (`10s`) and propagate request contexts (`http.NewRequestWithContext`).

### 4. Modular Frontend Architecture (`frontend/src/`)
- **Native ES6+ Modules:** No webpack, Vite, or Node.js build steps needed. Runs natively in any modern browser.
- **Reactive State Store (`store.js`):** Lightweight centralized store with pub/sub architecture and persistent search history in `localStorage`.
- **Chart.js Lifecycle & Memory Safety (`chartManager.js`):** `destroyAllCharts()` explicitly frees canvas contexts, prevents memory leaks, and removes orphaned HTML tooltips.
- **Chronological 30-Match Timeline (`summaryTab.js`):** Summary tab restricts visual timelines to the latest 30 matches, ordered left-to-right (oldest on left, newest on right).
- **Error-Isolated Component Rendering (`main.js`):** Component renders are wrapped in isolated `try/catch` boundaries so rendering flaws in one tab never break the application shell.

---

## Directory Structure

```
gaming-stats-dashboard/
├── cmd/
│   └── server/
│       └── main.go                 # HTTP server, Chi router, CORS & Graceful Shutdown
├── internal/
│   ├── faceit/
│   │   ├── client.go               # FACEIT API client, worker pool & concurrency models
│   │   ├── client_test.go          # Worker pool & HTTP client tests
│   │   ├── analytics.go            # Statistical engine (Stability, Clusters, Elo, Win Conds)
│   │   ├── analytics_test.go       # Comprehensive analytics unit tests
│   │   └── calculate_test.go       # Table-driven recent form calculation tests
│   ├── handlers/
│   │   ├── player.go               # REST API endpoints & query parameter validation
│   │   └── player_test.go          # HTTP handler tests with mock database
│   └── storage/
│       ├── db.go                   # SQLite WAL connection pool & atomic transactions
│       └── db_test.go              # Database integration tests
├── frontend/
│   ├── index.html                  # Semantic application skeleton
│   ├── assets/                     # Maps, rank icons & static SVG badges
│   └── src/
│       ├── main.js                 # Application bootstrap & isolated error dispatch
│       ├── state/
│       │   └── store.js            # Centralized reactive state store
│       ├── api/
│       │   └── playerApi.js        # Network client with offline checks & error formatting
│       ├── utils/
│       │   ├── dom.js              # DOM helpers ($, show, hide, escapeHtml)
│       │   └── dates.js            # Date formatting and timestamp normalizers
│       ├── components/
│       │   ├── searchBar.js        # Player search, loading spinners, history tags & deep scan
│       │   ├── playerHeader.js     # Profile card, level 1–11 badges, country flag & steam link
│       │   ├── tabs.js             # Event-delegated tab navigation
│       │   ├── summaryTab.js       # 30-match chronological timeline, K/D trend & metric switch
│       │   ├── matchesTab.js       # Match history table with pagination ("Load more")
│       │   ├── mapsTab.js          # 5v5 map statistics and win rate progress bars
│       │   ├── activityTab.js      # Hourly/weekly bar charts & 6-month activity heatmap
│       │   └── analyticsTab.js     # Playstyle radar, stability gauge, cluster scatter, 6 win conditions
│       └── charts/
│           └── chartManager.js     # Chart.js instance lifecycle, universal & analytics tooltips
├── go.mod
├── go.sum
└── README.md
```

---

## Setup and Installation

### Prerequisites
- [Go 1.25+](https://golang.org/doc/install)
- [FACEIT Developer API Key](https://developers.faceit.com/)

### Running Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/xhanjo/gaming-stats-dashboard.git
   cd gaming-stats-dashboard
   ```

2. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   FACEIT_API_KEY=your_faceit_api_key_here
   ```

3. **Run automated test suite:**
   ```bash
   go test -v ./... -count=1
   ```

4. **Start the application server:**
   ```bash
   go run cmd/server/main.go
   ```

5. **Access the application:**
   Open `http://localhost:8080` in your web browser.
   *(Or launch `frontend/index.html` via VS Code Live Server at `http://127.0.0.1:5500` — CORS is automatically enabled).*

---

## API Reference

### `GET /api/player/{nickname}`

Fetches player overview, CS2 statistics, cached match history, and computed analytics reports.

#### Query Parameters:
| Parameter | Type | Default | Range | Description |
| :--- | :--- | :--- | :--- | :--- |
| `limit` | `int` | `30` | `1` – `200` | Number of recent matches to fetch and analyze (use `200` for Deep Scan). |

#### Response Structure (JSON):
```json
{
  "player_id": "uuid-string",
  "nickname": "PlayerName",
  "avatar": "https://...",
  "country": "ua",
  "steam_id_64": "76561198...",
  "games": {
    "cs2": {
      "skill_level": 10,
      "faceit_elo": 2463
    }
  },
  "stats": {
    "lifetime": {
      "Matches": "1250",
      "Win Rate %": "54%",
      "Average K/D Ratio": "1.22"
    },
    "segments": [...]
  },
  "recent_form": {
    "matches_analyzed": 30,
    "avg_kills": 19.4,
    "avg_adr": 87.2,
    "avg_hs_percentage": 52.0,
    "avg_kr_ratio": 0.88,
    "playstyle_role": "Entry Fragger",
    "predicted_elo": 2513,
    "elo_trend": 5.0,
    "analytics": {
      "playstyle": { "role": "...", "radar_scores": [...], "raw_radar_stats": [...] },
      "stability": { "score": 82, "status_text": "Висока", "color_hex": "#3b82f6", "kd_std_dev": 0.24 },
      "clustering": { "star_points": [...], "mid_points": [...], "low_points": [...] },
      "elo_scenarios": { "current_elo": 2463, "expected_path": [...], "optimistic_path": [...], "pessimistic_path": [...] },
      "win_conditions": {
        "baseline_win_rate": 59,
        "high_adr": { "label": "ADR вище норми (≥87)", "threshold_val": "87", "win_rate": 74, "diff_from_baseline": 15, "total_matches": 46 },
        "high_kd": { "label": "K/D більше 1.15", "threshold_val": "1.15", "win_rate": 84, "diff_from_baseline": 25, "total_matches": 45 },
        "high_kills": { "label": "18+ Кілів за гру", "threshold_val": "18", "win_rate": 81, "diff_from_baseline": 22, "total_matches": 42 },
        "high_entry": { "label": "2+ First Kills (Ентрі)", "threshold_val": "2", "win_rate": 76, "diff_from_baseline": 17, "total_matches": 38 },
        "high_assists": { "label": "5+ Асистів за гру", "threshold_val": "5", "win_rate": 68, "diff_from_baseline": 9, "total_matches": 59 }
      }
    },
    "activity": {
      "total_matches": 100,
      "hourly_distribution": [...],
      "daily_distribution": [...],
      "match_counts_by_date": { "2026-04-20": 4 }
    },
    "match_history": [...]
  }
}
```

---

## Quality & Verification Commands

```powershell
# Run backend unit tests
go test -v ./... -count=1

# Run Go static analyzer
go vet ./...

# Build binary
go build ./...

# Verify frontend JavaScript syntax
Get-ChildItem -Path frontend/src -Filter *.js -Recurse | ForEach-Object { node --check $_.FullName }
```

---

## License

This project is licensed under the [MIT License](LICENSE).
