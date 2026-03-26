package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"github.com/xhanjo/gaming-stats-dashboard/internal/faceit"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Попередження: файл .env не знайдено...")
	}

	apiKey := os.Getenv("FACEIT_API_KEY")
	if apiKey == "" {
		log.Fatal("Критична помилка: FACEIT_API_KEY не знайдено!")
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		profile, err := faceit.GetPlayerProfile("xhanjo", apiKey)
		if err != nil {
			http.Error(w, fmt.Sprintf("Помилка отримання даних: %v", err), http.StatusInternalServerError)
			return
		}

		fmt.Fprintf(w, "Вітаю на дашборді!\n\n")
		fmt.Fprintf(w, "Гравець: %s (ID: %s)\n\n", profile.Nickname, profile.PlayerID)

		if cs2Stats, ok := profile.Games["cs2"]; ok {
			fmt.Fprintf(w, "=== Статистика CS2 ===\n")
			fmt.Fprintf(w, "Рівень (Lvl): %d\n", cs2Stats.SkillLevel)
			fmt.Fprintf(w, "Faceit Elo: %d\n\n", cs2Stats.FaceitElo)
		} else {
			fmt.Fprintf(w, "Статистику CS2 не знайдено.\n\n")
		}

		if dota2Stats, ok := profile.Games["dota2"]; ok {
			fmt.Fprintf(w, "=== Статистика Dota 2 ===\n")
			fmt.Fprintf(w, "Рівень (Lvl): %d\n", dota2Stats.SkillLevel)
			fmt.Fprintf(w, "Faceit Elo: %d\n", dota2Stats.FaceitElo)
		}
	})

	port := ":8080"
	fmt.Printf("Сервер запускається на порту %s...\n", port)

	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal("Помилка: ", err)
	}
}
