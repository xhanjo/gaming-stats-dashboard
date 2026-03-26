package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("Попередження: файл .env не знайдено, використовуються системні змінні")
	}

	faceitKey := os.Getenv("FACEIT_API_KEY")
	if faceitKey == "" {
		log.Fatal("Критична помилка: FACEIT_API_KEY не знайдено в оточенні!")
	}

	maskedKey := faceitKey
	if len(faceitKey) > 4 {
		maskedKey = faceitKey[:4] + "..."
	}
	fmt.Printf("Faceit API Key успішно завантажено: %s\n", maskedKey)

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Вітаю! Сервер працює, ключ Faceit підключено.")
	})

	port := ":8080"
	fmt.Printf("Сервер запускається на порту %s...\n", port)

	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal("Помилка запуску сервера: ", err)
	}
}
