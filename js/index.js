// =========================================================
// 1. THÈME CLAIR / SOMBRE
// =========================================================
const themeBtn = document.getElementById("themeBtn");

// Au chargement : on remet le thème que l'utilisateur avait choisi
const savedTheme = localStorage.getItem("theme");
if (savedTheme) {
    document.documentElement.dataset.theme = savedTheme;
}

themeBtn.addEventListener("click", () => {
    const html = document.documentElement;
    const newTheme = html.dataset.theme === "light" ? "dark" : "light";
    html.dataset.theme = newTheme;
    localStorage.setItem("theme", newTheme); // on s'en souvient pour la prochaine visite
});

// =========================================================
// 2. MENU MOBILE
// =========================================================
const burgerBtn = document.getElementById("burgerBtn");
const navLinks = document.getElementById("navLinks");

burgerBtn.addEventListener("click", () => {
    navLinks.classList.toggle("is-open");
});

// =========================================================
// 3. API
// =========================================================
// "current" = la saison en cours, donc rien à changer l'an prochain
const API = "https://api.jolpi.ca/ergast/f1/current";

// --- Classement des pilotes ---
async function loadStandings() {
    const list = document.getElementById("standings");

    try {
        // 1. On demande les données à l'API
        const response = await fetch(`${API}/driverStandings.json`);
        const data = await response.json();
        // 2. On va chercher le tableau des pilotes dans la réponse
        const drivers = data.MRData.StandingsTable.StandingsLists[0].DriverStandings;
        // 3. On garde les 5 premiers et on fabrique une ligne HTML pour chacun
        list.innerHTML = drivers.slice(0, 5).map((d) => `
      <li class="standings__row">
        <span class="pos">${d.position}</span>
        <span class="name">
          ${d.Driver.givenName} ${d.Driver.familyName}
          <small>${d.Constructors[0].name}</small>
        </span>
        <span class="pts">${d.points} pts</span>
      </li>
    `).join("");
    } catch (error) {
        // Si l'API ne répond pas, on prévient au lieu de laisser "Chargement…"
        list.innerHTML = `<li class="standings__row">Classement en chargement...</li>`;
        console.error(error);
    }
}

// --- Prochain Grand Prix ---
let nextRaceDate = null; // sera rempli par l'API

async function loadNextRace() {
    try {
        const response = await fetch(`${API}.json`); // le calendrier complet de la saison
        const data = await response.json();
        const races = data.MRData.RaceTable.Races;

        // On cherche la première course dont le départ n'est pas encore passé
        const now = new Date();
        const next = races.find((race) => new Date(`${race.date}T${race.time}`) > now);

        if (!next) {
            document.getElementById("gp-name").textContent = "Saison terminée !";
            return;
        }

        nextRaceDate = new Date(`${next.date}T${next.time}`);

        // Date affichée en français, à l'heure de l'utilisateur
        const dateFr = nextRaceDate.toLocaleString("fr-FR", {
            weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
        });

        document.getElementById("gp-name").textContent = next.raceName;
        document.getElementById("gp-info").textContent = `${next.Circuit.circuitName} · ${dateFr}`;

        updateCountdown();

    } catch (error) {
        document.getElementById("gp-name").textContent = "Calendrier indisponible";
        console.error(error);
    }
}

loadStandings();
loadNextRace();

// =========================================================
// 4. COMPTE À REBOURS
// =========================================================
function updateCountdown() {
    if (!nextRaceDate) return; // l'API n'a pas encore répondu

    const now = new Date();
    const diff = nextRaceDate - now; // différence en millisecondes

    if (diff <= 0) {
        nextRaceDate = null; // on arrête le décompte pendant qu'on recharge
        loadNextRace();      // la course a commencé : on va chercher la suivante
        return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // padStart(2, "0") transforme 5 en "05"
    document.getElementById("cd-days").textContent = String(days).padStart(2, "0");
    document.getElementById("cd-hours").textContent = String(hours).padStart(2, "0");
    document.getElementById("cd-min").textContent = String(minutes).padStart(2, "0");
    document.getElementById("cd-sec").textContent = String(seconds).padStart(2, "0");
}

updateCountdown();                   // une première fois tout de suite
setInterval(updateCountdown, 1000);  // puis toutes les secondes