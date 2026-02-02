<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1--djWHr_B4H9przIPviXM9qiGHIl4Ebj

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Zgłaszanie błędów i sugestii

Lumina Editor posiada wbudowany system feedbacku, który umożliwia:

- **Zgłaszanie błędów aplikacji** - kliknij ikonę "🐛" w nagłówku
- **Zgłaszanie nietrafnych poprawek** - kliknij prawym przyciskiem na błąd i wybierz "Zgłoś nietrafną poprawkę"
- **Sugestie ulepsze** - użyj modalu feedbacku aby podzielić się pomysłami

Każde zgłoszenie automatycznie dołącza:
- Plik LSF z pełną sesją edycji (tylko dla nietrafnych poprawek)
- Informacje o pliku i kontekście
- Szczegóły o systemie i przeglądarce

Zgłoszenia są wysyłane do centralnego serwera feedbacku lub zapisywane lokalnie jeśli serwer jest niedostępny.

