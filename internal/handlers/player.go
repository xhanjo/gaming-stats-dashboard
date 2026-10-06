package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/xhanjo/gaming-stats-dashboard/internal/faceit"
)

type Database interface {
	GetPlayer(ctx context.Context, nickname string) (*faceit.PlayerProfile, error)
	SavePlayer(ctx context.Context, profile *faceit.PlayerProfile) error
}

type FaceitService interface {
	GetPlayerProfile(ctx context.Context, nickname string) (*faceit.PlayerProfile, error)
	GetCS2Stats(ctx context.Context, playerID string) (*faceit.CS2Stats, error)
	CalculateRecentForm(ctx context.Context, playerID string, limit, currentElo int) (*faceit.RecentForm, error)
}

const (
	defaultMatchLimit = 30
	maxMatchLimit     = 200
)

type errorResponse struct {
	Error string `json:"error"`
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(errorResponse{Error: message})
}

func GetPlayerStats(db Database, faceitSvc FaceitService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		ctx := r.Context()

		nickname := chi.URLParam(r, "nickname")
		if nickname == "" {
			writeJSONError(w, http.StatusBadRequest, "Будь ласка, вкажіть параметр nickname")
			return
		}

		limitStr := r.URL.Query().Get("limit")
		limit := defaultMatchLimit
		if limitStr != "" {
			l, err := strconv.Atoi(limitStr)
			if err != nil || l <= 0 || l > maxMatchLimit {
				writeJSONError(w, http.StatusBadRequest, fmt.Sprintf("Параметр limit має бути числом від 1 до %d", maxMatchLimit))
				return
			}
			limit = l
		}

		cachedProfile, dbErr := db.GetPlayer(ctx, nickname)

		isCacheValid := dbErr == nil && cachedProfile != nil &&
			(cachedProfile.LastUpdated.IsZero() || time.Since(cachedProfile.LastUpdated) < 1*time.Hour)

		// Якщо кеш свіжий (< 1 години), історія є, і користувач не просив глибокий аналіз (> 30) - віддаємо з БД
		if isCacheValid && limit <= defaultMatchLimit && cachedProfile.Recent != nil && len(cachedProfile.Recent.MatchHistory) > 0 {
			log.Printf("INFO: Дані для [%s] взяті з БАЗИ ДАНИХ (%d матчів)", nickname, len(cachedProfile.Recent.MatchHistory))
			if encErr := json.NewEncoder(w).Encode(cachedProfile); encErr != nil {
				log.Printf("WARN: Помилка відправки відповіді з кешу: %v", encErr)
			}
			return
		}

		if limit > defaultMatchLimit {
			log.Printf("INFO: Запущено ГЛИБОКИЙ АНАЛІЗ для [%s] (limit=%d)", nickname, limit)
		} else if dbErr == nil && cachedProfile != nil {
			log.Printf("INFO: Кеш застарів (останнє оновлення: %s). Оновлення нових матчів з Faceit API для [%s]...", cachedProfile.LastUpdated.Format("15:04:05"), nickname)
		} else {
			log.Printf("INFO: Кеш порожній. Перший запит до Faceit API для [%s] (limit=%d)...", nickname, limit)
		}

		profile, err := faceitSvc.GetPlayerProfile(ctx, nickname)
		if err != nil {
			log.Printf("CRITICAL: Помилка Faceit API: %v", err)
			// Якщо Faceit API недоступне (429/timeout), але в нас є дані в БД - віддаємо кеш як fallback!
			if cachedProfile != nil && cachedProfile.Recent != nil && len(cachedProfile.Recent.MatchHistory) > 0 {
				log.Printf("WARN: Повертаємо збережені дані з БД для [%s] через збій Faceit API", nickname)
				if encErr := json.NewEncoder(w).Encode(cachedProfile); encErr != nil {
					log.Printf("WARN: Помилка відправки fallback відповіді: %v", encErr)
				}
				return
			}
			if errors.Is(err, faceit.ErrNotFound) {
				writeJSONError(w, http.StatusNotFound, fmt.Sprintf("Гравця '%s' не знайдено на Faceit", nickname))
				return
			}
			writeJSONError(w, http.StatusInternalServerError, "Помилка зв'язку з Faceit API (429 або таймаут)")
			return
		}

		stats, err := faceitSvc.GetCS2Stats(ctx, profile.PlayerID)
		if err == nil {
			profile.Stats = stats
		} else if cachedProfile != nil && cachedProfile.Stats != nil {
			profile.Stats = cachedProfile.Stats
		} else {
			log.Printf("WARN: Не вдалося отримати загальну статистику: %v", err)
		}

		currentElo := 0
		if cs2Info, ok := profile.Games["cs2"]; ok {
			currentElo = cs2Info.FaceitElo
		}

		recentForm, err := faceitSvc.CalculateRecentForm(ctx, profile.PlayerID, limit, currentElo)
		if err != nil {
			log.Printf("WARN: Не вдалося розрахувати форму: %v", err)
		}

		// Об'єднуємо щойно отримані матчі з тими, що вже були збережені в базі даних
		var combinedHistory []faceit.PlayerMatchStats
		seenMatches := make(map[string]bool)

		if recentForm != nil {
			for _, m := range recentForm.MatchHistory {
				if m.MatchId != "" && !seenMatches[m.MatchId] {
					seenMatches[m.MatchId] = true
					combinedHistory = append(combinedHistory, m)
				} else if m.MatchId == "" {
					combinedHistory = append(combinedHistory, m)
				}
			}
		}

		if cachedProfile != nil && cachedProfile.Recent != nil {
			for _, m := range cachedProfile.Recent.MatchHistory {
				if m.MatchId != "" && !seenMatches[m.MatchId] {
					seenMatches[m.MatchId] = true
					combinedHistory = append(combinedHistory, m)
				} else if m.MatchId == "" {
					combinedHistory = append(combinedHistory, m)
				}
			}
		}

		if len(combinedHistory) > faceit.MaxHistorySize {
			combinedHistory = combinedHistory[:faceit.MaxHistorySize]
		}

		if len(combinedHistory) > 0 {
			profile.Recent = faceit.CalculateStatsFromHistory(combinedHistory, currentElo)
			log.Printf("INFO: Успішно розраховано форму на основі %d матчів (нові + кешовані)", profile.Recent.MatchesAnalyzed)
		} else if recentForm != nil {
			profile.Recent = recentForm
		}

		if profile.Recent != nil && len(profile.Recent.MatchHistory) > 0 {
			err = db.SavePlayer(ctx, profile)
			if err != nil {
				log.Printf("ERROR: Помилка збереження в БД: %v", err)
			} else {
				log.Printf("INFO: Дані гравця [%s] успішно збережено в БД", nickname)
			}
		} else {
			log.Printf("WARN: Дані не збережено в БД, оскільки історія матчів порожня")
		}

		if err := json.NewEncoder(w).Encode(profile); err != nil {
			log.Printf("WARN: Помилка відправки відповіді: %v", err)
		}
	}
}
