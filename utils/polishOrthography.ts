/**
 * Wspólna baza normy RJP obowiązującej od 2026-01-01.
 * Kopie w aplikacjach: node scripts/sync-polish-orthography.mjs
 * Osobne kopie umożliwiają niezależne kompilacje i obrazy Docker.
 */
export const ORTHOGRAPHY_VERIFIED_ON = '2026-10-29';
export const ORTHOGRAPHY_SOURCES = [
  { title: 'RJP: komunikat z 7 listopada 2025 r. (z korektą reformy)', url: 'https://rjp.pan.pl/komunikat-rady-jezyka-polskiego-przy-prezydium-pan-z-dnia-7-listopada-2025-r/' },
  { title: 'RJP: Zasady pisowni i interpunkcji polskiej — tekst jednolity', url: 'https://rjp.pan.pl/app/uploads/2026/03/Zalacznik-do-komunikatu-11-25-wersja-ostateczna-jednolita.pdf' },
];

export const POLISH_ORTHOGRAPHY_RULES = [
  {
    id: 'residents', reference: '1', title: 'Nazwy mieszkańców',
    rule: 'Nazwy mieszkańców miast, dzielnic, osiedli i wsi zaczynamy wielką literą.',
    examples: ['Krakowianin oprowadzał Łodziankę po mieście.', 'Mokotowianka spotkała Chochołowianina.'],
    caution: 'Przymiotniki nadal małą literą: krakowski rynek, łódzka ulica.',
  },
  {
    id: 'ethnic-names', reference: '1', title: 'Nieoficjalne nazwy etniczne',
    rule: 'Dopuszczalna jest mała albo wielka litera w nieoficjalnych nazwach etnicznych.',
    examples: ['angol / Angol', 'jugol / Jugol'],
    caution: 'Warianty dotyczą pisowni; określenia mogą mieć wydźwięk potoczny lub obraźliwy.',
  },
  {
    id: 'brands', reference: '2', title: 'Marki, modele i egzemplarze',
    rule: 'Wielką literę zachowujemy w nazwach firm, marek i modeli także wtedy, gdy nazwa oznacza pojedynczy egzemplarz produktu.',
    examples: ['Sprzedała starego Fiata.', 'Przed garażem stała czerwona Toyota.'],
    caution: 'Nie rozszerzaj reguły na pospolite nazwy przedmiotów.',
  },
  {
    id: 'conditional', reference: '3', title: 'Cząstki trybu przypuszczającego',
    rule: 'Cząstki -bym, -byś, -by, -byśmy, -byście piszemy oddzielnie od spójników.',
    examples: ['Zapytał, czy byśmy przyszli wcześniej.', 'Poszłaby pieszo albo by zamówiła taksówkę.'],
    caution: 'Zachowujemy odrębne wyrazy: aby, żeby, gdyby, choćby, jakby, czyżby. Nadal łącznie z osobową formą czasownika: przeczytałbym, poszłabyś.',
  },
  {
    id: 'participles', reference: '4', title: '„Nie” z imiesłowami odmiennymi',
    rule: 'Nie z imiesłowem przymiotnikowym piszemy łącznie, także przy znaczeniu czynnościowym. Zniesiono wyjątek pozwalający na świadomą pisownię rozdzielną.',
    examples: ['Wciąż nieprzeczytana książka czekała na biurku.', 'List niepodpisany przez nadawcę trafił do archiwum.'],
    caution: 'Ogólne wyjątki nadal działają: nie podpisany, lecz parafowany; wcale nie zmartwiony. Imiesłowy przysłówkowe rozdzielnie: nie czytając, nie przeczytawszy.',
  },
  {
    id: 'personal-adjectives', reference: '5', title: 'Przymiotniki od nazw osobowych',
    rule: 'Przymiotniki od nazw osobowych piszemy małą literą niezależnie od znaczenia dzierżawczego lub jakościowego. Dla form na -owy, -in (-yn), -ów od imion, rzadziej nazwisk, dopuszczalne są obie wielkości liter.',
    examples: ['Czytała dramat szekspirowski i dialog platoński.', 'zosina książka / Zosina książka', 'jackowy plecak / Jackowy plecak'],
    caution: 'Reguła nie znosi wielkich liter wymaganych w nazwach własnych i na początku zdania.',
  },
  {
    id: 'half', reference: '6', title: 'Połączenia z „pół”',
    rule: 'Pół zapisujemy łącznie także w parach składających się na jedno pojęcie. Przed nazwą pisaną wielką literą stosujemy łącznik.',
    examples: ['Półżartem, półserio zaproponował wyprawę.', 'Półspała, półczuwała przy oknie.', 'Była to półzabawa, półnauka.', 'Była pół-Polką, pół-Włoszką.'],
    caution: 'Miara lub ilość nadal rozdzielnie: pół godziny, pół chleba.',
  },
  {
    id: 'word-pairs', reference: '7', title: 'Pary podobnych wyrazów',
    rule: 'Zwyczajowe połączenia równorzędnych, podobnie lub identycznie brzmiących wyrazów dopuszczają łącznik, przecinek albo sam odstęp.',
    examples: ['tuż-tuż / tuż, tuż / tuż tuż', 'trzask-prask / trzask, prask / trzask prask'],
    caution: 'To warianty poprawne. Zasada nie dotyczy dowolnych zestawień ani przymiotników typu biało-czerwony.',
  },
  {
    id: 'comets', reference: '8a', title: 'Nazwy komet',
    rule: 'W nazwach komet wszystkie człony rozpoczynamy wielką literą.',
    examples: ['Obserwowaliśmy Kometę Halleya.', 'Badano orbitę Komety Enckego.'],
    caution: 'Pospolite określenie bez nazwy własnej nadal małą literą: jasna kometa.',
  },
  {
    id: 'public-places', reference: '8c', title: 'Obiekty przestrzeni publicznej',
    rule: 'Wyraz rozpoczynający nazwę własną obiektu, np. park, plac, most, kościół, osiedle lub pałac, piszemy wielką literą. Wyjątkiem pozostaje ulica.',
    examples: ['Spotkajmy się przy Moście Poniatowskiego.', 'Mijali Park Kościuszki i Plac Zbawiciela.', 'Skręciła w ulicę Długą.'],
    caution: 'Wielka litera dotyczy nazwy własnej, nie opisu: pobliski park, stary most, wiejski kościół.',
  },
  {
    id: 'venues', reference: '8d', title: 'Lokale i punkty usługowe',
    rule: 'W wielowyrazowych nazwach lokali usługowych i gastronomicznych wielką literę mają wszystkie człony z wyjątkiem przyimków i spójników.',
    examples: ['Zarezerwowali pokój w Hotelu pod Różą.', 'Weszli do Apteki pod Orłem.'],
    caution: 'Opisowe określenie nie staje się nazwą własną: apteka za rogiem.',
  },
  {
    id: 'awards', reference: '8e', title: 'Nagrody, odznaczenia i tytuły',
    rule: 'W nazwach orderów, medali, odznaczeń, nagród i tytułów honorowych wielką literą zapisujemy człony poza przyimkami, spójnikami i wyrazami typu imienia (im.).',
    examples: ['Otrzymała Nagrodę Nobla.', 'Zdobył tytuł Honorowego Obywatela Miasta Krakowa.', 'Nagroda im. Jana Karskiego i Poli Nireńskiej'],
    caution: 'Pospolite użycie pozostaje małą literą: nagroda za udział.',
  },
  {
    id: 'prefixes', reference: '9', title: 'Przedrostki i człony typu „super”',
    rule: 'Przedrostki łączymy z wyrazem pisanym małą literą; przed wielką literą używamy łącznika. Człony samodzielne, np. super, ekstra, eko, wege, mini, maksi, midi, mega, makro, mikro, turbo, dopuszczają także zapis rozdzielny z rzeczownikami, przymiotnikami i przysłówkami.',
    examples: ['arcy-Europejczyk', 'superpomysł / super pomysł', 'ekskluzywna ekożywność / ekskluzywna eko żywność', 'super-Polak / super Polak'],
    caution: 'Utrwalone terminy zachowują zapis łączny: supermarket, makroekonomia. Przed czasownikiem, zaimkiem i liczebnikiem te samodzielne człony piszemy rozdzielnie: ekstra zapłacić, super my.',
  },
  {
    id: 'niby-quasi', reference: '10', title: '„Niby-” i „quasi-”',
    rule: 'Cząstki niby- i quasi- zapisujemy łącznie z wyrazami rozpoczynanymi małą literą; przed wielką literą zostawiamy łącznik.',
    examples: ['nibyekspert, nibyromantyczny', 'quasinauka, quasiartystyczny', 'niby-Polak, quasi-Anglia'],
    caution: 'Odróżniaj cząstkę od samodzielnego niby: Chmury wyglądały niby statki.',
  },
  {
    id: 'negation-degrees', reference: '11', title: '„Nie” we wszystkich stopniach',
    rule: 'Nie z przymiotnikami i przysłówkami odprzymiotnikowymi piszemy łącznie także w stopniu wyższym i najwyższym.',
    examples: ['Ten pokój był niewiększy od poprzedniego.', 'Po naprawie silnik działał nielepiej.', 'To nienajłatwiejszy wybór.'],
    caution: 'Zachowuj wyjątki: nie tańszy, lecz droższy; wcale nie lepszy. Nadal rozdzielnie: nie bardzo, nie dość, nie można.',
  },
  {
    id: 'geography-withdrawn', reference: '8b — wycofany', title: 'Nazwy geograficzne: wycofana zmiana',
    rule: 'RJP wycofała planowaną zmianę 27 października 2025 r. Określenie gatunkowe przed nazwą w mianowniku nadal zaczynamy małą literą.',
    examples: ['Przepłynęli przez cieśninę Bosfor.', 'Spędzili wakacje nad jeziorem Śniardwy.', 'Morze Bałtyckie, ale morze Bałtyk'],
    caution: 'Nie traktuj zapisu Cieśnina Bosfor ani Jezioro Śniardwy jako nowych wariantów normy (poza wielką literą wymaganą np. początkiem zdania).',
  },
];

export const POLISH_ORTHOGRAPHY_PROMPT = [
  'NORMA ORTOGRAFICZNA JĘZYKA POLSKIEGO OD 1 STYCZNIA 2026 R. (RJP; z korektą z 7 listopada 2025 r.).',
  'Stosuj tę normę w tworzonych polskich tekstach i proponowanych poprawkach. Przestrzegaj zakresu zadania i włączonych kategorii kontroli; same reguły nie włączają sprawdzania ortografii.',
  'Nie zgłaszaj poprawnych wariantów jako błędów i nie ujednolicaj ich bez polecenia. W uzasadnieniach korekty wskaż konkretną regułę. Nie zmieniaj pól original ani evidence, dosłownych cytatów źródłowych, tytułów bibliograficznych ani świadomej stylizacji. Tłumaczenie cytatu na polski i nowo tworzona proza podlegają normie 2026.',
  ...POLISH_ORTHOGRAPHY_RULES.map(rule => [
    `[RJP ${rule.reference}] ${rule.title}: ${rule.rule}`,
    `Przykłady: ${rule.examples.join(' | ')}`,
    `Uwaga: ${rule.caution}`,
  ].join('\n')),
].join('\n\n');

/** Dołącza normę do instrukcji systemowej bez zmiany schematu odpowiedzi. */
export const withPolishOrthography = (systemPrompt: string): string =>
  `${systemPrompt}\n\n${POLISH_ORTHOGRAPHY_PROMPT}`;
