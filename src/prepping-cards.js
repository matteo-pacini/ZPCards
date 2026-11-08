// Prepping cards: food, water and cat food stockpiles.
//
// Each card shows how many days a household's stock lasts, against a target
// number of days, and keeps the stock in numbered batches by best-before date.
// The data lives in a Home Assistant to-do list (a Local To-do list works): one
// item per food or bottle size, with its figures and batches as JSON in the
// item's description, plus one settings item per card that holds its target
// (and, on the cat card, its cats). Each card has its own list, though they
// can share one.
// Everyone who can see the list sees the same stock.

// Changes to one row are written once they stop for this long; the to-do list
// stores whole descriptions, so a burst of changes becomes one write.
const WRITE_DELAY_MS = 600;

const DEFAULT_LOCALE = "en-GB";

const PALETTE = ["#ffb86c", "#8be9fd", "#ff79c6", "#50fa7b", "#bd93f9", "#f1fa8c", "#ff5555", "#6272a4"];

// Interface text by language, or by language-Script or language-REGION holding
// only what differs from that language. Each picks up whatever it lacks from
// `en`, so a new key only has to be added there. Chinese is keyed by script
// alone, so Traditional stays English rather than showing Simplified.
// `{n}`, `{amount}`, `{name}`, `{entity}` and `{error}` are filled in by fill();
// they are templates because word order differs between languages. A value
// that is a mapping has a form per plural category (see Intl.PluralRules);
// `other` is the fallback.
const STRINGS = {
  en: {
    food: "Food",
    water: "Water",
    of_days: { one: "of {n} day", other: "of {n} days" },
    days_short: "{n} d",
    per_day: "{amount} a day",
    each: "{amount} each",
    men: { one: "{n} man", other: "{n} men" },
    women: { one: "{n} woman", other: "{n} women" },
    target: "Target days",
    day_less: "One day less",
    day_more: "One day more",
    edit: "Edit {name}",
    batch: "B{n}",
    new_batch: "New batch of {name}",
    edit_batch: "Edit {batch} of {name}",
    best_before: "Best before",
    quantity: "Quantity",
    no_date: "no date",
    add_food: "Add food",
    add_bottles: "Add bottles",
    name: "Name",
    portion: "Portion (g)",
    kcal_per_100g: "kcal per 100 g",
    litres_each: "Litres each",
    add: "Add",
    save: "Save",
    cancel: "Cancel",
    remove: "Remove",
    empty_food: "No food yet. Add one below.",
    empty_water: "No water yet. Add a bottle size below.",
    loading: "Loading…",
    nobody: "Set at least one man or woman.",
    missing: "{entity} doesn't exist yet.",
    create: "Create the “{name}” list",
    ask_admin: "Ask an admin to add a Local To-do list called “{name}”.",
    save_error: "Couldn't save: {error}",
    create_error: "Couldn't create the list: {error}",
    cats: "Cats",
    cat_count: { one: "{n} cat", other: "{n} cats" },
    meals_a_day: { one: "{n} meal a day", other: "{n} meals a day" },
    meals: { one: "{n} meal", other: "{n} meals" },
    meal_amount: "{n} × {amount}",
    wet: "Wet",
    dry: "Dry",
    wet_dry: "Wet & dry",
    wet_food: "Wet food",
    dry_food: "Dry food",
    runs_out_first: "runs out first",
    nobody_eats: "No cat eats this",
    food_type: "Type",
    grams_each: "Grams each",
    grams_a_meal: "Grams a meal",
    meals_per_day: "Meals a day",
    diet: "Diet",
    add_cat: "Add cat",
    edit_cat: "Edit {name}",
    empty_cat_food: "No cat food yet. Add some below.",
    no_cats: "Add a cat to count days.",
  },
  de: {
    food: "Lebensmittel",
    water: "Wasser",
    of_days: { one: "von {n} Tag", other: "von {n} Tagen" },
    days_short: "{n} T",
    per_day: "{amount} pro Tag",
    each: "je {amount}",
    men: { one: "{n} Mann", other: "{n} Männer" },
    women: { one: "{n} Frau", other: "{n} Frauen" },
    target: "Zieltage",
    day_less: "Einen Tag weniger",
    day_more: "Einen Tag mehr",
    edit: "{name} bearbeiten",
    batch: "C{n}",
    new_batch: "Neue Charge: {name}",
    edit_batch: "{batch} bearbeiten: {name}",
    best_before: "Mindestens haltbar bis",
    quantity: "Menge",
    no_date: "ohne Datum",
    add_food: "Lebensmittel hinzufügen",
    add_bottles: "Flaschen hinzufügen",
    kcal_per_100g: "kcal pro 100 g",
    litres_each: "Liter pro Stück",
    add: "Hinzufügen",
    save: "Speichern",
    cancel: "Abbrechen",
    remove: "Entfernen",
    empty_food: "Noch keine Lebensmittel. Unten hinzufügen.",
    empty_water: "Noch kein Wasser. Unten eine Flaschengröße hinzufügen.",
    loading: "Wird geladen…",
    nobody: "Mindestens einen Mann oder eine Frau angeben.",
    missing: "{entity} gibt es noch nicht.",
    create: "Liste „{name}“ anlegen",
    ask_admin: "Bitte einen Admin, eine Local-To-do-Liste namens „{name}“ anzulegen.",
    save_error: "Speichern fehlgeschlagen: {error}",
    create_error: "Liste konnte nicht angelegt werden: {error}",
    cats: "Katzen",
    cat_count: { one: "{n} Katze", other: "{n} Katzen" },
    meals_a_day: { one: "{n} Mahlzeit pro Tag", other: "{n} Mahlzeiten pro Tag" },
    meals: { one: "{n} Mahlzeit", other: "{n} Mahlzeiten" },
    wet: "Nass",
    dry: "Trocken",
    wet_dry: "Nass & trocken",
    wet_food: "Nassfutter",
    dry_food: "Trockenfutter",
    runs_out_first: "geht zuerst aus",
    nobody_eats: "Keine Katze frisst das",
    food_type: "Art",
    grams_each: "Gramm pro Stück",
    grams_a_meal: "Gramm pro Mahlzeit",
    meals_per_day: "Mahlzeiten pro Tag",
    diet: "Futter",
    add_cat: "Katze hinzufügen",
    edit_cat: "{name} bearbeiten",
    empty_cat_food: "Noch kein Katzenfutter. Unten hinzufügen.",
    no_cats: "Füge eine Katze hinzu, um Tage zu zählen.",
  },
  es: {
    food: "Comida",
    water: "Agua",
    of_days: { one: "de {n} día", other: "de {n} días" },
    per_day: "{amount} al día",
    each: "{amount} por unidad",
    men: { one: "{n} hombre", other: "{n} hombres" },
    women: { one: "{n} mujer", other: "{n} mujeres" },
    target: "Días objetivo",
    day_less: "Un día menos",
    day_more: "Un día más",
    edit: "Editar {name}",
    batch: "L{n}",
    new_batch: "Nuevo lote: {name}",
    edit_batch: "Editar {batch}: {name}",
    best_before: "Consumir preferentemente antes de",
    quantity: "Cantidad",
    no_date: "sin fecha",
    add_food: "Añadir comida",
    add_bottles: "Añadir botellas",
    name: "Nombre",
    portion: "Ración (g)",
    kcal_per_100g: "kcal por 100 g",
    litres_each: "Litros por unidad",
    add: "Añadir",
    save: "Guardar",
    cancel: "Cancelar",
    remove: "Eliminar",
    empty_food: "Aún no hay comida. Añade algo abajo.",
    empty_water: "Aún no hay agua. Añade un tamaño de botella abajo.",
    loading: "Cargando…",
    nobody: "Indica al menos un hombre o una mujer.",
    missing: "{entity} aún no existe.",
    create: "Crear la lista «{name}»",
    ask_admin: "Pide a un administrador que añada una lista de Local To-do llamada «{name}».",
    save_error: "No se pudo guardar: {error}",
    create_error: "No se pudo crear la lista: {error}",
    cats: "Gatos",
    cat_count: { one: "{n} gato", other: "{n} gatos" },
    meals_a_day: { one: "{n} comida al día", other: "{n} comidas al día" },
    meals: { one: "{n} comida", other: "{n} comidas" },
    wet: "Húmeda",
    dry: "Seca",
    wet_dry: "Húmeda y seca",
    wet_food: "Comida húmeda",
    dry_food: "Comida seca",
    runs_out_first: "se acaba antes",
    nobody_eats: "Ningún gato la come",
    food_type: "Tipo",
    grams_each: "Gramos por unidad",
    grams_a_meal: "Gramos por comida",
    meals_per_day: "Comidas al día",
    diet: "Dieta",
    add_cat: "Añadir gato",
    edit_cat: "Editar a {name}",
    empty_cat_food: "Aún no hay comida para gatos. Añádela abajo.",
    no_cats: "Añade un gato para contar los días.",
  },
  fr: {
    food: "Nourriture",
    water: "Eau",
    of_days: { one: "sur {n} jour", other: "sur {n} jours" },
    days_short: "{n} j",
    per_day: "{amount} par jour",
    each: "{amount} l'unité",
    men: { one: "{n} homme", other: "{n} hommes" },
    women: { one: "{n} femme", other: "{n} femmes" },
    target: "Jours visés",
    day_less: "Un jour de moins",
    day_more: "Un jour de plus",
    edit: "Modifier {name}",
    batch: "L{n}",
    new_batch: "Nouveau lot : {name}",
    edit_batch: "Modifier {batch} : {name}",
    best_before: "À consommer de préférence avant",
    quantity: "Quantité",
    no_date: "sans date",
    add_food: "Ajouter un aliment",
    add_bottles: "Ajouter des bouteilles",
    name: "Nom",
    kcal_per_100g: "kcal pour 100 g",
    litres_each: "Litres par unité",
    add: "Ajouter",
    save: "Enregistrer",
    cancel: "Annuler",
    remove: "Supprimer",
    empty_food: "Aucun aliment pour l'instant. Ajoutez-en un ci-dessous.",
    empty_water: "Pas encore d'eau. Ajoutez une taille de bouteille ci-dessous.",
    loading: "Chargement…",
    nobody: "Indiquez au moins un homme ou une femme.",
    missing: "{entity} n'existe pas encore.",
    create: "Créer la liste « {name} »",
    ask_admin: "Demandez à un administrateur d'ajouter une liste Local To-do nommée « {name} ».",
    save_error: "Échec de l'enregistrement : {error}",
    create_error: "Impossible de créer la liste : {error}",
    cats: "Chats",
    cat_count: { one: "{n} chat", other: "{n} chats" },
    meals_a_day: { one: "{n} repas par jour", other: "{n} repas par jour" },
    meals: { one: "{n} repas", other: "{n} repas" },
    wet: "Humide",
    dry: "Sèche",
    wet_dry: "Humide et sèche",
    wet_food: "Pâtée",
    dry_food: "Croquettes",
    runs_out_first: "s’épuise en premier",
    nobody_eats: "Aucun chat n’en mange",
    food_type: "Sorte",
    grams_each: "Grammes par unité",
    grams_a_meal: "Grammes par repas",
    meals_per_day: "Repas par jour",
    diet: "Régime",
    add_cat: "Ajouter un chat",
    edit_cat: "Modifier {name}",
    empty_cat_food: "Pas encore de nourriture pour chats. Ajoutez-en ci-dessous.",
    no_cats: "Ajoutez un chat pour compter les jours.",
  },
  it: {
    food: "Cibo",
    water: "Acqua",
    of_days: { one: "su {n} giorno", other: "su {n} giorni" },
    // "gg", not "g", which beside an amount reads as grams.
    days_short: "{n} gg",
    per_day: "{amount} al giorno",
    // "cad.", as on Italian labels: "ciascuno" would have to agree with the item.
    each: "{amount} cad.",
    men: { one: "{n} uomo", other: "{n} uomini" },
    women: { one: "{n} donna", other: "{n} donne" },
    target: "Giorni obiettivo",
    day_less: "Un giorno in meno",
    day_more: "Un giorno in più",
    edit: "Modifica {name}",
    batch: "L{n}",
    new_batch: "Nuovo lotto: {name}",
    edit_batch: "Modifica {batch}: {name}",
    best_before: "Da consumarsi preferibilmente entro",
    quantity: "Quantità",
    no_date: "senza data",
    add_food: "Aggiungi cibo",
    add_bottles: "Aggiungi bottiglie",
    name: "Nome",
    portion: "Porzione (g)",
    litres_each: "Litri per unità",
    add: "Aggiungi",
    save: "Salva",
    cancel: "Annulla",
    remove: "Rimuovi",
    empty_food: "Ancora nessun cibo. Aggiungine uno qui sotto.",
    empty_water: "Ancora niente acqua. Aggiungi un formato di bottiglia qui sotto.",
    loading: "Caricamento…",
    nobody: "Indica almeno un uomo o una donna.",
    missing: "{entity} non esiste ancora.",
    create: "Crea la lista “{name}”",
    ask_admin: "Chiedi a un amministratore di aggiungere una lista Local To-do chiamata “{name}”.",
    save_error: "Impossibile salvare: {error}",
    create_error: "Impossibile creare la lista: {error}",
    cats: "Gatti",
    cat_count: { one: "{n} gatto", other: "{n} gatti" },
    meals_a_day: { one: "{n} pasto al giorno", other: "{n} pasti al giorno" },
    meals: { one: "{n} pasto", other: "{n} pasti" },
    wet: "Umido",
    dry: "Secco",
    wet_dry: "Umido e secco",
    wet_food: "Cibo umido",
    dry_food: "Crocchette",
    runs_out_first: "finisce prima",
    nobody_eats: "Nessun gatto lo mangia",
    food_type: "Tipo",
    grams_each: "Grammi a confezione",
    grams_a_meal: "Grammi a pasto",
    meals_per_day: "Pasti al giorno",
    diet: "Dieta",
    add_cat: "Aggiungi gatto",
    edit_cat: "Modifica {name}",
    empty_cat_food: "Ancora niente cibo per gatti. Aggiungilo qui sotto.",
    no_cats: "Aggiungi un gatto per contare i giorni.",
  },
  pt: {
    food: "Comida",
    water: "Água",
    of_days: { one: "de {n} dia", other: "de {n} dias" },
    per_day: "{amount} por dia",
    each: "{amount} cada",
    men: { one: "{n} homem", other: "{n} homens" },
    women: { one: "{n} mulher", other: "{n} mulheres" },
    target: "Dias pretendidos",
    day_less: "Menos um dia",
    day_more: "Mais um dia",
    edit: "Editar {name}",
    batch: "L{n}",
    new_batch: "Novo lote: {name}",
    edit_batch: "Editar {batch}: {name}",
    best_before: "Consumir de preferência antes de",
    quantity: "Quantidade",
    no_date: "sem data",
    add_food: "Adicionar comida",
    add_bottles: "Adicionar garrafas",
    name: "Nome",
    portion: "Porção (g)",
    kcal_per_100g: "kcal por 100 g",
    litres_each: "Litros por unidade",
    add: "Adicionar",
    save: "Guardar",
    cancel: "Cancelar",
    remove: "Remover",
    empty_food: "Ainda sem comida. Adicione abaixo.",
    empty_water: "Ainda sem água. Adicione um tamanho de garrafa abaixo.",
    loading: "A carregar…",
    nobody: "Indique pelo menos um homem ou uma mulher.",
    missing: "{entity} ainda não existe.",
    create: "Criar a lista “{name}”",
    ask_admin: "Peça a um administrador para adicionar uma lista Local To-do chamada “{name}”.",
    save_error: "Não foi possível guardar: {error}",
    create_error: "Não foi possível criar a lista: {error}",
    cats: "Gatos",
    cat_count: { one: "{n} gato", other: "{n} gatos" },
    meals_a_day: { one: "{n} refeição por dia", other: "{n} refeições por dia" },
    meals: { one: "{n} refeição", other: "{n} refeições" },
    wet: "Húmida",
    dry: "Seca",
    wet_dry: "Húmida e seca",
    wet_food: "Comida húmida",
    dry_food: "Ração seca",
    runs_out_first: "acaba primeiro",
    nobody_eats: "Nenhum gato come isto",
    food_type: "Tipo",
    grams_each: "Gramas por unidade",
    grams_a_meal: "Gramas por refeição",
    meals_per_day: "Refeições por dia",
    diet: "Dieta",
    add_cat: "Adicionar gato",
    edit_cat: "Editar {name}",
    empty_cat_food: "Ainda não há comida para gatos. Adicione abaixo.",
    no_cats: "Adicione um gato para contar os dias.",
  },
  "pt-BR": {
    target: "Meta de dias",
    save: "Salvar",
    loading: "Carregando…",
    best_before: "Validade",
    save_error: "Não foi possível salvar: {error}",
    wet: "Úmida",
    wet_dry: "Úmida e seca",
    wet_food: "Ração úmida",
    nobody_eats: "Nenhum gato come isso",
  },
  nl: {
    food: "Voedsel",
    water: "Water",
    of_days: { one: "van {n} dag", other: "van {n} dagen" },
    per_day: "{amount} per dag",
    each: "{amount} per stuk",
    men: { one: "{n} man", other: "{n} mannen" },
    women: { one: "{n} vrouw", other: "{n} vrouwen" },
    target: "Doel in dagen",
    day_less: "Eén dag minder",
    day_more: "Eén dag meer",
    edit: "{name} bewerken",
    batch: "P{n}",
    new_batch: "Nieuwe partij: {name}",
    edit_batch: "{batch} bewerken: {name}",
    best_before: "Ten minste houdbaar tot",
    quantity: "Aantal",
    no_date: "geen datum",
    add_food: "Voedsel toevoegen",
    add_bottles: "Flessen toevoegen",
    name: "Naam",
    portion: "Portie (g)",
    litres_each: "Liter per stuk",
    add: "Toevoegen",
    save: "Opslaan",
    cancel: "Annuleren",
    remove: "Verwijderen",
    empty_food: "Nog geen voedsel. Voeg hieronder iets toe.",
    empty_water: "Nog geen water. Voeg hieronder een flesmaat toe.",
    loading: "Laden…",
    nobody: "Vul minstens één man of vrouw in.",
    missing: "{entity} bestaat nog niet.",
    create: "Lijst ‘{name}’ aanmaken",
    ask_admin: "Vraag een beheerder om een Local To-do-lijst met de naam ‘{name}’ toe te voegen.",
    save_error: "Opslaan mislukt: {error}",
    create_error: "Lijst aanmaken mislukt: {error}",
    cats: "Katten",
    cat_count: { one: "{n} kat", other: "{n} katten" },
    meals_a_day: { one: "{n} maaltijd per dag", other: "{n} maaltijden per dag" },
    meals: { one: "{n} maaltijd", other: "{n} maaltijden" },
    wet: "Nat",
    dry: "Droog",
    wet_dry: "Nat & droog",
    wet_food: "Natvoer",
    dry_food: "Droogvoer",
    runs_out_first: "raakt eerst op",
    nobody_eats: "Geen kat eet dit",
    food_type: "Soort",
    grams_each: "Gram per stuk",
    grams_a_meal: "Gram per maaltijd",
    meals_per_day: "Maaltijden per dag",
    diet: "Dieet",
    add_cat: "Kat toevoegen",
    edit_cat: "{name} bewerken",
    empty_cat_food: "Nog geen kattenvoer. Voeg hieronder iets toe.",
    no_cats: "Voeg een kat toe om dagen te tellen.",
  },
  pl: {
    food: "Jedzenie",
    water: "Woda",
    // "other" covers fractions; the target is always whole.
    of_days: { one: "z {n} dnia", few: "z {n} dni", many: "z {n} dni", other: "z {n} dnia" },
    days_short: "{n} dn.",
    per_day: "{amount} dziennie",
    each: "{amount}/szt.",
    men: { one: "{n} mężczyzna", few: "{n} mężczyźni", many: "{n} mężczyzn", other: "{n} mężczyzny" },
    women: { one: "{n} kobieta", few: "{n} kobiety", many: "{n} kobiet", other: "{n} kobiety" },
    target: "Docelowa liczba dni",
    day_less: "O dzień mniej",
    day_more: "O dzień więcej",
    // Impersonal forms and the colon, as {name} can be any gender or case.
    edit: "Edytuj: {name}",
    batch: "P{n}",
    new_batch: "Nowa partia: {name}",
    edit_batch: "Edytuj {batch}: {name}",
    best_before: "Najlepiej spożyć przed",
    quantity: "Ilość",
    no_date: "bez daty",
    add_food: "Dodaj jedzenie",
    add_bottles: "Dodaj butelki",
    name: "Nazwa",
    portion: "Porcja (g)",
    kcal_per_100g: "kcal na 100 g",
    litres_each: "Litry na sztukę",
    add: "Dodaj",
    save: "Zapisz",
    cancel: "Anuluj",
    remove: "Usuń",
    empty_food: "Brak jedzenia. Dodaj je poniżej.",
    empty_water: "Brak wody. Dodaj rozmiar butelki poniżej.",
    loading: "Ładowanie…",
    nobody: "Podaj co najmniej jednego mężczyznę lub jedną kobietę.",
    missing: "{entity} jeszcze nie istnieje.",
    create: "Utwórz listę „{name}”",
    ask_admin: "Poproś administratora o dodanie listy Local To-do o nazwie „{name}”.",
    save_error: "Nie udało się zapisać: {error}",
    create_error: "Nie udało się utworzyć listy: {error}",
    cats: "Koty",
    cat_count: { one: "{n} kot", few: "{n} koty", many: "{n} kotów", other: "{n} kota" },
    meals_a_day: { one: "{n} posiłek dziennie", few: "{n} posiłki dziennie", many: "{n} posiłków dziennie", other: "{n} posiłku dziennie" },
    meals: { one: "{n} posiłek", few: "{n} posiłki", many: "{n} posiłków", other: "{n} posiłku" },
    wet: "Mokra",
    dry: "Sucha",
    wet_dry: "Mokra i sucha",
    wet_food: "Karma mokra",
    dry_food: "Karma sucha",
    runs_out_first: "skończy się pierwsza",
    nobody_eats: "Żaden kot tego nie je",
    food_type: "Rodzaj",
    grams_each: "Gramy na sztukę",
    grams_a_meal: "Gramy na posiłek",
    meals_per_day: "Posiłki dziennie",
    diet: "Dieta",
    add_cat: "Dodaj kota",
    edit_cat: "Edytuj: {name}",
    empty_cat_food: "Brak karmy dla kotów. Dodaj ją poniżej.",
    no_cats: "Dodaj kota, aby liczyć dni.",
  },
  sv: {
    food: "Mat",
    water: "Vatten",
    of_days: { one: "av {n} dag", other: "av {n} dagar" },
    per_day: "{amount} per dag",
    each: "{amount}/st",
    men: { one: "{n} man", other: "{n} män" },
    women: { one: "{n} kvinna", other: "{n} kvinnor" },
    target: "Mål i dagar",
    day_less: "En dag mindre",
    day_more: "En dag mer",
    edit: "Redigera {name}",
    batch: "P{n}",
    new_batch: "Nytt parti: {name}",
    edit_batch: "Redigera {batch}: {name}",
    best_before: "Bäst före",
    quantity: "Antal",
    no_date: "inget datum",
    add_food: "Lägg till mat",
    add_bottles: "Lägg till flaskor",
    name: "Namn",
    litres_each: "Liter per styck",
    add: "Lägg till",
    save: "Spara",
    cancel: "Avbryt",
    remove: "Ta bort",
    empty_food: "Ingen mat än. Lägg till nedan.",
    empty_water: "Inget vatten än. Lägg till en flaskstorlek nedan.",
    loading: "Laddar…",
    nobody: "Ange minst en man eller en kvinna.",
    missing: "{entity} finns inte än.",
    create: "Skapa listan ”{name}”",
    ask_admin: "Be en administratör lägga till en Local To-do-lista som heter ”{name}”.",
    save_error: "Kunde inte spara: {error}",
    create_error: "Kunde inte skapa listan: {error}",
    cats: "Katter",
    cat_count: { one: "{n} katt", other: "{n} katter" },
    meals_a_day: { one: "{n} måltid per dag", other: "{n} måltider per dag" },
    meals: { one: "{n} måltid", other: "{n} måltider" },
    wet: "Våt",
    dry: "Torr",
    wet_dry: "Våt & torr",
    wet_food: "Våtfoder",
    dry_food: "Torrfoder",
    runs_out_first: "tar slut först",
    nobody_eats: "Ingen katt äter detta",
    food_type: "Typ",
    grams_each: "Gram per styck",
    grams_a_meal: "Gram per måltid",
    meals_per_day: "Måltider per dag",
    diet: "Kost",
    add_cat: "Lägg till katt",
    edit_cat: "Redigera {name}",
    empty_cat_food: "Inget kattfoder än. Lägg till nedan.",
    no_cats: "Lägg till en katt för att räkna dagar.",
  },
  "zh-Hans": {
    food: "食物",
    water: "水",
    of_days: { other: "/ {n} 天" },
    days_short: "{n} 天",
    per_day: "每天 {amount}",
    each: "每个 {amount}",
    men: { other: "{n} 名男性" },
    women: { other: "{n} 名女性" },
    target: "目标天数",
    day_less: "减少一天",
    day_more: "增加一天",
    edit: "编辑 {name}",
    batch: "批{n}",
    new_batch: "{name} 新批次",
    edit_batch: "编辑 {name} 的{batch}",
    best_before: "最佳食用日期",
    quantity: "数量",
    no_date: "无日期",
    add_food: "添加食物",
    add_bottles: "添加瓶装水",
    name: "名称",
    portion: "份量（克）",
    kcal_per_100g: "每 100 克千卡",
    litres_each: "每瓶升数",
    add: "添加",
    save: "保存",
    cancel: "取消",
    remove: "删除",
    empty_food: "还没有食物。请在下方添加。",
    empty_water: "还没有水。请在下方添加瓶子规格。",
    loading: "加载中…",
    nobody: "请至少设置一名男性或女性。",
    missing: "{entity} 尚不存在。",
    create: "创建“{name}”列表",
    ask_admin: "请管理员添加名为“{name}”的 Local To-do 列表。",
    save_error: "保存失败：{error}",
    create_error: "无法创建列表：{error}",
    cats: "猫",
    cat_count: { other: "{n} 只猫" },
    meals_a_day: { other: "每天 {n} 餐" },
    meals: { other: "{n} 餐" },
    wet: "湿粮",
    dry: "干粮",
    wet_dry: "湿粮和干粮",
    wet_food: "湿粮",
    dry_food: "干粮",
    runs_out_first: "最先吃完",
    nobody_eats: "没有猫吃这个",
    food_type: "类型",
    grams_each: "每份克数",
    grams_a_meal: "每餐克数",
    meals_per_day: "每天餐数",
    diet: "饮食",
    add_cat: "添加猫",
    edit_cat: "编辑 {name}",
    empty_cat_food: "还没有猫粮。请在下方添加。",
    no_cats: "添加一只猫以计算天数。",
  },
};

// The text for a BCP 47 locale: `overrides`, then its language-REGION, then its
// language-Script, then its language, then English. Only the script comes from
// maximize(), which would also turn plain `pt` into pt-BR.
const translate = (locale, overrides) => {
  const tag = new Intl.Locale(locale);
  const { language, region } = tag;
  const { script } = tag.maximize();
  return Object.assign(
    {},
    STRINGS.en,
    STRINGS[language],
    STRINGS[language + "-" + script],
    STRINGS[language + "-" + region],
    overrides
  );
};

// A function replacement, so a `$` in a name is taken literally.
const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, k) => values[k]);

// The form of `forms` (a string, or a mapping by plural category) for count
// `n`, with `{n}` filled in.
const plural = (forms, n, locale) => {
  const form = typeof forms === "string" ? forms : forms[new Intl.PluralRules(locale).select(n)] ?? forms.other;
  return fill(form, { n: fmtNumber(n, locale) });
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const parse = (description) => {
  try {
    const v = JSON.parse(description || "");
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
};

const num = (v, min = 0) => Math.max(min, Number(v) || 0);

// "always": Polish and others otherwise group 12 500 but not 1800, which
// misaligns a column of amounts.
const fmtNumber = (v, locale = DEFAULT_LOCALE, digits = 0) =>
  v.toLocaleString(locale, { maximumFractionDigits: digits, useGrouping: "always" });
const fmtKcal = (k, locale) => fmtNumber(Math.round(k), locale) + " kcal";
const fmtLitres = (l, locale) => fmtNumber(Math.round(l * 10) / 10, locale, 1) + " L";
const fmtGrams = (g, locale) =>
  g >= 1000 ? fmtNumber(Math.round(g / 100) / 10, locale, 1) + " kg" : fmtNumber(Math.round(g), locale) + " g";
// Rounded down, so the card never promises a day that isn't there.
const fmtDays = (d, locale) => (d >= 10 ? fmtNumber(Math.floor(d), locale) : fmtNumber(Math.floor(d * 10) / 10, locale, 1));

// A batch expiring within this many days is flagged.
const SOON_DAYS = 30;

const EXPIRY = /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/;

// The last day a batch is good: "2027-03", as tins print it, means the end of
// March; a full date means that day.
const expiryDate = (exp) =>
  exp.length === 7 ? new Date(+exp.slice(0, 4), +exp.slice(5, 7), 0) : new Date(+exp.slice(0, 4), +exp.slice(5, 7) - 1, +exp.slice(8, 10));

// Days from `now` to a batch's expiry: 0 on its last day, negative once past it.
const daysLeft = (exp, now = new Date()) =>
  Math.round((expiryDate(exp) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);

const expiryState = (exp, now) => {
  if (!exp) return "";
  const d = daysLeft(exp, now);
  return d < 0 ? "expired" : d <= SOON_DAYS ? "soon" : "";
};

const fmtExpiry = (exp, locale) =>
  expiryDate(exp).toLocaleDateString(locale, exp.length === 7 ? { month: "short", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" });

// Soonest expiry first; undated batches last.
const byExpiry = (a, b) => (!a.exp || !b.exp ? !a.exp - !b.exp : expiryDate(a.exp) - expiryDate(b.exp));

const totalCount = (batches) => batches.reduce((sum, b) => sum + b.count, 0);
const nextBatch = (batches) => Math.max(0, ...batches.map((b) => b.n)) + 1;

// Batches after adding `count` expiring on `exp` (null for no date): to the
// batch with that expiry, or a new one numbered after the rest.
const addBatch = (batches, exp, count) =>
  batches.some((b) => b.exp === exp)
    ? batches.map((b) => (b.exp === exp ? { ...b, count: b.count + count } : b))
    : [...batches, { n: nextBatch(batches), exp, count }];

// Batches after setting batch `n` to `exp` and `count`; a count of 0 removes it.
const setBatch = (batches, n, exp, count) =>
  batches.map((b) => (b.n === n ? { ...b, exp, count } : b)).filter((b) => b.count > 0);

// The name Local To-do needs to create `entity`: it derives the entity id from
// the list's name, so todo.food_stockpile comes from "Food stockpile".
const listName = (entity) => {
  const s = entity.split(".")[1].replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// What makes each card different. `fields` are the figures an item stores
// besides its batches, in the order the add/edit form asks for them; an item
// belongs to the card when its description has every one of them. A field
// with `choices` holds one of them rather than a number. Text is named by its
// STRINGS key.
const KINDS = {
  food: {
    tag: "food-stockpile-card",
    name: "Food stockpile",
    description: "Days of food in stock against a target, counted from a to-do list",
    title: "food",
    entity: "todo.food_stockpile",
    settings: "Food stockpile settings",
    defaultTarget: 30,
    // NHS reference intakes for adults, in kcal a day.
    perMan: 2500,
    perWoman: 2000,
    fmt: fmtKcal,
    fields: [
      { key: "portion_g", label: "portion", min: 1 },
      { key: "kcal_per_100g", label: "kcal_per_100g", min: 0 },
    ],
    each: (f) => (f.portion_g * f.kcal_per_100g) / 100,
    add: "add_food",
    empty: "empty_food",
  },
  water: {
    tag: "water-stockpile-card",
    name: "Water stockpile",
    description: "Days of water in stock against a target, counted from a to-do list",
    title: "water",
    entity: "todo.water_stockpile",
    settings: "Water stockpile settings",
    defaultTarget: 7,
    // About a US gallon (3.8 L) per person a day for drinking and basic
    // hygiene, as FEMA advises; the guidance doesn't differ by sex.
    perMan: 4,
    perWoman: 4,
    fmt: fmtLitres,
    fields: [{ key: "litres", label: "litres_each", min: 0.1 }],
    each: (f) => f.litres,
    add: "add_bottles",
    empty: "empty_water",
  },
  cat: {
    tag: "cat-stockpile-card",
    name: "Cat stockpile",
    description: "Days of wet and dry cat food in stock against a target, counted from a to-do list",
    title: "cats",
    entity: "todo.cat_stockpile",
    settings: "Cat stockpile settings",
    defaultTarget: 30,
    fmt: fmtGrams,
    fields: [
      { key: "type", label: "food_type", choices: ["wet", "dry"] },
      { key: "grams", label: "grams_each", min: 1 },
    ],
    each: (f) => f.grams,
    add: "add_food",
    empty: "empty_cat_food",
    // Who eats is the list of cats in the settings item, not men and women.
    cats: true,
  },
};

// The food types a cat eats, each counted on its own.
const TYPES = ["wet", "dry"];

const readField = (f, v) => (f.choices ? (f.choices.includes(v) ? v : f.choices[0]) : num(v));

// An item's batches. An item with only a count, as written before batches,
// is one undated batch.
const readBatches = (v) => {
  if (!Array.isArray(v.batches)) {
    const count = Math.floor(num(v.count));
    return count ? [{ n: 1, exp: null, count }] : [];
  }
  return v.batches
    .filter((b) => b && typeof b === "object")
    .map((b) => ({
      n: Math.floor(num(b.n, 1)),
      exp: typeof b.exp === "string" && EXPIRY.test(b.exp) ? b.exp : null,
      count: Math.floor(num(b.count)),
    }))
    .filter((b) => b.count > 0);
};

// Splits the to-do items into this card's items, in the list's order (so a
// new one comes last), and its settings item.
const readItems = (kind, items) => {
  const rows = [];
  let settings = null;
  for (const it of items) {
    const v = parse(it.description);
    if (!v) continue;
    if (it.summary === kind.settings && "target_days" in v) {
      // `raw` keeps keys this version doesn't know, so a write doesn't drop them.
      settings = { uid: it.uid, raw: v, target_days: num(v.target_days, 1) };
      if (kind.cats) settings.cats = readCats(v.cats);
    } else if (kind.fields.every((f) => f.key in v)) {
      const row = { uid: it.uid, name: it.summary, batches: readBatches(v) };
      for (const f of kind.fields) row[f.key] = readField(f, v[f.key]);
      rows.push(row);
    }
  }
  return { rows, settings };
};

// Who the card counts for, from its config, and what they need a day between them.
const household = (kind, config, t = STRINGS.en, locale = DEFAULT_LOCALE) => {
  const men = Math.floor(num(config.men ?? 1));
  const women = Math.floor(num(config.women ?? 1));
  const people = [men && plural(t.men, men, locale), women && plural(t.women, women, locale)].filter(Boolean).join(" · ");
  return { men, women, people, perDay: men * kind.perMan + women * kind.perWoman };
};

// A cat's meals of one type, `{ meals, g }` (grams a meal), or null when it
// doesn't eat that type.
const readMeal = (m) => (m && num(m.meals) >= 1 && num(m.g) > 0 ? { meals: Math.floor(num(m.meals)), g: num(m.g) } : null);

// The cats in the cat card's settings item. A cat with no name, or that eats
// neither type, is skipped.
const readCats = (v) =>
  (Array.isArray(v) ? v : [])
    .filter((c) => c && typeof c.name === "string" && c.name.trim())
    .map((c) => ({ name: c.name.trim(), wet: readMeal(c.wet), dry: readMeal(c.dry) }))
    .filter((c) => c.wet || c.dry);

const catJSON = (c) => ({ name: c.name, ...(c.wet && { wet: c.wet }), ...(c.dry && { dry: c.dry }) });

// What the cats eat a day of each type: grams, meals, and which cats.
const catNeeds = (cats) =>
  Object.fromEntries(
    TYPES.map((type) => {
      const eaters = cats.filter((c) => c[type]);
      return [
        type,
        {
          perDay: eaters.reduce((sum, c) => sum + c[type].meals * c[type].g, 0),
          meals: eaters.reduce((sum, c) => sum + c[type].meals, 0),
          names: eaters.map((c) => c.name),
        },
      ];
    }),
  );

// Days the cats' stock lasts. Each type eaten lasts on its own; the stock
// lasts until the first of them runs out, `first`.
const catDays = (need, stock) => {
  const eaten = TYPES.filter((type) => need[type].perDay > 0);
  const days = Object.fromEntries(eaten.map((type) => [type, stock[type] / need[type].perDay]));
  const first = eaten.length ? eaten.reduce((a, b) => (days[a] <= days[b] ? a : b)) : null;
  return { eaten, days, first, overall: first ? days[first] : 0 };
};

const itemJSON = (kind, row) => {
  const v = {};
  for (const f of kind.fields) v[f.key] = row[f.key];
  // count is the batches' total, kept for anything that reads only the count.
  v.count = totalCount(row.batches);
  v.batches = row.batches;
  return JSON.stringify(v);
};

// Throws on config the card can't use; the message shows in the dashboard.
const checkConfig = (kind, config) => {
  if (!config?.entity) throw new Error(`Set entity to a to-do list, e.g. ${kind.entity}`);
  for (const k of ["men", "women"]) {
    if (config[k] != null && !(Number.isInteger(config[k]) && config[k] >= 0)) {
      throw new Error(`${kind.tag}: \`${k}\` must be a whole number, 0 or more`);
    }
  }
  if (config.locale != null) {
    try {
      new Intl.Locale(config.locale);
    } catch {
      throw new Error(`${kind.tag}: \`locale\` must be a BCP 47 tag, such as de-DE`);
    }
  }
  if (config.strings != null) {
    if (typeof config.strings !== "object" || Array.isArray(config.strings)) {
      throw new Error(`${kind.tag}: \`strings\` must be a mapping`);
    }
    for (const k of Object.keys(config.strings)) {
      if (!(k in STRINGS.en)) throw new Error(`${kind.tag}: \`strings\` has no key '${k}'`);
    }
  }
};

const STYLE = `
  :host { display: block; }
  ha-card { padding: 16px; display: grid; gap: 16px; container-type: inline-size; }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
  .title { font: 500 16px var(--ha-font-family-body, Roboto, sans-serif); color: var(--secondary-text-color); }
  .days { font-size: 40px; font-weight: 600; line-height: 1; font-variant-numeric: tabular-nums; }
  .days small { font-size: 16px; font-weight: 400; color: var(--secondary-text-color); margin-left: 4px; }
  .days.low { color: var(--warning-color, #ffb86c); }
  .days.met { color: var(--success-color, #50fa7b); }
  .amount { color: var(--secondary-text-color); font-variant-numeric: tabular-nums; margin-top: 4px; }
  .target { display: flex; align-items: center; gap: 4px; white-space: nowrap; color: var(--secondary-text-color); }
  .target output { min-width: 3ch; text-align: center; color: var(--primary-text-color); font-weight: 600; font-variant-numeric: tabular-nums; }
  .bar { display: flex; height: 12px; margin-top: 12px; border-radius: 6px; overflow: hidden; background: var(--divider-color); }
  .bar span { height: 100%; }
  .bar span + span { border-left: 1px solid var(--card-background-color, #1c1c1c); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  li { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; align-items: center; padding: 8px 0; border-top: 1px solid var(--divider-color); }
  .name { display: flex; align-items: baseline; gap: 8px; min-width: 0; font-weight: 500; overflow-wrap: anywhere; }
  .dot { flex: none; width: 10px; height: 10px; border-radius: 50%; }
  .sub { grid-column: 1; color: var(--secondary-text-color); font-size: 13px; padding-left: 18px; }
  .total { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .count { grid-column: 2; grid-row: 2; display: flex; align-items: center; justify-content: flex-end; gap: 4px; }
  .count output { min-width: 3ch; text-align: center; font-weight: 600; font-variant-numeric: tabular-nums; }
  .batches { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding-left: 18px; }
  .batch { font-size: 12px; line-height: 22px; padding: 0 8px; border-radius: 11px; border: 1px solid transparent; background: var(--secondary-background-color, rgba(127, 127, 127, .15)); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .batch b { font-weight: 600; margin-right: 4px; color: var(--secondary-text-color); }
  .batch.soon { border-color: var(--warning-color, #ffb86c); color: var(--warning-color, #ffb86c); }
  .batch.expired { border-color: var(--error-color, #ff5555); color: var(--error-color, #ff5555); }
  .batch.soon b, .batch.expired b { color: inherit; }
  .batch.expired time { text-decoration: line-through; }
  button.batch { height: auto; min-width: 0; color: inherit; }
  button.batch:not(.soon):not(.expired) { color: var(--primary-text-color); }
  button.batch.open { border-color: var(--primary-color); }
  button.batch.new { color: var(--secondary-text-color); border: 1px dashed var(--divider-color); background: none; }
  .dating { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: end; gap: 8px; padding-left: 18px; }
  .dating input { width: auto; color-scheme: light dark; }
  .dating input.qty { width: 8ch; }
  .dating .danger { margin-left: 0; }
  button { font: inherit; color: var(--primary-text-color); background: var(--secondary-background-color, transparent); border: 1px solid var(--divider-color); border-radius: 8px; min-width: 36px; height: 36px; padding: 0 10px; cursor: pointer; }
  button:hover:not(:disabled) { border-color: var(--primary-color); }
  button:focus-visible, input:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
  button:disabled { opacity: .4; cursor: default; }
  button.edit { border-color: transparent; background: none; color: var(--secondary-text-color); }
  .primary { background: var(--primary-color); border-color: var(--primary-color); color: var(--text-primary-color, #fff); }
  .danger { color: var(--error-color, #ff5555); margin-left: auto; }
  .empty, .error { color: var(--secondary-text-color); }
  .error { color: var(--error-color, #ff5555); }
  form { display: grid; grid-template-columns: 2fr repeat(var(--fields), 1fr); gap: 8px; padding-top: 12px; border-top: 1px solid var(--divider-color); }
  form[hidden] { display: none; }
  label { display: grid; gap: 2px; font-size: 12px; color: var(--secondary-text-color); min-width: 0; }
  input { font: inherit; color: var(--primary-text-color); background: var(--secondary-background-color, transparent); border: 1px solid var(--divider-color); border-radius: 8px; height: 36px; padding: 0 8px; width: 100%; box-sizing: border-box; }
  .actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; }
  @container (max-width: 360px) { form { grid-template-columns: 1fr 1fr; } .field-name { grid-column: 1 / -1; } }
  select { font: inherit; color: var(--primary-text-color); background: var(--secondary-background-color, transparent); border: 1px solid var(--divider-color); border-radius: 8px; height: 36px; padding: 0 6px; width: 100%; }
  select:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
  .amount.first { color: var(--warning-color, #ffb86c); }
  .bars { display: grid; gap: 8px; margin-top: 12px; }
  .barrow { display: grid; grid-template-columns: minmax(3em, auto) 1fr; align-items: center; gap: 8px; font-size: 12px; color: var(--secondary-text-color); }
  .barrow .bar { margin-top: 0; height: 10px; }
  li.section { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; padding-top: 12px; font-size: 13px; color: var(--secondary-text-color); }
  li.section b { font-weight: 500; letter-spacing: .06em; text-transform: uppercase; }
  .cats { display: grid; gap: 4px; }
  .cat-foot[hidden] { display: none; }
  .cats[hidden] { display: none; }
  .cats .head { align-items: baseline; flex-wrap: wrap; font-size: 13px; color: var(--secondary-text-color); padding-top: 12px; border-top: 1px solid var(--divider-color); }
  .cats .head b { font-weight: 500; letter-spacing: .06em; text-transform: uppercase; }
  .catlist .sub { padding-left: 0; }
  .catlist .count { grid-row: 1 / span 2; }
  .diet { font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; padding: 0 6px; border-radius: 4px; background: var(--secondary-background-color, rgba(127, 127, 127, .15)); color: var(--secondary-text-color); }
  .catform { grid-template-columns: 2fr 1fr; }
  fieldset { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0; padding: 8px 0 0; border: 0; border-top: 1px solid var(--divider-color); }
  fieldset[hidden] { display: none; }
  legend { font-size: 13px; font-weight: 500; padding: 0 6px 0 0; }
`;

// The visual editor's fields. Labels are in English, as Home Assistant gives
// a config form no way to learn the language.
const editorForm = (kind) => ({
  schema: [
    { name: "entity", required: true, selector: { entity: { domain: "todo" } } },
    { name: "title", selector: { text: {} } },
    // The cat card's cats are set on the card itself.
    ...(kind.cats
      ? []
      : [
          {
            type: "grid",
            name: "",
            schema: [
              { name: "men", selector: { number: { min: 0, max: 20, step: 1, mode: "box" } } },
              { name: "women", selector: { number: { min: 0, max: 20, step: 1, mode: "box" } } },
            ],
          },
        ]),
    { name: "locale", selector: { text: {} } },
  ],
  computeLabel: (s) =>
    ({
      entity: "To-do list",
      title: "Title",
      men: `Adult men (${kind.fmt(kind.perMan)} a day each)`,
      women: `Adult women (${kind.fmt(kind.perWoman)} a day each)`,
      locale: "Locale, such as de-DE (default: Home Assistant's language)",
    })[s.name],
});

// The −, target and + controls.
const targetHTML = (t, target, locale) => `<div class="target" role="group" aria-label="${esc(t.target)}">
          <button type="button" data-target="-1" aria-label="${esc(t.day_less)}" ${target <= 1 ? "disabled" : ""}>−</button>
          <output>${fmtNumber(target, locale)}</output>
          <button type="button" data-target="1" aria-label="${esc(t.day_more)}">+</button>
        </div>`;

// A bar's segments, one per row with stock. They fill the bar up to the
// target, `scale`; past it, they share the bar in proportion.
const segments = (rows, scale) =>
  rows
    .filter((x) => x.amount > 0)
    .map((x) => `<span style="width:${(100 * x.amount) / scale}%;background:${x.color}" title="${esc(x.r.name)}"></span>`)
    .join("");

class StockpileCard extends HTMLElement {
  // Set by each card's subclass to one of KINDS.
  static kind;

  static getConfigForm() {
    return editorForm(this.kind);
  }

  static getStubConfig() {
    return this.kind.cats ? { entity: this.kind.entity } : { entity: this.kind.entity, men: 1, women: 1 };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._kind = this.constructor.kind;
    this._rows = [];
    this._settings = null;
    this._loaded = false;
    this._error = null;
    // Values tapped here and not yet stored, by item uid. Updates from Home
    // Assistant don't overwrite them, so a burst of taps isn't undone by the
    // echo of an earlier write.
    this._local = new Map();
    this._timers = new Map();
    this._editing = null;
    // The cat being edited on the cat card: its index, "new", or null.
    this._catEditing = null;
  }

  setConfig(config) {
    checkConfig(this._kind, config);
    const changed = this._config?.entity !== config.entity;
    this._config = config;
    this._build();
    if (changed) this._resubscribe();
    this._update();
  }

  set hass(hass) {
    const first = !this._hass;
    const existed = this._exists();
    const locale = this._locale();
    this._hass = hass;
    // A list created after the card loaded needs a fresh subscription.
    if (first || this._exists() !== existed) {
      this._resubscribe();
      this._update();
    } else if (this._locale() !== locale) {
      this._update();
    }
  }

  _exists() {
    return Boolean(this._hass && this._config && this._hass.states[this._config.entity]);
  }

  _locale() {
    return this._config?.locale || this._hass?.locale?.language || DEFAULT_LOCALE;
  }

  _strings() {
    return translate(this._locale(), this._config?.strings);
  }

  connectedCallback() {
    if (!this._unsub) this._resubscribe();
  }

  disconnectedCallback() {
    this._unsubscribe();
  }

  getCardSize() {
    return 3 + this._rows.length;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  _unsubscribe() {
    const unsub = this._unsub;
    this._unsub = null;
    if (unsub) unsub.then((f) => f()).catch(() => {});
  }

  _resubscribe() {
    this._unsubscribe();
    if (!this._exists() || !this.isConnected) return;
    this._loaded = false;
    this._unsub = this._hass.connection.subscribeMessage(
      (msg) => {
        const { rows, settings } = readItems(this._kind, msg.items || []);
        this._rows = rows;
        this._settings = settings;
        this._loaded = true;
        this._error = null;
        if (this._editing && this._editing !== "new" && !rows.some((r) => r.uid === this._editing)) this._closeForm();
        this._update();
      },
      { type: "todo/item/subscribe", entity_id: this._config.entity },
    );
    this._unsub.catch((e) => {
      this._unsub = null;
      this._error = e?.message || String(e);
      this._update();
    });
  }

  _service(service, data) {
    return this._hass
      .callService("todo", service, data, { entity_id: this._config.entity })
      .catch((e) => {
        this._error = fill(this._strings().save_error, { error: e?.message || e });
        this._update();
        throw e;
      });
  }

  // Creates the card's list with Local To-do, which only an admin may do.
  async _createList() {
    this._creating = true;
    this._error = null;
    this._update();
    try {
      const flow = await this._hass.callApi("POST", "config/config_entries/flow", { handler: "local_todo", show_advanced_options: false });
      const done = await this._hass.callApi("POST", `config/config_entries/flow/${flow.flow_id}`, {
        todo_list_name: listName(this._config.entity),
      });
      if (done.type !== "create_entry") throw new Error(done.reason || "Local To-do didn't create the list");
    } catch (e) {
      this._error = fill(this._strings().create_error, { error: e?.body?.message || e?.message || e });
    }
    this._creating = false;
    this._update();
  }

  _target() {
    return this._local.get("settings")?.target_days ?? this._settings?.target_days ?? this._kind.defaultTarget;
  }

  _cats() {
    const local = this._local.get("settings");
    return local ? readCats(local.cats) : (this._settings?.cats ?? []);
  }

  _batches(r) {
    return this._local.get(r.uid) ?? r.batches;
  }

  // Stores a tapped value after WRITE_DELAY_MS, keeping it on screen meanwhile.
  _queue(key, value, write) {
    this._local.set(key, value);
    clearTimeout(this._timers.get(key));
    this._timers.set(
      key,
      setTimeout(async () => {
        try {
          await write(value);
        } catch {
          // _service has already shown the error.
        }
        if (this._local.get(key) === value) this._local.delete(key);
        this._update();
      }, WRITE_DELAY_MS),
    );
    this._update();
  }

  // Writes the settings item with `patch` applied. The target and the cats
  // share one item, and so one queue, so a change to one can't overwrite a
  // pending change to the other or add the item twice.
  _setSettings(patch) {
    const base = this._local.get("settings") ?? { ...this._settings?.raw, ...(this._kind.cats && { cats: this._cats().map(catJSON) }) };
    this._queue("settings", { ...base, target_days: this._target(), ...patch }, (v) => {
      const description = JSON.stringify(v);
      return this._settings
        ? this._service("update_item", { item: this._settings.uid, description })
        : this._service("add_item", { item: this._kind.settings, description });
    });
  }

  _setTarget(days) {
    this._setSettings({ target_days: Math.max(1, days) });
  }

  _setBatches(r, batches) {
    // The other figures are read when the write happens, in case the item was edited meanwhile.
    this._queue(r.uid, batches, (v) => {
      const now = this._rows.find((x) => x.uid === r.uid) || r;
      return this._service("update_item", { item: r.uid, description: itemJSON(this._kind, { ...now, batches: v }) });
    });
  }

  // The form and the add button are built once, so a half-typed entry survives
  // updates; their text is set by _update() through data-t, a STRINGS key.
  _build() {
    if (this._built) return;
    this._built = true;
    const kind = this._kind;
    this.shadowRoot.innerHTML = `
      <style>${STYLE}</style>
      <ha-card>
        <div class="summary"></div>
        ${kind.cats ? `<div class="cats"><div class="head"><b data-t="cats"></b><span class="catsum"></span></div><ul class="catlist"></ul>
        <div class="cat-foot"><button type="button" class="add-cat" data-t="add_cat"></button></div>
        <form class="catform" hidden>
          <label><span data-t="name"></span><input name="cat_name" required maxlength="40" autocomplete="off"></label>
          <label><span data-t="diet"></span><select name="diet"><option value="wet" data-t="wet"></option><option value="dry" data-t="dry"></option><option value="both" data-t="wet_dry"></option></select></label>
          ${TYPES.map(
            (type) => `<fieldset data-type="${type}"><legend data-t="${type}"></legend>
            <label><span data-t="meals_per_day"></span><input name="${type}_meals" type="number" min="1" max="20" step="1" required></label>
            <label><span data-t="grams_a_meal"></span><input name="${type}_g" type="number" min="1" step="any" required></label>
          </fieldset>`,
          ).join("")}
          <div class="actions">
            <button type="submit" class="primary cat-save" data-t="add"></button>
            <button type="button" class="cat-cancel" data-t="cancel"></button>
            <button type="button" class="danger cat-remove" data-t="remove" hidden></button>
          </div>
        </form></div>` : ""}
        <ul class="list"></ul>
        <div class="foot"><button type="button" class="add" data-t="${kind.add}"></button></div>
        <form hidden style="--fields: ${kind.fields.length}">
          <label class="field-name"><span data-t="name"></span><input name="item_name" required maxlength="80" autocomplete="off"></label>
          ${kind.fields
            .map((f) =>
              f.choices
                ? `<label><span data-t="${f.label}"></span><select name="${f.key}">${f.choices.map((c) => `<option value="${c}" data-t="${c}"></option>`).join("")}</select></label>`
                : `<label><span data-t="${f.label}"></span><input name="${f.key}" type="number" min="${f.min}" step="any" required></label>`,
            )
            .join("")}
          <div class="actions">
            <button type="submit" class="primary save" data-t="add"></button>
            <button type="button" class="cancel" data-t="cancel"></button>
            <button type="button" class="danger remove" data-t="remove" hidden></button>
          </div>
        </form>
      </ha-card>`;
    const root = this.shadowRoot;
    this._form = root.querySelector("form:not(.catform)");
    root.querySelector(".add").addEventListener("click", () => this._openForm("new"));
    root.querySelector(".cancel").addEventListener("click", () => this._closeForm());
    root.querySelector(".remove").addEventListener("click", () => {
      const uid = this._editing;
      this._closeForm();
      clearTimeout(this._timers.get(uid));
      this._local.delete(uid);
      this._service("remove_item", { item: [uid] }).catch(() => {});
    });
    this._form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(this._form);
      const name = String(fd.get("item_name")).trim();
      if (!name) return;
      const fields = {};
      for (const f of kind.fields) fields[f.key] = readField(f, fd.get(f.key));
      const old = this._rows.find((r) => r.uid === this._editing);
      if (old) {
        const data = { item: old.uid, description: itemJSON(kind, { ...fields, batches: this._batches(old) }) };
        if (name !== old.name) data.rename = name;
        this._service("update_item", data).catch(() => {});
      } else {
        this._service("add_item", { item: name, description: itemJSON(kind, { ...fields, batches: [] }) }).catch(() => {});
      }
      this._closeForm();
    });
    if (kind.cats) this._buildCats();
    // One listener for every row's buttons, since rows are rebuilt on each update.
    root.querySelector(".summary").addEventListener("click", (e) => {
      if (e.target.closest("button.create")) return this._createList();
      const b = e.target.closest("button[data-target]");
      if (b) this._setTarget(this._target() + Number(b.dataset.target));
    });
    const list = root.querySelector(".list");
    list.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      const r = b && this._rows.find((x) => x.uid === b.closest("li").dataset.uid);
      if (!r) return;
      const batches = this._batches(r);
      const editing = this._batchEdit;
      if (b.classList.contains("edit")) this._openForm(r.uid);
      else if (b.classList.contains("batch")) {
        const n = b.dataset.n ? Number(b.dataset.n) : null;
        if (editing?.uid === r.uid && editing.n === n) {
          this._batchEdit = null;
        } else if (n) {
          const old = batches.find((x) => x.n === n);
          this._batchEdit = { uid: r.uid, n, exp: old.exp, month: old.exp?.slice(0, 7) ?? "", count: old.count };
        } else {
          // A new batch starts at the newest batch's month, the likeliest for a restock.
          const dated = batches.filter((x) => x.exp);
          const month = dated.length ? dated.reduce((a, x) => (x.n > a.n ? x : a)).exp.slice(0, 7) : "";
          this._batchEdit = { uid: r.uid, n: null, month, count: 1 };
        }
        this._update();
        list.querySelector(".dating input")?.focus();
      } else if (b.classList.contains("batch-save")) {
        const count = Math.floor(num(editing.count));
        if (editing.month && !EXPIRY.test(editing.month)) return;
        // A month picker can't show a full date, so an untouched month keeps the day.
        const exp = editing.exp?.startsWith(editing.month) && editing.month ? editing.exp : editing.month || null;
        this._batchEdit = null;
        if (editing.n) this._setBatches(r, setBatch(batches, editing.n, exp, count));
        else if (count) this._setBatches(r, addBatch(batches, exp, count));
        else this._update();
      } else if (b.classList.contains("batch-remove")) {
        this._batchEdit = null;
        this._setBatches(r, setBatch(batches, editing.n, editing.exp, 0));
      } else if (b.classList.contains("batch-cancel")) {
        this._batchEdit = null;
        this._update();
      }
    });
    // What's typed in the batch form survives the row being rebuilt by an update.
    list.addEventListener("input", (e) => {
      const field = e.target.closest(".dating") && e.target.name;
      if (field && this._batchEdit) this._batchEdit[field] = e.target.value;
    });
  }

  _openForm(uid) {
    if (this._catEditing !== null) this._closeCat();
    const r = this._rows.find((x) => x.uid === uid);
    this._editing = uid;
    this._form.reset();
    if (r) {
      this._form.elements.item_name.value = r.name;
      for (const f of this._kind.fields) this._form.elements[f.key].value = r[f.key];
    }
    this._form.querySelector(".save").dataset.t = r ? "save" : "add";
    this._form.querySelector(".remove").hidden = !r;
    this._form.hidden = false;
    this._update();
    this._form.elements.item_name.focus();
  }

  _closeForm() {
    this._editing = null;
    this._form.hidden = true;
    this._update();
  }

  _buildCats() {
    const root = this.shadowRoot;
    const form = root.querySelector(".catform");
    const diet = root.querySelector(".catform select");
    // A hidden fieldset is also disabled, so its required inputs don't block saving.
    this._showMeals = () => {
      for (const type of TYPES) {
        const set = root.querySelector(`fieldset[data-type="${type}"]`);
        set.hidden = set.disabled = !(diet.value === type || diet.value === "both");
      }
    };
    diet.addEventListener("change", this._showMeals);
    root.querySelector(".add-cat").addEventListener("click", () => this._openCat("new"));
    root.querySelector(".cat-cancel").addEventListener("click", () => this._closeCat());
    root.querySelector(".cat-remove").addEventListener("click", () => {
      const i = this._catEditing;
      this._closeCat();
      this._setSettings({ cats: this._cats().filter((_, j) => j !== i).map(catJSON) });
    });
    root.querySelector(".catlist").addEventListener("click", (e) => {
      const b = e.target.closest("button.edit");
      if (b) this._openCat(Number(b.closest("li").dataset.cat));
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const meal = (type) => (fd.has(`${type}_meals`) ? { meals: fd.get(`${type}_meals`), g: fd.get(`${type}_g`) } : null);
      const [cat] = readCats([{ name: String(fd.get("cat_name")), wet: meal("wet"), dry: meal("dry") }]);
      if (!cat) return;
      const cats = [...this._cats()];
      if (this._catEditing === "new") cats.push(cat);
      else cats[this._catEditing] = cat;
      this._closeCat();
      this._setSettings({ cats: cats.map(catJSON) });
    });
  }

  // Opens the cat form on cat `i` of _cats(), or on a new cat for "new".
  _openCat(i) {
    if (this._editing) this._closeForm();
    const root = this.shadowRoot;
    const c = i === "new" ? null : this._cats()[i];
    const field = (name) => root.querySelector(`.catform [name="${name}"]`);
    this._catEditing = i;
    root.querySelector(".catform").reset();
    field("cat_name").value = c?.name ?? "";
    field("diet").value = !c || (c.wet && c.dry) ? "both" : c.wet ? "wet" : "dry";
    for (const type of TYPES) {
      field(`${type}_meals`).value = c?.[type]?.meals ?? "";
      field(`${type}_g`).value = c?.[type]?.g ?? "";
    }
    this._showMeals();
    root.querySelector(".cat-save").dataset.t = c ? "save" : "add";
    root.querySelector(".cat-remove").hidden = !c;
    root.querySelector(".catform").hidden = false;
    this._update();
    field("cat_name").focus();
  }

  _closeCat() {
    this._catEditing = null;
    this.shadowRoot.querySelector(".catform").hidden = true;
    this._update();
  }

  // The cat card's summary, cats and rows. Wet and dry food each last a number
  // of days; the card counts the days until the first runs out.
  _updateCats(t, locale, title) {
    const root = this.shadowRoot;
    const kind = this._kind;
    const list = root.querySelector(".list");
    const fmt = (v) => kind.fmt(v, locale);
    const days = (d) => esc(fill(t.days_short, { n: fmtDays(d, locale) }));
    const target = this._target();
    const cats = this._cats();
    const need = catNeeds(cats);
    const rows = this._rows.map((r, i) => {
      const batches = this._batches(r);
      const n = totalCount(batches);
      return { r, n, batches, amount: n * kind.each(r), color: PALETTE[i % PALETTE.length] };
    });
    const stock = Object.fromEntries(TYPES.map((type) => [type, rows.filter((x) => x.r.type === type).reduce((sum, x) => sum + x.amount, 0)]));
    const { eaten, days: left, first, overall } = catDays(need, stock);
    const now = new Date();
    const focused = root.activeElement;
    const targetFocus = focused?.dataset?.target;

    const line = (type) => {
      const marked = type === first && eaten.length > 1;
      const parts = [esc(t[type]), days(left[type]), `${fmt(stock[type])} / ${fmt(target * need[type].perDay)}`];
      if (marked) parts.push(esc(t.runs_out_first));
      return `<div class="amount${marked ? " first" : ""}">${parts.join(" · ")}</div>`;
    };
    const bar = (type) => {
      const goal = target * need[type].perDay;
      const own = rows.filter((x) => x.r.type === type);
      return `<div class="barrow"><span>${esc(t[type])}</span><div class="bar" role="img" aria-label="${esc(t[type])}: ${fmt(stock[type])} / ${fmt(goal)}">${segments(own, Math.max(goal, stock[type]) || 1)}</div></div>`;
    };
    root.querySelector(".summary").innerHTML = `
      <div class="head">
        <div>
          <div class="title">${esc(title)}</div>
          ${
            first
              ? `<div class="days ${overall < target ? "low" : "met"}">${fmtDays(overall, locale)}<small>${esc(plural(t.of_days, target, locale))}</small></div>
          ${eaten.map(line).join("")}
          <div class="amount">${esc(plural(t.cat_count, cats.length, locale))} · ${esc(plural(t.meals_a_day, need.wet.meals + need.dry.meals, locale))}</div>`
              : `<p class="empty">${esc(t.no_cats)}</p>`
          }
        </div>
        ${targetHTML(t, target, locale)}
      </div>
      ${eaten.length ? `<div class="bars">${eaten.map(bar).join("")}</div>` : ""}
      ${this._error ? `<div class="error">${esc(this._error)}</div>` : ""}`;
    if (targetFocus) root.querySelector(`.summary button[data-target="${targetFocus}"]`)?.focus();

    root.querySelector(".catsum").textContent = eaten.length
      ? fill(t.per_day, { amount: eaten.map((type) => `${t[type]} ${fmt(need[type].perDay)}`).join(" · ") })
      : "";
    root.querySelector(".catlist").innerHTML = cats
      .map((c, i) => {
        const diet = c.wet && c.dry ? "wet_dry" : c.wet ? "wet" : "dry";
        const meals = TYPES.filter((type) => c[type])
          .map((type) => `${t[type]} ${fill(t.meal_amount, { n: fmtNumber(c[type].meals, locale), amount: fmt(c[type].g) })}`)
          .join(" · ");
        return `<li data-cat="${i}">
        <div class="name"><span>${esc(c.name)}</span><span class="diet">${esc(t[diet])}</span></div>
        <div class="sub">${esc(meals)}</div>
        <div class="count"><button type="button" class="edit" aria-label="${esc(fill(t.edit_cat, { name: c.name }))}"><ha-icon icon="mdi:pencil"></ha-icon></button></div>
      </li>`;
      })
      .join("");

    const refocus = focused?.classList?.contains("edit") && focused.closest("li").dataset.uid;
    // A type no cat eats still lists its stock, so none of it is hidden.
    const shown = TYPES.filter((type) => need[type].perDay > 0 || rows.some((x) => x.r.type === type));
    list.innerHTML = rows.length
      ? shown
          .map((type) => {
            const { perDay, meals, names } = need[type];
            // The average meal of this type, to show how many meals a row holds.
            const meal = meals ? perDay / meals : 0;
            const head = `<li class="section"><b>${esc(t[`${type}_food`])}</b><span>${
              perDay ? `${esc(fill(t.per_day, { amount: fmt(perDay) }))} · ${esc(names.join(", "))}` : esc(t.nobody_eats)
            }</span></li>`;
            return (
              head +
              rows
                .filter((x) => x.r.type === type)
                .map((x) => {
                  const each = fill(t.each, { amount: fmt(x.r.grams) });
                  const sub = meal ? `${each} · ${plural(t.meals, Math.floor(x.amount / meal), locale)}` : each;
                  return this._row(x, perDay, sub, t, locale, now);
                })
                .join("")
            );
          })
          .join("")
      : `<li class="empty">${esc(t[kind.empty])}</li>`;
    if (refocus) [...list.children].find((x) => x.dataset.uid === refocus)?.querySelector("button.edit")?.focus();
  }

  // One stock row: its total, days at `perDay` (none when 0), `sub` under
  // its name, its count and its batches.
  _row({ r, n, batches, amount, color }, perDay, sub, t, locale, now) {
    const fmt = (v) => this._kind.fmt(v, locale);
    const editing = this._batchEdit;
    return `
      <li data-uid="${esc(r.uid)}">
        <div class="name"><span class="dot" style="background:${color}"></span><span>${esc(r.name)}</span></div>
        <div class="total">${fmt(amount)}${perDay ? ` · ${esc(fill(t.days_short, { n: fmtDays(amount / perDay, locale) }))}` : ""}</div>
        <div class="sub">${esc(sub)}</div>
        <div class="count">
          <button type="button" class="edit" aria-label="${esc(fill(t.edit, { name: r.name }))}"><ha-icon icon="mdi:pencil"></ha-icon></button>
          <output>${fmtNumber(n, locale)}</output>
        </div>
        <div class="batches">
          ${[...batches]
            .sort(byExpiry)
            .map((b) => {
              const label = fill(t.batch, { n: b.n });
              const open = editing?.uid === r.uid && editing.n === b.n && "open";
              const cls = ["batch", expiryState(b.exp, now), open].filter(Boolean).join(" ");
              return `<button type="button" class="${cls}" data-n="${b.n}" aria-label="${esc(fill(t.edit_batch, { batch: label, name: r.name }))}"><b>${esc(label)}</b>${fmtNumber(b.count, locale)} · ${
                b.exp ? `<time datetime="${b.exp}">${esc(fmtExpiry(b.exp, locale))}</time>` : esc(t.no_date)
              }</button>`;
            })
            .join("")}
          <button type="button" class="batch new" aria-label="${esc(fill(t.new_batch, { name: r.name }))}">+ ${esc(fill(t.batch, { n: nextBatch(batches) }))}</button>
        </div>
        ${
          editing?.uid === r.uid
            ? `<div class="dating">
          <label><span>${esc(t.best_before)}</span><input name="month" type="month" value="${esc(editing.month)}"></label>
          <label><span>${esc(t.quantity)}</span><input name="count" type="number" min="${editing.n ? 0 : 1}" step="1" value="${esc(editing.count)}" class="qty"></label>
          <button type="button" class="primary batch-save">${esc(editing.n ? t.save : t.add)}</button>
          <button type="button" class="batch-cancel">${esc(t.cancel)}</button>
          ${editing.n ? `<button type="button" class="danger batch-remove">${esc(t.remove)}</button>` : ""}
        </div>`
            : ""
        }
      </li>`;
  }

  _update() {
    if (!this._built) return;
    const kind = this._kind;
    const root = this.shadowRoot;
    const summary = root.querySelector(".summary");
    const list = root.querySelector(".list");
    const locale = this._locale();
    const t = this._strings();
    root.querySelector("ha-card").setAttribute("lang", locale);
    for (const el of root.querySelectorAll("[data-t]")) el.textContent = t[el.dataset.t];
    const title = this._config.title ?? t[kind.title];
    if (this._hass && !this._exists()) {
      const name = listName(this._config.entity);
      summary.innerHTML = `
        <div class="title">${esc(title)}</div>
        <p class="empty">${esc(fill(t.missing, { entity: this._config.entity }))}</p>
        ${
          this._hass.user?.is_admin
            ? `<button type="button" class="primary create" ${this._creating ? "disabled" : ""}>${esc(fill(t.create, { name }))}</button>`
            : `<p class="empty">${esc(fill(t.ask_admin, { name }))}</p>`
        }
        ${this._error ? `<div class="error">${esc(this._error)}</div>` : ""}`;
      list.innerHTML = "";
      root.querySelector(".foot").hidden = true;
      if (root.querySelector(".cats")) root.querySelector(".cats").hidden = true;
      return;
    }
    root.querySelector(".foot").hidden = Boolean(this._editing) || this._catEditing !== null;
    const cats = root.querySelector(".cats");
    if (cats) {
      cats.hidden = false;
      root.querySelector(".cat-foot").hidden = Boolean(this._editing) || this._catEditing !== null;
    }
    if (this._error && !this._loaded) {
      summary.innerHTML = `<div class="error">${esc(this._error)}</div>`;
      list.innerHTML = "";
      return;
    }
    if (!this._loaded) {
      summary.innerHTML = `<div class="empty">${esc(t.loading)}</div>`;
      return;
    }
    if (kind.cats) return this._updateCats(t, locale, title);
    const { people, perDay } = household(kind, this._config, t, locale);
    if (!perDay) {
      summary.innerHTML = `<div class="error">${esc(t.nobody)}</div>`;
      list.innerHTML = "";
      return;
    }
    const fmt = (v) => kind.fmt(v, locale);
    const target = this._target();
    const goal = target * perDay;
    const rows = this._rows.map((r, i) => {
      const batches = this._batches(r);
      const n = totalCount(batches);
      return { r, n, batches, amount: n * kind.each(r), color: PALETTE[i % PALETTE.length] };
    });
    const now = new Date();
    const total = rows.reduce((sum, x) => sum + x.amount, 0);
    const days = total / perDay;
    const scale = Math.max(goal, total) || 1;
    const focused = root.activeElement;
    const targetFocus = focused?.dataset?.target;
    summary.innerHTML = `
      <div class="head">
        <div>
          <div class="title">${esc(title)}</div>
          <div class="days ${days < target ? "low" : "met"}">${fmtDays(days, locale)}<small>${esc(plural(t.of_days, target, locale))}</small></div>
          <div class="amount">${fmt(total)} / ${fmt(goal)}</div>
          <div class="amount">${esc(people)} · ${esc(fill(t.per_day, { amount: fmt(perDay) }))}</div>
        </div>
        ${targetHTML(t, target, locale)}
      </div>
      <div class="bar" role="img" aria-label="${fmt(total)} / ${fmt(goal)}">${segments(rows, scale)}</div>
      ${this._error ? `<div class="error">${esc(this._error)}</div>` : ""}`;
    if (targetFocus) summary.querySelector(`button[data-target="${targetFocus}"]`)?.focus();
    const refocus = focused?.classList?.contains("edit") && focused.closest("li").dataset.uid;
    list.innerHTML = rows.length
      ? rows.map((x) => this._row(x, perDay, fill(t.each, { amount: fmt(kind.each(x.r)) }), t, locale, now)).join("")
      : `<li class="empty">${esc(t[kind.empty])}</li>`;
    // Rows are rebuilt on each update, so put keyboard focus back on the button that was pressed.
    if (refocus) [...list.children].find((x) => x.dataset.uid === refocus)?.querySelector("button.edit")?.focus();
  }
}

window.customCards = window.customCards || [];
for (const kind of Object.values(KINDS)) {
  customElements.define(kind.tag, class extends StockpileCard {
    static kind = kind;
  });
  window.customCards.push({
    type: kind.tag,
    name: kind.name,
    description: kind.description,
    preview: false,
    documentationURL: "https://github.com/matteo-pacini/ZPCards#prepping-cards",
  });
}
