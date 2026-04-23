const container = document.getElementById("circuits");

async function chargerCircuits() {
  const res = await fetch("https://api.jolpi.ca/ergast/f1/circuits.json?limit=100");
  const data = await res.json();

  const circuits = data.MRData.CircuitTable.Circuits;

  circuits.forEach(c => {
    const div = document.createElement("div");
    div.classList.add("card");

    div.innerHTML = `
      <h3>${c.circuitName}</h3>
      <p>🌍 ${c.Location.country}</p>
      <p>📍 ${c.Location.locality}</p>
    `;

    container.appendChild(div);
  });
}

chargerCircuits();