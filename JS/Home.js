const input = document.getElementById("search");
const resultats = document.getElementById("resultats");

let pilotes = [];

async function charger() {
  const res = await fetch("https://api.jolpi.ca/ergast/f1/drivers.json?limit=1000");
  const data = await res.json();
  pilotes = data.MRData.DriverTable.Drivers;
}
charger();

input.addEventListener("input", () => {
  const val = input.value.toLowerCase();

  const filtres = pilotes.filter(p =>
    p.familyName.toLowerCase().includes(val)
  );

  afficher(filtres);
});

function afficher(liste) {
  resultats.innerHTML = "";

  liste.slice(0, 20).forEach(p => {
    const div = document.createElement("div");
    div.classList.add("card");

    div.innerHTML = `
      <h3>${p.givenName} ${p.familyName}</h3>
      <p>${p.nationality}</p>
    `;

    div.onclick = () => {
      window.location.href = `pilote.html?id=${p.driverId}`;
    };

    resultats.appendChild(div);
  });
}