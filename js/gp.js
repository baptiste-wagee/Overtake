// =========================================================
// PAGE GRANDS PRIX (calendrier + palmarès)
// Le thème et le menu mobile sont déjà gérés par index.js
// =========================================================
const API_BASE = "https://api.jolpi.ca/ergast/f1";
const THIS_YEAR = new Date().getFullYear();

const seasonSelect = document.getElementById("seasonSelect");
const racesGrid = document.getElementById("races");
const raceCount = document.getElementById("raceCount");
const racesEmpty = document.getElementById("racesEmpty");

const dialog = document.getElementById("resultDialog");
const resultRound = document.getElementById("resultRound");
const resultTitle = document.getElementById("resultTitle");
const resultBody = document.getElementById("resultBody");

let currentSeason = "current"; // saison affichée dans le calendrier
let currentSeasonInProgress = false; // la saison en cours n'est pas encore terminée ?

// --- Pays : nom en français + code pour le drapeau (flagcdn.com) ---
const COUNTRIES = {
    Australia: ["Australie", "au"], Bahrain: ["Bahreïn", "bh"], "Saudi Arabia": ["Arabie saoudite", "sa"],
    Japan: ["Japon", "jp"], China: ["Chine", "cn"], USA: ["États-Unis", "us"], "United States": ["États-Unis", "us"],
    Italy: ["Italie", "it"], Monaco: ["Monaco", "mc"], Spain: ["Espagne", "es"], Canada: ["Canada", "ca"],
    Austria: ["Autriche", "at"], UK: ["Royaume-Uni", "gb"], Hungary: ["Hongrie", "hu"], Belgium: ["Belgique", "be"],
    Netherlands: ["Pays-Bas", "nl"], Azerbaijan: ["Azerbaïdjan", "az"], Singapore: ["Singapour", "sg"],
    Mexico: ["Mexique", "mx"], Brazil: ["Brésil", "br"], Qatar: ["Qatar", "qa"], UAE: ["Émirats arabes unis", "ae"],
    Portugal: ["Portugal", "pt"], Turkey: ["Turquie", "tr"], Russia: ["Russie", "ru"], France: ["France", "fr"],
    Germany: ["Allemagne", "de"], Argentina: ["Argentine", "ar"], "South Africa": ["Afrique du Sud", "za"],
    Malaysia: ["Malaisie", "my"], Korea: ["Corée du Sud", "kr"], India: ["Inde", "in"], Sweden: ["Suède", "se"],
    Switzerland: ["Suisse", "ch"], Morocco: ["Maroc", "ma"], Vietnam: ["Viêt Nam", "vn"], Madrid: ["Espagne", "es"],
};

function escapeHTML(text) {
    return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function getJSON(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Erreur ${response.status}`);
    return response.json();
}

// "2026-11-09" + "17:00:00Z" -> objet Date (heure de la course)
function raceDate(race) {
    return new Date(`${race.date}T${race.time || "12:00:00Z"}`);
}

function formatDay(dateText) {
    const date = new Date(`${dateText}T12:00:00Z`);
    if (isNaN(date)) return ""; // date absente ou invalide
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/* =========================================================
   1. ONGLETS
   ========================================================= */
const tabs = document.querySelectorAll(".tab");
let palmaresLoaded = false;

function openTab(name) {
    tabs.forEach((tab) => {
        const active = tab.dataset.tab === name;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
    });
    document.getElementById("panel-calendrier").hidden = name !== "calendrier";
    document.getElementById("panel-palmares").hidden = name !== "palmares";

    // Le palmarès n'est chargé qu'une fois, la première fois qu'on ouvre l'onglet
    if (name === "palmares" && !palmaresLoaded) {
        palmaresLoaded = true;
        loadPalmares();
    }
}

tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        openTab(tab.dataset.tab);
        history.replaceState(null, "", `#${tab.dataset.tab}`);
    });
});

/* =========================================================
   2. CALENDRIER
   ========================================================= */
function fillSeasons() {
    let options = `<option value="current">${THIS_YEAR} (en cours)</option>`;
    for (let year = THIS_YEAR - 1; year >= 1950; year--) {
        options += `<option value="${year}">${year}</option>`;
    }
    seasonSelect.innerHTML = options;
}

function raceCard(race, winner, status, daysLeft) {
    const [countryFr, code] = COUNTRIES[race.Circuit.Location.country] || [race.Circuit.Location.country, ""];
    const firstDay = race.FirstPractice ? formatDay(race.FirstPractice.date) : "";
    const start = firstDay ? firstDay + " – " : "";
    const flag = code ? `<img class="race__flag" src="https://flagcdn.com/w40/${code}.png" alt="" loading="lazy">` : "";

    let footer = '<span class="race__soon">À venir</span>';
    if (status === "done" && winner) {
        footer = `<span class="race__winner">🏆 ${escapeHTML(winner.Driver.givenName)} <b>${escapeHTML(winner.Driver.familyName)}</b></span>
                  <span class="race__team">${escapeHTML(winner.Constructor.name)}</span>`;
    } else if (status === "done") {
        footer = '<span class="race__soon">Résultat bientôt disponible</span>';
    } else if (status === "next") {
        const when = daysLeft <= 0 ? "Ce week-end" : `Dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`;
        footer = `<span class="race__next">Prochaine course · ${when}</span>`;
    }

    // Une course terminée est un bouton : un clic ouvre le résultat complet
    const tag = status === "done" && winner ? "button" : "div";

    return `
    <${tag} class="race race--${status}" ${tag === "button" ? `data-round="${escapeHTML(race.round)}" data-name="${escapeHTML(race.raceName)}"` : ""}>
        <div class="race__top">
            <span class="race__round">${String(race.round).padStart(2, "0")}</span>
            ${race.Sprint ? '<span class="race__badge">Sprint</span>' : ""}
        </div>
        <p class="race__country">${flag}${escapeHTML(countryFr)}</p>
        <h3 class="race__name">${escapeHTML(race.raceName)}</h3>
        <p class="race__circuit">${escapeHTML(race.Circuit.circuitName)}</p>
        <p class="race__date">${start}${formatDay(race.date)}</p>
        <div class="race__footer">${footer}</div>
    </${tag}>`;
}

async function loadCalendar(season) {
    currentSeason = season;
    racesGrid.innerHTML = '<div class="race race--loading"></div>'.repeat(6);
    raceCount.textContent = "Chargement…";
    racesEmpty.hidden = true;

    try {
        // Le calendrier ET tous les vainqueurs de la saison, en 2 requêtes seulement
        const [schedule, winners] = await Promise.all([
            getJSON(`${API_BASE}/${season}.json?limit=100`),
            getJSON(`${API_BASE}/${season}/results/1.json?limit=100`),
        ]);
        const races = schedule.MRData.RaceTable.Races;
        const winnerByRound = {};
        winners.MRData.RaceTable.Races.forEach((r) => { winnerByRound[r.round] = r.Results[0]; });

        if (!races.length) {
            racesGrid.innerHTML = "";
            raceCount.textContent = "";
            racesEmpty.textContent = "Pas encore de calendrier pour cette saison.";
            racesEmpty.hidden = false;
            return;
        }

        const now = new Date();
        let nextFound = false;
        racesGrid.innerHTML = races.map((race) => {
            const finished = raceDate(race) < now;
            let status = finished ? "done" : "later";
            let daysLeft = 0;
            if (!finished && !nextFound) {
                status = "next";
                nextFound = true;
                daysLeft = Math.ceil((raceDate(race) - now) / 86400000);
            }
            return raceCard(race, winnerByRound[race.round], status, daysLeft);
        }).join("");

        if (season === "current") currentSeasonInProgress = nextFound;
        const done = races.filter((r) => raceDate(r) < now).length;
        raceCount.textContent = `${races.length} Grands Prix · ${done} disputé${done > 1 ? "s" : ""}`;
    } catch (error) {
        racesGrid.innerHTML = "";
        raceCount.textContent = "";
        racesEmpty.textContent = "Impossible de charger le calendrier pour le moment. Réessaie plus tard.";
        racesEmpty.hidden = false;
        console.error(error);
    }
}

/* =========================================================
   3. RÉSULTAT COMPLET D'UNE COURSE (fenêtre)
   ========================================================= */
async function openResult(round, name) {
    resultRound.textContent = `Manche ${round}`;
    resultTitle.textContent = name;
    resultBody.innerHTML = '<tr><td colspan="5">Chargement…</td></tr>';
    dialog.showModal();

    try {
        const data = await getJSON(`${API_BASE}/${currentSeason}/${round}/results.json?limit=100`);
        const results = data.MRData.RaceTable.Races[0].Results;
        resultBody.innerHTML = results.map((r) => `
            <tr class="${Number(r.position) <= 3 ? "is-podium" : ""}">
                <td>${escapeHTML(r.positionText)}</td>
                <td>${escapeHTML(r.Driver.givenName)} <b>${escapeHTML(r.Driver.familyName)}</b></td>
                <td>${escapeHTML(r.Constructor.name)}</td>
                <td>${escapeHTML(r.Time ? r.Time.time : r.status)}</td>
                <td>${escapeHTML(r.points)}</td>
            </tr>`).join("");
    } catch (error) {
        resultBody.innerHTML = '<tr><td colspan="5">Impossible de charger le résultat.</td></tr>';
        console.error(error);
    }
}

// Un seul écouteur pour toutes les cartes (même celles créées plus tard)
racesGrid.addEventListener("click", (event) => {
    const card = event.target.closest("button.race");
    if (card) openResult(card.dataset.round, card.dataset.name);
});

document.getElementById("resultClose").addEventListener("click", () => dialog.close());
// Clic en dehors de la fenêtre = fermer
dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
});

/* =========================================================
   4. PALMARÈS
   Les champions passés ne changent plus : ils sont écrits ici.
   L'API sert seulement pour la saison en cours.
   👉 À la fin de chaque saison, ajoute une ligne en haut de la liste.
   ========================================================= */
// [saison, champion pilotes, son écurie, champion constructeurs (créé en 1958)]
const CHAMPIONS = [
    [2025, "Lando Norris", "McLaren", "McLaren"],
    [2024, "Max Verstappen", "Red Bull", "McLaren"],
    [2023, "Max Verstappen", "Red Bull", "Red Bull"],
    [2022, "Max Verstappen", "Red Bull", "Red Bull"],
    [2021, "Max Verstappen", "Red Bull", "Mercedes"],
    [2020, "Lewis Hamilton", "Mercedes", "Mercedes"],
    [2019, "Lewis Hamilton", "Mercedes", "Mercedes"],
    [2018, "Lewis Hamilton", "Mercedes", "Mercedes"],
    [2017, "Lewis Hamilton", "Mercedes", "Mercedes"],
    [2016, "Nico Rosberg", "Mercedes", "Mercedes"],
    [2015, "Lewis Hamilton", "Mercedes", "Mercedes"],
    [2014, "Lewis Hamilton", "Mercedes", "Mercedes"],
    [2013, "Sebastian Vettel", "Red Bull", "Red Bull"],
    [2012, "Sebastian Vettel", "Red Bull", "Red Bull"],
    [2011, "Sebastian Vettel", "Red Bull", "Red Bull"],
    [2010, "Sebastian Vettel", "Red Bull", "Red Bull"],
    [2009, "Jenson Button", "Brawn", "Brawn"],
    [2008, "Lewis Hamilton", "McLaren", "Ferrari"],
    [2007, "Kimi Räikkönen", "Ferrari", "Ferrari"],
    [2006, "Fernando Alonso", "Renault", "Renault"],
    [2005, "Fernando Alonso", "Renault", "Renault"],
    [2004, "Michael Schumacher", "Ferrari", "Ferrari"],
    [2003, "Michael Schumacher", "Ferrari", "Ferrari"],
    [2002, "Michael Schumacher", "Ferrari", "Ferrari"],
    [2001, "Michael Schumacher", "Ferrari", "Ferrari"],
    [2000, "Michael Schumacher", "Ferrari", "Ferrari"],
    [1999, "Mika Häkkinen", "McLaren", "Ferrari"],
    [1998, "Mika Häkkinen", "McLaren", "McLaren"],
    [1997, "Jacques Villeneuve", "Williams", "Williams"],
    [1996, "Damon Hill", "Williams", "Williams"],
    [1995, "Michael Schumacher", "Benetton", "Benetton"],
    [1994, "Michael Schumacher", "Benetton", "Williams"],
    [1993, "Alain Prost", "Williams", "Williams"],
    [1992, "Nigel Mansell", "Williams", "Williams"],
    [1991, "Ayrton Senna", "McLaren", "McLaren"],
    [1990, "Ayrton Senna", "McLaren", "McLaren"],
    [1989, "Alain Prost", "McLaren", "McLaren"],
    [1988, "Ayrton Senna", "McLaren", "McLaren"],
    [1987, "Nelson Piquet", "Williams", "Williams"],
    [1986, "Alain Prost", "McLaren", "Williams"],
    [1985, "Alain Prost", "McLaren", "McLaren"],
    [1984, "Niki Lauda", "McLaren", "McLaren"],
    [1983, "Nelson Piquet", "Brabham", "Ferrari"],
    [1982, "Keke Rosberg", "Williams", "Ferrari"],
    [1981, "Nelson Piquet", "Brabham", "Williams"],
    [1980, "Alan Jones", "Williams", "Williams"],
    [1979, "Jody Scheckter", "Ferrari", "Ferrari"],
    [1978, "Mario Andretti", "Lotus", "Lotus"],
    [1977, "Niki Lauda", "Ferrari", "Ferrari"],
    [1976, "James Hunt", "McLaren", "Ferrari"],
    [1975, "Niki Lauda", "Ferrari", "Ferrari"],
    [1974, "Emerson Fittipaldi", "McLaren", "McLaren"],
    [1973, "Jackie Stewart", "Tyrrell", "Lotus"],
    [1972, "Emerson Fittipaldi", "Lotus", "Lotus"],
    [1971, "Jackie Stewart", "Tyrrell", "Tyrrell"],
    [1970, "Jochen Rindt", "Lotus", "Lotus"],
    [1969, "Jackie Stewart", "Matra", "Matra"],
    [1968, "Graham Hill", "Lotus", "Lotus"],
    [1967, "Denny Hulme", "Brabham", "Brabham"],
    [1966, "Jack Brabham", "Brabham", "Brabham"],
    [1965, "Jim Clark", "Lotus", "Lotus"],
    [1964, "John Surtees", "Ferrari", "Ferrari"],
    [1963, "Jim Clark", "Lotus", "Lotus"],
    [1962, "Graham Hill", "BRM", "BRM"],
    [1961, "Phil Hill", "Ferrari", "Ferrari"],
    [1960, "Jack Brabham", "Cooper", "Cooper"],
    [1959, "Jack Brabham", "Cooper", "Cooper"],
    [1958, "Mike Hawthorn", "Ferrari", "Vanwall"],
    [1957, "Juan Manuel Fangio", "Maserati", null],
    [1956, "Juan Manuel Fangio", "Ferrari", null],
    [1955, "Juan Manuel Fangio", "Mercedes", null],
    [1954, "Juan Manuel Fangio", "Maserati / Mercedes", null],
    [1953, "Alberto Ascari", "Ferrari", null],
    [1952, "Alberto Ascari", "Ferrari", null],
    [1951, "Juan Manuel Fangio", "Alfa Romeo", null],
    [1950, "Giuseppe Farina", "Alfa Romeo", null],
];

function topList(title, counts) {
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return `
    <div class="record">
        <h3>${title}</h3>
        <ol>
            ${top.map(([name, n]) => `<li><span>${escapeHTML(name)}</span><b>${n}</b></li>`).join("")}
        </ol>
    </div>`;
}

// "Max Verstappen" -> Max <b>VERSTAPPEN</b> (le nom de famille en gras)
function nameHTML(fullName) {
    const parts = fullName.split(" ");
    const last = parts.pop();
    return `${escapeHTML(parts.join(" "))} <b>${escapeHTML(last)}</b>`;
}

// Leader (ou champion) de la saison en cours, depuis l'API. Renvoie null si indisponible.
async function loadCurrentSeason() {
    try {
        await calendarReady; // nous dit si la saison est terminée ou non
        const [d, c] = await Promise.all([
            getJSON(`${API_BASE}/current/driverStandings/1.json`),
            getJSON(`${API_BASE}/current/constructorStandings/1.json`),
        ]);
        const dList = d.MRData.StandingsTable.StandingsLists[0];
        const cList = c.MRData.StandingsTable.StandingsLists[0];
        if (!dList) return null;
        const leader = dList.DriverStandings[0];
        return {
            season: Number(dList.season),
            driver: `${leader.Driver.givenName} ${leader.Driver.familyName}`,
            team: leader.Constructors.map((x) => x.name).join(" / "),
            constructor: cList ? cList.ConstructorStandings[0].Constructor.name : null,
            live: currentSeasonInProgress,
        };
    } catch (error) {
        console.error(error);
        return null; // pas grave : on affiche quand même l'historique
    }
}

async function loadPalmares() {
    const body = document.getElementById("champions");
    const records = document.getElementById("records");

    // 1. La liste écrite ci-dessus
    const rows = CHAMPIONS.map(([season, driver, team, constructor]) => ({ season, driver, team, constructor, live: false }));

    // 2. On ajoute la saison en cours si elle n'est pas déjà dans la liste
    const current = await loadCurrentSeason();
    if (current && !rows.some((r) => r.season === current.season)) {
        rows.unshift(current);
    }

    // 3. Comptage des titres (la saison en cours ne compte pas tant qu'elle n'est pas finie)
    const driverTitles = {};
    const teamTitles = {};
    rows.filter((r) => !r.live).forEach((r) => {
        driverTitles[r.driver] = (driverTitles[r.driver] || 0) + 1;
        if (r.constructor) teamTitles[r.constructor] = (teamTitles[r.constructor] || 0) + 1;
    });

    records.innerHTML = topList("Titres pilotes", driverTitles) + topList("Titres constructeurs", teamTitles);

    body.innerHTML = rows.map((r) => `
        <tr class="${r.live ? "is-live" : ""}">
            <td>${r.season}${r.live ? ' <span class="live">en tête</span>' : ""}</td>
            <td>${nameHTML(r.driver)} <small>${escapeHTML(r.team)}</small></td>
            <td>${r.constructor ? escapeHTML(r.constructor) : '<span class="muted">— (pas encore de titre)</span>'}</td>
        </tr>`).join("");
}

/* =========================================================
   5. LANCEMENT
   ========================================================= */
fillSeasons();
const calendarReady = loadCalendar("current");
seasonSelect.addEventListener("change", () => loadCalendar(seasonSelect.value));

// Si l'adresse finit par #palmares, on ouvre directement cet onglet
if (location.hash === "#palmares") openTab("palmares");