// =========================================================
// PAGE ÉQUIPES
// Le thème et le menu mobile sont déjà gérés par index.js
// =========================================================
const API_BASE = "https://api.jolpi.ca/ergast/f1";
const FIRST_SEASON = 1958; // premier championnat constructeurs

const seasonSelect = document.getElementById("seasonSelect");
const searchInput = document.getElementById("teamSearch");
const grid = document.getElementById("teams");
const countText = document.getElementById("teamCount");
const emptyText = document.getElementById("teamsEmpty");

let allTeams = [];    // les écuries de la saison affichée
let leaderPoints = 1; // points du leader, pour la barre de progression

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

// --- Pays en français (les plus courants) ---
const NATIONALITIES = {
    British: "Royaume-Uni", Italian: "Italie", German: "Allemagne", Austrian: "Autriche",
    French: "France", American: "États-Unis", Swiss: "Suisse", Japanese: "Japon",
    Dutch: "Pays-Bas", Canadian: "Canada", Irish: "Irlande", Indian: "Inde",
    Russian: "Russie", Malaysian: "Malaisie", Brazilian: "Brésil", Belgian: "Belgique",
    Spanish: "Espagne", Australian: "Australie", "New Zealander": "Nouvelle-Zélande",
    "South African": "Afrique du Sud", Mexican: "Mexique",
};

// Petite sécurité : on échappe le texte venant de l'API avant de le mettre dans le HTML
function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// --- 1. Remplir la liste des saisons (de l'année en cours jusqu'à 1958) ---
function fillSeasons() {
    const thisYear = new Date().getFullYear();
    let options = `<option value="current">${thisYear} (en cours)</option>`;
    for (let year = thisYear - 1; year >= FIRST_SEASON; year--) {
        options += `<option value="${year}">${year}</option>`;
    }
    seasonSelect.innerHTML = options;
}

// --- 2. Fabriquer la carte HTML d'une écurie ---
function teamCard(t) {
    const team = t.Constructor;
    const color = TEAM_COLORS[team.constructorId] || "var(--accent)";
    const country = NATIONALITIES[team.nationality] || team.nationality;
    const share = Math.max(2, Math.round((Number(t.points) / leaderPoints) * 100));

    const drivers = t.drivers.map((d) => `
        <li>
            <span>${escapeHTML(d.Driver.givenName)} <b>${escapeHTML(d.Driver.familyName)}</b></span>
            <span>${escapeHTML(d.points)} pts</span>
        </li>`).join("");

    return `
    <article class="team" style="--team: ${color}">
        <span class="team__bigpos" aria-hidden="true">${escapeHTML(t.position || "")}</span>
        <div class="team__top">
            <span class="team__pos">P${escapeHTML(t.position || "—")}</span>
            <span class="team__country">${escapeHTML(country)}</span>
        </div>

        <h3 class="team__name">${escapeHTML(team.name)}</h3>

        <dl class="team__stats">
            <div><dt>Points</dt><dd>${escapeHTML(t.points)}</dd></div>
            <div><dt>Victoires</dt><dd>${escapeHTML(t.wins)}</dd></div>
            <div><dt>Pilotes</dt><dd>${t.drivers.length}</dd></div>
        </dl>

        <!-- Barre : points de l'écurie par rapport au leader -->
        <div class="team__bar" title="${share} % des points du leader"><i style="width: ${share}%"></i></div>

        <ul class="team__drivers">${drivers || "<li><span>Pilotes non disponibles</span></li>"}</ul>

        <a class="team__link" href="${escapeHTML(team.url)}" target="_blank" rel="noopener noreferrer">Histoire de l'écurie ↗</a>
    </article>`;
}

// --- 3. Afficher les écuries (en tenant compte de la recherche) ---
function render() {
    const query = searchInput.value.trim().toLowerCase();

    const filtered = allTeams.filter((t) => {
        const text = [
            t.Constructor.name, t.Constructor.nationality, NATIONALITIES[t.Constructor.nationality],
            ...t.drivers.map((d) => `${d.Driver.givenName} ${d.Driver.familyName}`),
        ].join(" ").toLowerCase();
        return text.includes(query);
    });

    grid.innerHTML = filtered.map(teamCard).join("");
    emptyText.hidden = filtered.length > 0;
    countText.textContent = `${filtered.length} écurie${filtered.length > 1 ? "s" : ""}`;
}

// --- 4. Charger une saison depuis l'API ---
async function loadSeason(season) {
    grid.innerHTML = '<div class="team team--loading"></div>'.repeat(6);
    countText.textContent = "Chargement…";
    emptyText.hidden = true;

    try {
        // On demande en même temps le classement des écuries et celui des pilotes
        const [teamsRes, driversRes] = await Promise.all([
            fetch(`${API_BASE}/${season}/constructorStandings.json?limit=100`),
            fetch(`${API_BASE}/${season}/driverStandings.json?limit=100`),
        ]);
        const teamsData = await teamsRes.json();
        const driversData = await driversRes.json();

        const teamLists = teamsData.MRData.StandingsTable.StandingsLists;
        const driverLists = driversData.MRData.StandingsTable.StandingsLists;

        if (!teamLists.length) {
            allTeams = [];
            grid.innerHTML = "";
            countText.textContent = "";
            emptyText.textContent = "Pas encore de classement pour cette saison.";
            emptyText.hidden = false;
            return;
        }

        const driverStandings = driverLists.length ? driverLists[0].DriverStandings : [];

        // Pour chaque écurie, on retrouve ses pilotes
        allTeams = teamLists[0].ConstructorStandings.map((t) => ({
            ...t,
            drivers: driverStandings.filter((d) =>
                d.Constructors.some((c) => c.constructorId === t.Constructor.constructorId)
            ),
        }));

        leaderPoints = Math.max(1, ...allTeams.map((t) => Number(t.points)));
        emptyText.textContent = "Aucune écurie ne correspond à ta recherche.";
        render();
    } catch (error) {
        grid.innerHTML = "";
        countText.textContent = "";
        emptyText.textContent = "Impossible de charger les écuries pour le moment. Réessaie plus tard.";
        emptyText.hidden = false;
        console.error(error);
    }
}

// --- 5. Lancement ---
fillSeasons();
loadSeason("current");

seasonSelect.addEventListener("change", () => loadSeason(seasonSelect.value));
searchInput.addEventListener("input", render);
