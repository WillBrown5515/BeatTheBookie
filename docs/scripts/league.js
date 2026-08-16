const LEAGUES = {
  prem: {
    name: "Premier League",
    code: "prem"
  },
  la_liga: {
    name: "La Liga",
    code: "la_liga"
  },
  champ: {
    name: "Championship",
    code: "champ"
  },
  seriea: {
    name: "Serie A",
    code: "seriea"
  },
  bundes: {
    name: "Bundesliga",
    code: "bundes"
  },
  ligue1: {
    name: "Ligue 1",
    code: "ligue1"
  }
};

let currentUserId = null;
let viewedUsername = "";
let deadline_passed = false;
let isGuestViewingBookie = false;
let changes_made = false;
const leaguePositionScores = {};
const VIEWED_USER_STORAGE_KEY = "btb-viewed-user";

function getStoredViewedUser() {
  try {
    const raw = window.sessionStorage.getItem(VIEWED_USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Could not read stored viewed user:", error);
    return null;
  }
}

function setStoredViewedUser(userId, username) {
  if (!userId) {
    clearStoredViewedUser();
    return;
  }

  try {
    window.sessionStorage.setItem(VIEWED_USER_STORAGE_KEY, JSON.stringify({ userId, username: username || "" }));
  } catch (error) {
    console.warn("Could not persist viewed user:", error);
  }
}

function clearStoredViewedUser() {
  try {
    window.sessionStorage.removeItem(VIEWED_USER_STORAGE_KEY);
  } catch (error) {
    console.warn("Could not clear stored viewed user:", error);
  }
}

function getLeagueFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("league");
}

function getUserIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("user_id");
}

function getUsernameFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("username");
}

async function initLeaguePage() {
  const leagueKey = getLeagueFromURL();
  const league = LEAGUES[leagueKey];

  if (!league) {
    window.location.href = "index.html";
    return;
  }

  const { data: { session } } = await supaclient.auth.getSession();
  const requestedUserId = getUserIdFromURL();
  const requestedUsername = getUsernameFromURL();
  const storedViewedUser = getStoredViewedUser();

  if (requestedUserId) {
    currentUserId = requestedUserId;
    viewedUsername = requestedUsername || "Selected user";
    setStoredViewedUser(requestedUserId, viewedUsername);
  } else if (storedViewedUser && session?.user && storedViewedUser.userId !== session.user.id) {
    currentUserId = storedViewedUser.userId;
    viewedUsername = storedViewedUser.username || "Selected user";
  } else if (session?.user) {
    currentUserId = session.user.id;
    clearStoredViewedUser();
  } else {
    isGuestViewingBookie = true;

    const { data: bookieUser, error } = await supaclient
      .from("leaderboard")
      .select("user_id")
      .eq("username", "The Bookie")
      .single();

    if (error || !bookieUser) {
      console.error("Could not find The Bookie user:", error);
      return;
    }

    currentUserId = bookieUser.user_id;
  }

  // Check if deadline has passed
  deadline_passed = isDeadlinePassed();

  loadHeader(`${league.name}`);

  const h1 = document.getElementById("league-title");
  if (h1) {
    h1.textContent = league.name;
  }

  const guestMessage = document.getElementById("guest-message");
  const actionButtonsTop = document.getElementById("action-buttons-top");
  const isViewingSomeoneElse = Boolean(requestedUserId) && (!session || session.user?.id !== requestedUserId);

  if (actionButtonsTop) {
    actionButtonsTop.innerHTML = `
      <div class="text-center mb-3">
        <button class="btn btn-primary me-2" id="save-btn-top">Save Changes</button>
        <button class="btn btn-danger" id="cancel-btn-top">Discard Changes</button>
      </div>
    `;
  }

  if (isGuestViewingBookie && guestMessage) {
    guestMessage.innerHTML = `
      <div class="alert alert-warning text-center mb-4" role="alert">
        <strong>You are viewing The Bookie's predictions.</strong><br>
        Sign up or log in to create and save your own league predictions.
      </div>
    `;
  } else if (isViewingSomeoneElse && guestMessage) {
    guestMessage.innerHTML = `
      <div class="alert alert-secondary text-center mb-4" role="alert">
        <div class="d-flex flex-column flex-sm-row align-items-center justify-content-center gap-2">
          <strong>You are viewing ${escapeHTML(viewedUsername)}'s predictions.</strong>
          <button type="button" class="btn btn-sm btn-outline-primary" id="view-my-predictions-btn">View my predictions</button>
        </div>
      </div>
    `;
  } else if (!deadline_passed && !isGuestViewingBookie && guestMessage) {
    guestMessage.innerHTML = `
      <div class="alert alert-info text-center mb-2" role="alert">
        <strong>Use the arrows to change your predictions.</strong><br>
        Don't forget to save your changes!
      </div>
    `;
  }

  // Setup buttons and disable if deadline passed, guest viewing The Bookie, or viewing someone else's predictions
  const saveBtn = document.getElementById("save-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const saveBtnTop = document.getElementById("save-btn-top");
  const cancelBtnTop = document.getElementById("cancel-btn-top");
  const disableEditing = deadline_passed || isGuestViewingBookie || isViewingSomeoneElse;
  const setButtonState = (button, title) => {
    if (button) {
      button.disabled = disableEditing;
      button.title = title;
    }
  };

  if (disableEditing) {
    if (deadline_passed) {
      setButtonState(saveBtn, "Predictions are locked after the deadline.");
      setButtonState(cancelBtn, "Predictions are locked after the deadline.");
      setButtonState(saveBtnTop, "Predictions are locked after the deadline.");
      setButtonState(cancelBtnTop, "Predictions are locked after the deadline.");
    } else if (isGuestViewingBookie) {
      setButtonState(saveBtn, "Login to create and save your own predictions.");
      setButtonState(cancelBtn, "Login to create and save your own predictions.");
      setButtonState(saveBtnTop, "Login to create and save your own predictions.");
      setButtonState(cancelBtnTop, "Login to create and save your own predictions.");
    } else if (isViewingSomeoneElse) {
      setButtonState(saveBtn, "You can only edit your own predictions.");
      setButtonState(cancelBtn, "You can only edit your own predictions.");
      setButtonState(saveBtnTop, "You can only edit your own predictions.");
      setButtonState(cancelBtnTop, "You can only edit your own predictions.");
    }
  } else {
    setButtonState(saveBtn, "");
    setButtonState(cancelBtn, "");
    setButtonState(saveBtnTop, "");
    setButtonState(cancelBtnTop, "");
  }

  if (saveBtn) {
    saveBtn.onclick = () => save_changes(league.code);
  }

  if (cancelBtn) {
    cancelBtn.onclick = () => reset_changes(league.code);
  }

  if (saveBtnTop) {
    saveBtnTop.onclick = () => save_changes(league.code);
  }

  if (cancelBtnTop) {
    cancelBtnTop.onclick = () => reset_changes(league.code);
  }

  const viewMyPredictionsBtn = document.getElementById("view-my-predictions-btn");
  if (viewMyPredictionsBtn && session?.user) {
    viewMyPredictionsBtn.onclick = () => {
      clearStoredViewedUser();
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("user_id");
      nextUrl.searchParams.delete("username");
      window.location.href = nextUrl.toString();
    };
  }

  updateUnsavedMessage();

  await loadPredictions(league.code);
  await loadStandings(league.code);

  // Warn user before leaving page with unsaved changes
  window.addEventListener("beforeunload", (event) => {
    if (changes_made) {
      event.preventDefault();
      event.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      return event.returnValue;
    }
  });
}

function renderPredictionTable(teamNames, positionScores = {}) {
  const editable = !deadline_passed && !isGuestViewingBookie && !Boolean(getUserIdFromURL());
  const showScores = deadline_passed;

  let html = `
    <div class="table-responsive">
      <table class="table table-bordered border-primary">
        <thead>
          <tr>
            <th>Position</th>
            <th>Team</th>
            ${showScores ? "<th>Score</th>" : ""}
          </tr>
        </thead>
        <tbody id="pred-body">
  `;

  teamNames.forEach((teamName, i) => {
    const canMoveUp = editable && i > 0;
    const canMoveDown = editable && i < teamNames.length - 1;
    const scoreValue = showScores ? (positionScores[String(i + 1)] ?? "—") : "";
    // Always render the left and right containers when editable so grid columns stay consistent.
    const leftControls = editable ? `
      <div class="move-controls move-controls-left">
        ${canMoveDown ? `<button type="button" class="btn btn-sm btn-outline-primary move-btn" data-direction="down" aria-label="Move ${teamName} down">↓</button>` : ``}
      </div>` : "";
    const rightControls = editable ? `
      <div class="move-controls move-controls-right">
        ${canMoveUp ? `<button type="button" class="btn btn-sm btn-outline-primary move-btn" data-direction="up" aria-label="Move ${teamName} up">↑</button>` : ``}
      </div>` : "";

    html += `
      <tr>
        <td class="non-draggable">${i + 1}</td>
        <td class="team-cell">
          <div class="team-cell-content">
            ${leftControls}
            <span class="team-name">${teamName}</span>
            ${rightControls}
          </div>
        </td>
        ${showScores ? `<td>${scoreValue}</td>` : ""}
      </tr>`;
  });

  html += `</tbody></table></div>`;
  document.getElementById("pred-table").innerHTML = html;

  if (editable) {
    document.querySelectorAll("#pred-body .move-btn").forEach(button => {
      button.addEventListener("click", () => {
        const row = button.closest("tr");
        const rows = Array.from(document.querySelectorAll("#pred-body tr"));
        const currentIndex = rows.indexOf(row);
        const targetIndex = button.dataset.direction === "up" ? currentIndex - 1 : currentIndex + 1;

        if (targetIndex < 0 || targetIndex >= rows.length) return;

        const teamNamesFromRows = Array.from(document.querySelectorAll("#pred-body .team-name"))
          .map(team => team.textContent.trim());
        const [movedTeam] = teamNamesFromRows.splice(currentIndex, 1);
        teamNamesFromRows.splice(targetIndex, 0, movedTeam);

        renderPredictionTable(teamNamesFromRows, positionScores);
        changes_made = true;
        updateUnsavedMessage();
      });
    });
  }
}

async function getLeaguePositionScores(league) {
  if (leaguePositionScores[league]) {
    return leaguePositionScores[league];
  }

  const { data: rows, error } = await supaclient
    .from(`${league}_scores`)
    .select("*")
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (error) {
    console.error(`Could not load position scores for ${league}:`, error);
    leaguePositionScores[league] = {};
    return leaguePositionScores[league];
  }

  if (!rows) {
    leaguePositionScores[league] = {};
    return leaguePositionScores[league];
  }

  const scoreMap = Object.fromEntries(
    Object.entries(rows)
      .filter(([key, value]) => key !== "user_id" && value !== null && value !== undefined && value !== "")
      .map(([key, value]) => [String(key), Number(value)])
  );

  leaguePositionScores[league] = scoreMap;
  return scoreMap;
}

async function loadPredictions(league) {
  let { data } = await supaclient
    .from(`${league}_preds`)
    .select("*")
    .eq("user_id", currentUserId);

  if (!data || data.length === 0) {
    renderPredictionTable([], {});
    return;
  }

  delete data[0].user_id;

  const teamNames = Object.keys(data[0]).map(key => data[0][key]);
  const positionScores = deadline_passed ? await getLeaguePositionScores(league) : {};
  renderPredictionTable(teamNames, positionScores);
}

async function loadStandings(league) {
  const { data: rows, error } = await supaclient
    .from("default_predictions")
    .select("*")
    .in("name", [
      `${league}_curr_standings`,
      `${league}_curr_points`,
      `${league}_curr_goal_difference`
    ]);

  if (error) {
    console.error(error);
    return;
  }

  const rowsByName = Object.fromEntries(
    rows.map(row => [row.name, row])
  );

  const standings = rowsByName[`${league}_curr_standings`];
  const points = rowsByName[`${league}_curr_points`];
  const gd = rowsByName[`${league}_curr_goal_difference`];

  // Remove `name` so it doesn't show up as a row
  const { name, ...standingsData } = standings;

  let html = `
    <table class="table table-bordered border-primary">
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>GD</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>
  `;

  Object.keys(standingsData)
    .filter(key => standingsData[key] != null)
    .forEach(key => {
      html += `
        <tr>
          <td>${key}</td>
          <td>${standings[key]}</td>
          <td>${gd[key]}</td>
          <td>${points[key]}</td>
        </tr>`;
    });


  html += `</tbody></table>`;
  document.getElementById("league-table").innerHTML = html;
}

async function loadUserScore(league) {
  const scoreContainer = document.getElementById("user-score");
  if (!scoreContainer || !currentUserId) {
    return;
  }

  const { data: scoreRow, error } = await supaclient
    .from("leaderboard")
    .select("username, prem, la_liga, champ, total")
    .eq("user_id", currentUserId)
    .maybeSingle();

  if (error) {
    console.error("Could not load user's league score:", error);
    return;
  }

  if (!scoreRow) {
    scoreContainer.innerHTML = "";
    return;
  }

  const leagueName = LEAGUES[league]?.name || "League";
  const leaguePoints = Number(scoreRow[league] ?? 0);
  const totalPoints = Number(scoreRow.total ?? 0);
  const displayName = (viewedUsername || scoreRow.username || "This user").trim();

  scoreContainer.innerHTML = `
    <div class="alert alert-success text-center mb-4" role="alert">
      <strong>${escapeHTML(displayName)}'s score:</strong>
      ${leaguePoints} points in ${leagueName}
      ${!Number.isNaN(totalPoints) ? `· Total: ${totalPoints} points` : ""}
    </div>
  `;
}

async function save_changes(league) {
  const requestedUserId = getUserIdFromURL();

  if (deadline_passed || isGuestViewingBookie || requestedUserId) {
    alert("You can only edit your own predictions.");
    return;
  }

  // Collect the new order of teams
  const newOrder = [];
  document.querySelectorAll("#pred-body .team-name").forEach(team => {
    newOrder.push(team.textContent.trim());
  });

  // Create column names (1,2,3,4...)
  const cols = [];
  for (let i = 1; i <= newOrder.length; i++) {
    cols.push(i.toString());
  }

  // Convert into object for Supabase
  const dataToUpdate = cols.reduce((acc, columnName, index) => {
    acc[columnName] = newOrder[index];
    return acc;
  }, {});

  const { error } = await supaclient
    .from(`${league}_preds`)
    .update(dataToUpdate)
    .eq("user_id", currentUserId);

  if (error) {
    console.error(error);
    alert("Error saving changes.");
    return;
  }

  alert("Changes saved successfully.");
  changes_made = false;
  updateUnsavedMessage();
}

async function reset_changes(league) {
  const requestedUserId = getUserIdFromURL();

  if (deadline_passed || isGuestViewingBookie || requestedUserId) {
    alert("You can only edit your own predictions.");
    return;
  }

  if (!currentUserId) return;

  const confirmReset = confirm("Discard unsaved changes?");
  if (!confirmReset) return;

  await loadPredictions(league);
  changes_made = false;
  updateUnsavedMessage();
}

// Function to show/hide unsaved changes message
function updateUnsavedMessage() {
  const messageDiv = document.getElementById("unsaved-message");
  if (messageDiv) {
    if (changes_made) {
      messageDiv.innerHTML = `
        <div class="alert alert-danger text-center" role="alert">
          <strong>Unsaved changes!</strong> Remember to save your changes.
        </div>
      `;
    } else {
      messageDiv.innerHTML = "";
    }
  }
}

// Function to update the position numbers in the first column
function updatePositions(tableBody) {
  const rows = tableBody.querySelectorAll('tr');
  rows.forEach((row, index) => {
    const positionCell = row.querySelector('td:first-child');
    positionCell.textContent = index + 1; // Update position
  });
}
