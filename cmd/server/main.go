package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"

	"github.com/xhanjo/gaming-stats-dashboard/internal/handlers"
	"github.com/xhanjo/gaming-stats-dashboard/internal/storage"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Println("WARN: файл .env не знайдено, використовуються системні змінні...")
	}

	apiKey := os.Getenv("FACEIT_API_KEY")
	if apiKey == "" {
		log.Fatal("Критична помилка: FACEIT_API_KEY не знайдено!")
	}

	db, err := storage.New("stats.db")
	if err != nil {
		log.Fatal(err)
	}
	if err := db.InitTable(context.Background()); err != nil {
		log.Fatal(err)
	}

	log.Println("INFO: База даних SQLite успішно підключена!")

	port := os.Getenv("PORT")
	if port == "" {
		port = ":8080"
	} else if port[0] != ':' {
		port = ":" + port
	}

	r := chi.NewRouter()

	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-CSRF-Token")
			if req.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, req)
		})
	})

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Get("/api/player/{nickname}", handlers.GetPlayerStats(db, apiKey))

	fs := http.FileServer(http.Dir("./frontend"))
	r.Handle("/*", http.StripPrefix("/", fs))

	srv := &http.Server{
		Addr:    port,
		Handler: r,
	}

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		fmt.Printf("API Сервер успішно запущено! Порт %s\n", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Критична помилка сервера: %v", err)
		}
	}()

	<-stopChan
	log.Println("\nОтримано сигнал зупинки (Ctrl+C). Починаємо Graceful Shutdown...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Помилка під час зупинки HTTP-сервера: %v", err)
	} else {
		log.Println("HTTP-сервер успішно зупинено (нові запити відхилено).")
	}

	log.Println("Зберігаємо кеш та закриваємо з'єднання з базою даних SQLite...")
	if err := db.Close(); err != nil {
		log.Printf("ERROR: Помилка закриття БД: %v", err)
	} else {
		log.Println("Базу даних закрито успішно. Ваші дані в безпеці!")
	}

	log.Println("Програму успішно завершено.")
}
