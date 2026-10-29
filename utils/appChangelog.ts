/** Historia funkcji dostępnych w lokalnym projekcie, od najnowszej aktualizacji. */
export interface AppChange {
  type: 'Nowość' | 'Ulepszenie';
  title: string;
  description: string;
  details?: 'orthography';
}

export interface AppRelease {
  id: string;
  date: string;
  title: string;
  changes: AppChange[];
}

export const APP_CHANGELOG: AppRelease[] = [
  {
    id: '2026-10-29',
    date: '2026-10-29',
    title: 'GPT-6.1, nowe motywy i Home 4.0',
    changes: [
      {
        type: 'Nowość',
        title: 'Home 4.0 i wspólny wygląd Luminy',
        description: 'Motyw oraz tryb jasny lub ciemny przechodzą między aplikacjami i stroną główną w tej samej przeglądarce. Kafelki Home mają pełną szerokość i obramowania, kolory oraz efekty najechania dopasowane do wybranego świata.',
      },
      {
        type: 'Nowość',
        title: 'GPT-6.1 Sol i Terra',
        description: 'Nowe modele we wszystkich listach wyboru. Przycisk Sprawdź modele na koncie odczytuje dostępność identyfikatorów bez generowania tekstu. Wspólny katalog rozróżnia ceny standardowe i długi kontekst ponad 272 tys. tokenów. Dostępny jest też GPT-6 Luna.',
      },
      {
        type: 'Ulepszenie',
        title: 'Zgodność parametrów z wybranym modelem',
        description: 'Temperature i pozostałe parametry próbkowania są wysyłane tylko przy obsługującym je modelu i poziomie rozumowania. GPT-5.2 Pro korzysta z wymaganego Responses API.',
      },
      {
        type: 'Nowość',
        title: 'Trzy nowe światy wizualne',
        description: 'Fantasy z pergaminem i ornamentami, techniczny Sci-fi oraz elegancki Noir. Każdy ma własne fonty, wzory, ornamentowane ramy okien i paneli oraz wersję jasną i ciemną. Przycisk Wygląd również przyjmuje wybraną oprawę. Klasyczny wygląd pozostaje dostępny.',
      },
      {
        type: 'Nowość',
        title: 'Personalizacja w panelu Wygląd',
        description: 'Wybieraj motyw i oświetlenie osobno, z podglądem na żywo i automatycznym zapisem preferencji. Personalizacja zmienia wyłącznie interfejs; nie wpływa na tekst, sposób pracy ani wyniki AI.',
      },
      {
        type: 'Nowość',
        title: 'Co nowego w Luminie',
        description: 'Wspólne miejsce na informacje o nowych funkcjach i ulepszeniach aplikacji. Kolejne aktualizacje znajdziesz tutaj, od najnowszej.',
      },
      {
        type: 'Nowość',
        title: 'Zasady pisowni obowiązujące od 2026 roku',
        description: 'Przegląd zmian Rady Języka Polskiego z przykładami, wyjątkami i wyszukiwarką. Uwzględnia wycofanie planowanej zmiany nazw typu „cieśnina Bosfor”.',
        details: 'orthography',
      },
      {
        type: 'Ulepszenie',
        title: 'Aktualna norma w pracy z tekstem',
        description: 'Instrukcje tłumaczenia, korekty, analizy, redakcji i tworzenia opisów uwzględniają pisownię 2026. Zawierają wskazówki o zachowaniu poprawnych wariantów, dosłownych cytatów i świadomej stylizacji.',
      },
    ],
  },
];
