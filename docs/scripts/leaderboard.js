let currentSortBy = "total";
let currentViewMode = "full";

document.addEventListener("DOMContentLoaded", async () => {
  await restoreSession();
  renderLeaderboard();
});

function getStoredLeaderboardViewMode() {
  if (typeof window === "undefined" || !window.localStorage) {
    return "full";
  }

  const storedMode = window.localStorage.getItem("leaderboard-view-mode");
  return storedMode === "compact" ? "compact" : "full";
}

function setLeaderboardViewMode(mode) {
  currentViewMode = mode;

  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem("leaderboard-view-mode", mode);
  }
}

function changeLeaderboardViewMode(mode) {
  setLeaderboardViewMode(mode);
  renderLeaderboard(currentSortBy);
}

function viewUserPredictions(username, userId) {
  if (!userId) {
    return;
  }

  const leagueKey = currentSortBy && currentSortBy !== "total" && Object.prototype.hasOwnProperty.call(LEAGUES || {}, currentSortBy)
    ? currentSortBy
    : "prem";

  const url = new URL("league.html", window.location.href);
  url.searchParams.set("league", leagueKey);
  url.searchParams.set("user_id", userId);

  if (username) {
    url.searchParams.set("username", username);
  }

  window.location.href = url.toString();
}

async function renderLeaderboard(sortBy = currentSortBy) {
  currentSortBy = sortBy || currentSortBy;
  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  const mobileViewMode = isMobile ? currentViewMode : "full";
  let { data, error } = await supaclient
    .from("leaderboard")
    .select("*")
    .order(sortBy, { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const canViewUserPredictions = isDeadlinePassed();

  // Sort dropdown
  let html = `
    <div class="row align-items-center mb-3 g-2">
      <div class="col-12 text-center mb-2">
        <h1 class="page-title mb-0">The Leaderboard</h1>
      </div>
      <div class="col-12 d-flex justify-content-center align-items-center flex-wrap gap-2">
        <label class="form-label me-2 mb-0">Sort By:</label>
        <select class="form-select leaderboard-sort-select" onchange="renderLeaderboard(this.value)">
          <option value="total" ${sortBy === "total" ? "selected" : ""}>Total</option>
          <option value="prem" ${sortBy === "prem" ? "selected" : ""}>Premier League</option>
          <option value="la_liga" ${sortBy === "la_liga" ? "selected" : ""}>La Liga</option>
          <option value="champ" ${sortBy === "champ" ? "selected" : ""}>Championship</option>
        </select>
      </div>
    </div>
  `;

  html += `
    <div class="d-md-none mb-3">
      <div class="leaderboard-view-toggle btn-group mx-auto" role="group" aria-label="Leaderboard view">
        <button type="button" class="btn btn-outline-primary ${mobileViewMode === "full" ? "active" : ""}" onclick="changeLeaderboardViewMode('full')">
          Full table
        </button>
        <button type="button" class="btn btn-outline-primary ${mobileViewMode === "compact" ? "active" : ""}" onclick="changeLeaderboardViewMode('compact')">
          Compact
        </button>
      </div>
    </div>
  `;

  // --- Desktop table version ---
  html += `
    <div class="table-responsive d-none d-md-block">
      <table class="table table-bordered border-primary table-sm table-striped table-hover align-middle">
        <thead>
          <tr>
            <th>#</th>
            <th>User</th>
            <th>Prem</th>
            <th>La Liga</th>
            <th>Champ</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
  `;

  data.forEach((row, index) => {
    html += `
      <tr>
        <td>${index + 1}</td>
        <td>
          ${canViewUserPredictions
            ? `<button class="btn btn-link p-0"
            onclick="viewUserPredictions('${row.username}', '${row.user_id}')">
            ${escapeHTML(row.username)}
          </button>`
            : `<span class="text-muted">${escapeHTML(row.username)}</span>`}
        </td>
        <td>${row.prem}</td>
        <td>${row.la_liga}</td>
        <td>${row.champ}</td>
        <td>${row.total}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  html += `
    <div class="d-block d-md-none ${mobileViewMode === "compact" ? "" : "d-none"}">
  `;

  data.forEach((row, index) => {
    html += `
      <div class="card mb-3 shadow-sm">
        <div class="card-body">
          <h5 class="card-title">${index + 1}. ${escapeHTML(row.username)}</h5>
          <p class="card-text mb-1">Premier League: ${row.prem}</p>
          <p class="card-text mb-1">La Liga: ${row.la_liga}</p>
          <p class="card-text mb-1">Championship: ${row.champ}</p>
          <p class="card-text fw-bold">Total: ${row.total}</p>
          ${canViewUserPredictions
            ? `<button class="btn btn-link p-0" onclick="viewUserPredictions('${row.username}', '${row.user_id}')">
              View Predictions
            </button>`
            : `<span class="text-muted small">Predictions will unlock after the deadline.</span>`}
        </div>
      </div>
    `;
  });

  html += `</div>`;

  html += `
    <div class="d-block d-md-none ${mobileViewMode === "full" ? "" : "d-none"}">
      <div class="leaderboard-table-scroll">
        <table class="table table-bordered table-striped table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>#</th>
              <th>User</th>
              <th>Prem</th>
              <th>La Liga</th>
              <th>Champ</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
  `;

  data.forEach((row, index) => {
    html += `
            <tr>
              <td>${index + 1}</td>
              <td>
                ${canViewUserPredictions
                  ? `<button class="btn btn-link p-0"
                    onclick="viewUserPredictions('${row.username}', '${row.user_id}')">
                    ${escapeHTML(row.username)}
                  </button>`
                  : `<span class="text-muted">${escapeHTML(row.username)}</span>`}
              </td>
              <td>${row.prem}</td>
              <td>${row.la_liga}</td>
              <td>${row.champ}</td>
              <td>${row.total}</td>
            </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById("leaderboard-container").innerHTML = html;
}