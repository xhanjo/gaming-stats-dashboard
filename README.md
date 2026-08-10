# Gaming Stats Dashboard

![Go](https://img.shields.io/badge/go-%2300ADD8.svg?style=for-the-badge&logo=go&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)

Gaming Stats Dashboard is a high-performance analytics application designed to aggregate, process, and visualize CS2 player statistics. Built with Go and vanilla JavaScript, it integrates with the FACEIT Data API to perform deep analysis on player match history, calculate Elo regression models, and determine advanced playstyle roles (e.g., Entry Fragger, Anchor, Main AWPer).

## Architecture & Engineering Highlights

This project implements several advanced backend patterns to ensure high throughput and reliability:

- **Concurrent Worker Pool:** The application utilizes a highly optimized worker pool pattern (`sync.WaitGroup` with bounded goroutines and channels) to concurrently fetch and analyze dozens of matches simultaneously, drastically reducing external API aggregation time.
- **Local Data Warehouse (SQLite):** To bypass aggressive API rate limits and build historical datasets, SQLite is utilized as a localized data warehouse. It actively merges and stores up to 1,000 matches per player, persisting complex aggregated metrics (ADR, Entry Kills, Multi-kills) without repeatedly querying the external API.
- **Advanced Statistical Analysis:** The backend runs linear regression algorithms on historical match results to calculate `EloTrend` and `PredictedElo`. It also applies heuristic models to automatically classify a player's in-game role based on statistical averages.
- **Robust Testing Suite:** Critical business logic, API clients, storage interfaces, and HTTP handlers are heavily covered by Go's native testing framework (`*_test.go`), ensuring reliability in mathematical regressions and data parsing.
- **Zero-Dependency Frontend:** The UI is built entirely with vanilla JavaScript, HTML, and CSS to guarantee maximum rendering performance and zero bundle overhead.
- **Graceful Lifecycle Management:** The server strictly handles OS signals (SIGINT, SIGTERM) to execute graceful shutdowns, ensuring no ongoing SQLite transactions are corrupted during termination.

## Directory Structure

- `cmd/server/` - Application entry point and configuration.
- `internal/handlers/` - HTTP routing (`go-chi`) and REST API endpoints.
- `internal/faceit/` - API client, concurrency models, and statistical algorithms.
- `internal/storage/` - SQLite schema management and historical data merging.
- `frontend/` - Statically served assets and interactive data visualizations.

## Setup and Installation

### Prerequisites
- [Go 1.25+](https://golang.org/doc/install)
- FACEIT Developer API Key

### Running Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/gaming-stats-dashboard.git
   cd gaming-stats-dashboard
   ```

2. Configure environment variables (create a `.env` file):
   ```env
   FACEIT_API_KEY=your_api_key_here
   ```

3. Run the test suite:
   ```bash
   go test ./...
   ```

4. Start the server:
   ```bash
   go run cmd/server/main.go
   ```

5. Access the application:
   Open a web browser and navigate to `http://localhost:8080`.

## API Reference

### GET `/api/player/{nickname}?limit={int}`
Triggers the concurrent worker pool to fetch up to `{limit}` recent matches (default: 30, max: 200). If data is fresh (< 1 hour), it bypasses the external API and returns aggregated analytics directly from the SQLite warehouse.

## License

This project is licensed under the MIT License.
