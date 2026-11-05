// =========================================================
// PAGE PILOTES
// Le thème et le menu mobile sont déjà gérés par index.js
// =========================================================
const API_BASE = "https://api.jolpi.ca/ergast/f1";

const seasonSelect = document.getElementById("seasonSelect");
const searchInput = document.getElementById("driverSearch");
const grid = document.getElementById("drivers");
const countText = document.getElementById("driverCount");
const emptyText = document.getElementById("driversEmpty");

let allDrivers = []; // les pilotes de la saison affichée

// --- Couleur de chaque écurie (sinon : rouge Overtake) ---
const TEAM_COLORS = {
    red_bull: "#3671c6",
    ferrari: "#e8002d",
    mercedes: "#27f4d2",
    mclaren: "#ff8000",
    aston_martin: "#229971",
    alpine: "#0093cc",
    williams: "#64c4ff",
    rb: "#6692ff",
    sauber: "#52e252",
    audi: "#bb0a30",
    haas: "#b6babd",
    cadillac: "#c9c9c9",
};

// --- Nationalités en français (les plus courantes) ---
const NATIONALITIES = {
    Dutch: "Pays-Bas", British: "Royaume-Uni", Monegasque: "Monaco", Spanish: "Espagne",
    Mexican: "Mexique", Australian: "Australie", French: "France", German: "Allemagne",
    Finnish: "Finlande", Canadian: "Canada", Japanese: "Japon", Thai: "Thaïlande",
    Chinese: "Chine", Danish: "Danemark", American: "États-Unis", Italian: "Italie",
    "New Zealander": "Nouvelle-Zélande", Argentine: "Argentine", Argentinian: "Argentine",
    Brazilian: "Brésil", Belgian: "Belgique", Austrian: "Autriche", Swiss: "Suisse",
    Swedish: "Suède", Polish: "Pologne", Russian: "Russie", Venezuelan: "Venezuela",
    Colombian: "Colombie", Portuguese: "Portugal", Irish: "Irlande", Indian: "Inde",
    Indonesian: "Indonésie", Hungarian: "Hongrie", Czech: "Tchéquie", "South African": "Afrique du Sud",
};

// Petite sécurité : on échappe le texte venant de l'API avant de le mettre dans le HTML
function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// --- 1. Remplir la liste des saisons (de l'année en cours jusqu'à 1950) ---
function fillSeasons() {
    const thisYear = new Date().getFullYear();
    let options = `<option value="current">${thisYear} (en cours)</option>`;
    for (let year = thisYear - 1; year >= 1950; year--) {
        options += `<option value="${year}">${year}</option>`;
    }
    seasonSelect.innerHTML = options;
}

// --- 2. Fabriquer la carte HTML d'un pilote ---
function driverCard(d) {
    const driver = d.Driver;
    const team = d.Constructors[0] || { name: "—", constructorId: "" };
    const color = TEAM_COLORS[team.constructorId] || "var(--accent)";
    const nationality = NATIONALITIES[driver.nationality] || driver.nationality;
    const number = driver.permanentNumber || "";
    const birthYear = driver.dateOfBirth ? driver.dateOfBirth.slice(0, 4) : "—";

    return `
    <article class="driver" style="--team: ${color}">
        <span class="driver__number" aria-hidden="true">${escapeHTML(number)}</span>
        <div class="driver__top">
            <span class="driver__pos">P${escapeHTML(d.position || "—")}</span>
            <span class="driver__code">${escapeHTML(driver.code || "")}</span>
        </div>
        <h3 class="driver__name">
            <small>${escapeHTML(driver.givenName)}</small>
            ${escapeHTML(driver.familyName)}
        </h3>
        <p class="driver__team">${escapeHTML(team.name)}</p>
        <p class="driver__nat">${escapeHTML(nationality)}</p>
        <dl class="driver__stats">
            <div><dt>Points</dt><dd>${escapeHTML(d.points)}</dd></div>
            <div><dt>Victoires</dt><dd>${escapeHTML(d.wins)}</dd></div>
            <div><dt>Naissance</dt><dd>${escapeHTML(birthYear)}</dd></div>
        </dl>
        <a class="driver__link" href="${escapeHTML(driver.url)}" target="_blank" rel="noopener noreferrer">Voir sa carrière ↗</a>
    </article>`;
}

// --- 3. Afficher les pilotes (en tenant compte de la recherche) ---
function render() {
    const query = searchInput.value.trim().toLowerCase();

    const filtered = allDrivers.filter((d) => {
        const text = [
            d.Driver.givenName, d.Driver.familyName, d.Driver.code,
            d.Driver.nationality, NATIONALITIES[d.Driver.nationality],
            ...d.Constructors.map((c) => c.name),
        ].join(" ").toLowerCase();
        return text.includes(query);
    });

    grid.innerHTML = filtered.map(driverCard).join("");
    emptyText.hidden = filtered.length > 0;
    countText.textContent = `${filtered.length} pilote${filtered.length > 1 ? "s" : ""}`;
}

// --- 4. Charger une saison depuis l'API ---
async function loadSeason(season) {
    grid.innerHTML = '<div class="driver driver--loading"></div>'.repeat(8);
    countText.textContent = "Chargement…";
    emptyText.hidden = true;

    try {
        const response = await fetch(`${API_BASE}/${season}/driverStandings.json?limit=100`);
        const data = await response.json();
        const lists = data.MRData.StandingsTable.StandingsLists;

        if (!lists.length) {
            allDrivers = [];
            grid.innerHTML = "";
            countText.textContent = "";
            emptyText.textContent = "Pas encore de classement pour cette saison.";
            emptyText.hidden = false;
            return;
        }

        allDrivers = lists[0].DriverStandings;
        emptyText.textContent = "Aucun pilote ne correspond à ta recherche.";
        render();
    } catch (error) {
        grid.innerHTML = "";
        countText.textContent = "";
        emptyText.textContent = "Impossible de charger les pilotes pour le moment. Réessaie plus tard.";
        emptyText.hidden = false;
        console.error(error);
    }
}

// --- 5. Lancement ---
fillSeasons();
loadSeason("current");

seasonSelect.addEventListener("change", () => loadSeason(seasonSelect.value));
searchInput.addEventListener("input", render);
