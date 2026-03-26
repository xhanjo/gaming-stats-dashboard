package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Вітаю, Сервер для аналітики CS2 успішно запущено і він готовий до роботи!")
	})

	port := ":8080"
	fmt.Printf("Сервер запускається на порту %s...\n", port)
	fmt.Printf("Відкрий у браузері посилання: http://localhost%s\n", port)

	err := http.ListenAndServe(port, nil)

	if err != nil {
		log.Fatal("Помилка запуску сервера: ", err)
	}
}
