package main

import (
	"encoding/json" // Додали пакет для перетворення наших структур у JSON-відповідь
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	// УВАГА: перевір, чи тут правильна назва твого модуля
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

	// Змінили адресу маршруту на більш професійну: /api/player
	http.HandleFunc("/api/player", func(w http.ResponseWriter, r *http.Request) {

		// 1. Читаємо нікнейм з URL-адреси браузера (те, що йде після ?nickname=...)
		nickname := r.URL.Query().Get("nickname")

		// Якщо користувач не ввів нікнейм — сваримося і повертаємо помилку 400 (Bad Request)
		if nickname == "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			fmt.Fprintf(w, `{"error": "Будь ласка, вкажіть параметр nickname"}`)
			return
		}

		// 2. Йдемо на Faceit шукати саме цього гравця
		profile, err := faceit.GetPlayerProfile(nickname, apiKey)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintf(w, `{"error": "Гравця не знайдено або помилка API"}`)
			return
		}

		// 3. Віддаємо успішний результат!
		// Кажемо браузеру: "Увага, зараз полетить JSON, а не звичайний текст"
		w.Header().Set("Content-Type", "application/json")

		// Перетворюємо нашу структуру profile назад у JSON і відправляємо у w
		if err := json.NewEncoder(w).Encode(profile); err != nil {
			log.Println("Помилка конвертації в JSON:", err)
		}
	})

	port := ":8080"
	fmt.Printf("API Сервер запущено! Перевірте: http://localhost%s/api/player?nickname=xhanjo\n", port)

	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal("Помилка: ", err)
	}
}
