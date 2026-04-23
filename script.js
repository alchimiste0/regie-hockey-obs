let scores = { A: 0, B: 0 };
let boxSize = 20;

const uiPeriodStates =["Échauffement", "Période 1", "Mi-temps", "Période 2", "Prolongation", "Tirs au but"];
const obsPeriodStates =["ECH.", "P1", "MT", "P2", "PRO.", "TAB"];

let currentPeriodIndex = 0;
let timerInterval = null;
let timerCurrentSeconds = 0;
let timerMaxSeconds = 1200;
let isCountdown = false;

let penalties = { A: [], B:[] };

// --- Variables Replay ---
let replayList =[];
let replayBufferActive = false;
let playQueue =[];
let sceneItemIds = {}; 
let currentLiveScene = "LIVE"; 
let isLoopingAll = false; 
let playTimeout = null; 

let teamRoster = { A:[], B:[] };
let graphicTimeouts = {}; 

const sourceNames = {
  sceneName: "LIVE", 
  compoScene: "COMPOSITION", 
  miTempsScene: "MI-TEMPS",
  finMatchScene: "FIN DE MATCH",
  A: "SCORE-VISITEUR",
  B: "SCORE-DOMICILE",
  A_Name: "EQUIPE-VISITEUR",
  B_Name: "EQUIPE-DOMICILE",
  A_Compo: "COMPO_VISITEUR",
  B_Compo: "COMPO_DOMICILE",
  C: "PERIODE",
  D: "CHRONOMETRE",
  penaltyA_solo: "TEXTE_PEN_VIS_1",
  penaltyA1: "TEXTE_PEN_VIS_1",
  penaltyA2: "TEXTE_PEN_VIS_2",
  penaltyB_solo: "TEXTE_PEN_DOM_1",
  penaltyB1: "TEXTE_PEN_DOM_1",
  penaltyB2: "TEXTE_PEN_DOM_2",
  penaltyImageA: "PEN_VIS1", 
  penaltyImageA2: "PEN_VIS2",
  penaltyImageB: "PEN_DOM1",
  penaltyImageB2: "PEN_DOM2",
  replayGroup: "Groupe Replay",
  replaySource: "Media Replay",
  overlayName: "NOM_JOUEUR",
  overlayImage: "NOM_JOUEUR_BANDEAU",
  overlayReseaux: "RESEAUX_SOCIAUX",
  overlayClassement: "TOP5_CLASSEMENT",
  overlayPointeurs: "TOP5_POINTEURS",
  overlayAutresScores: "MATCHS_DIRECT",
  top5ClassEquipe: "TOP5_EQUIPE_TEXTE",
  top5ClassPts: "TOP5_POINTS_TEXTE",
  top5PointJoueurs: "TOP5_POINTEURS_TEXTE",
  top5PointPts: "TOP5_PTS_POINTEURS_TEXTE",
  matchsDirectTexte: "MATCHS_DIRECT_TEXTE"
};

let obs;

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { minutes: String(minutes).padStart(2, '0'), seconds: String(seconds).padStart(2, '0') };
}

function syncTimerDisplayAndOBS() {
    const time = formatTime(timerCurrentSeconds);
    document.getElementById('timerMinutes').value = time.minutes;
    document.getElementById('timerSeconds').value = time.seconds;
    updateOBSText(sourceNames.D, `${time.minutes}:${time.seconds}`);
}

function updatePenaltyOBSText() {
    ['A', 'B'].forEach(team => {
        const sortedPenalties = penalties[team].sort((a, b) => a.timeRemaining - b.timeRemaining);
        const isVisiteur = (team === 'A');
        const text1 = isVisiteur ? sourceNames.penaltyA1 : sourceNames.penaltyB1;
        const img1  = isVisiteur ? sourceNames.penaltyImageA : sourceNames.penaltyImageB;
        const text2 = isVisiteur ? sourceNames.penaltyA2 : sourceNames.penaltyB2;
        const img2  = isVisiteur ? sourceNames.penaltyImageA2 : sourceNames.penaltyImageB2;
        
        if (sortedPenalties.length >= 1) {
            const time1 = formatTime(sortedPenalties[0].timeRemaining);
            setSourceVisibility(text1, true, sourceNames.sceneName);
            setSourceVisibility(img1, true, sourceNames.sceneName);
            updateOBSText(text1, `${time1.minutes}:${time1.seconds}`);
        } else {
            setSourceVisibility(text1, false, sourceNames.sceneName);
            setSourceVisibility(img1, false, sourceNames.sceneName);
        }
        if (sortedPenalties.length >= 2) {
            const time2 = formatTime(sortedPenalties[1].timeRemaining);
            setSourceVisibility(text2, true, sourceNames.sceneName);
            setSourceVisibility(img2, true, sourceNames.sceneName);
            updateOBSText(text2, `${time2.minutes}:${time2.seconds}`);
        } else {
            setSourceVisibility(text2, false, sourceNames.sceneName);
            setSourceVisibility(img2, false, sourceNames.sceneName);
        }
    });
}

function tick() {
    if (isCountdown) { if (timerCurrentSeconds > 0) timerCurrentSeconds--; } 
    else { if (timerCurrentSeconds < timerMaxSeconds) timerCurrentSeconds++; }
    
    const currentUI = uiPeriodStates[currentPeriodIndex];
    if (currentUI !== "Échauffement" && currentUI !== "Mi-temps") {['A', 'B'].forEach(team => {
            penalties[team].forEach(p => { if (p.timeRemaining > 0) p.timeRemaining--; });
            penalties[team] = penalties[team].filter(p => p.timeRemaining > 0);
        });
    }
    syncTimerDisplayAndOBS();
    renderPenalties();
    updatePenaltyOBSText();
    if ((isCountdown && timerCurrentSeconds <= 0) || (!isCountdown && timerCurrentSeconds >= timerMaxSeconds)) stopTimer();
}

function renderPenalties() {
    ['A', 'B'].forEach(team => {
        const container = document.getElementById('penalties' + team);
        container.innerHTML = '';
        penalties[team].forEach(p => {
            const time = formatTime(p.timeRemaining);
            const item = document.createElement('div');
            item.className = 'penalty-item';
            item.innerHTML = `
                <div class="penalty-time-inputs">
                    <input type="number" value="${time.minutes}" oninput="manualSetPenaltyTime('${team}', ${p.id}, this)">:
                    <input type="number" value="${time.seconds}" oninput="manualSetPenaltyTime('${team}', ${p.id}, this)">
                </div>
                <button class="penalty-delete-btn" onclick="deletePenalty('${team}', ${p.id})">🗑️</button>
            `;
            container.appendChild(item);
        });
    });
}

function addPenalty(team, minutes) { penalties[team].push({ id: Date.now(), timeRemaining: minutes * 60 }); renderPenalties(); updatePenaltyOBSText(); }
function deletePenalty(team, penaltyId) { penalties[team] = penalties[team].filter(p => p.id !== penaltyId); renderPenalties(); updatePenaltyOBSText(); }
function manualSetPenaltyTime(team, penaltyId, element) {
    const penalty = penalties[team].find(p => p.id === penaltyId);
    if (!penalty) return;
    const inputs = element.parentElement.querySelectorAll('input');
    penalty.timeRemaining = (parseInt(inputs[0].value, 10) || 0) * 60 + (parseInt(inputs[1].value, 10) || 0);
    renderPenalties(); updatePenaltyOBSText();
}

function startTimer() {
    if (timerInterval) return;
    const m = parseInt(document.getElementById('maxMinutes').value, 10) || 0;
    const s = parseInt(document.getElementById('maxSeconds').value, 10) || 0;
    timerMaxSeconds = (m * 60) + s;
    if (isCountdown && timerCurrentSeconds === 0) timerCurrentSeconds = timerMaxSeconds;
    timerInterval = setInterval(tick, 1000);
    document.getElementById('playPauseBtn').textContent = '❚❚';
    document.getElementById('playPauseBtn').classList.replace('start-btn', 'stop-btn');
}
function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    document.getElementById('playPauseBtn').textContent = '▶';
    document.getElementById('playPauseBtn').classList.replace('stop-btn', 'start-btn');
}
function toggleTimer() { if (timerInterval) stopTimer(); else startTimer(); }

function resetTimer() {
    stopTimer();
    if (isCountdown) {
        const m = parseInt(document.getElementById('maxMinutes').value, 10) || 0;
        const s = parseInt(document.getElementById('maxSeconds').value, 10) || 0;
        timerCurrentSeconds = (m * 60) + s;
    } else timerCurrentSeconds = 0;
    syncTimerDisplayAndOBS();
}

function manualSetTime() {
    const oldTime = timerCurrentSeconds;
    const m = parseInt(document.getElementById('timerMinutes').value, 10) || 0;
    const s = parseInt(document.getElementById('timerSeconds').value, 10) || 0;
    timerCurrentSeconds = (m * 60) + s;
    if (timerCurrentSeconds - oldTime !== 0) updatePenaltiesWithDelta(timerCurrentSeconds - oldTime);
    updateOBSText(sourceNames.D, `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    renderPenalties(); updatePenaltyOBSText();
}

function adjustTimer(delta) {
    const oldTime = timerCurrentSeconds;
    timerCurrentSeconds = Math.max(0, Math.min(5999, timerCurrentSeconds + delta));
    if (timerCurrentSeconds - oldTime !== 0) updatePenaltiesWithDelta(timerCurrentSeconds - oldTime);
    syncTimerDisplayAndOBS(); renderPenalties(); updatePenaltyOBSText();
}

function updatePenaltiesWithDelta(delta) {
    ['A', 'B'].forEach(team => {
        penalties[team].forEach(p => { p.timeRemaining -= isCountdown ? -delta : delta; if (p.timeRemaining < 0) p.timeRemaining = 0; });
        penalties[team] = penalties[team].filter(p => p.timeRemaining > 0);
    });
}

function invertTimerDirection() { isCountdown = !isCountdown; document.getElementById('invertBtn').textContent = isCountdown ? "Mode: Décompte" : "Mode: Chrono"; resetTimer(); }
function setPeriod(index) {
    currentPeriodIndex = index;
    document.getElementById("periodDisplay").textContent = uiPeriodStates[currentPeriodIndex];
    updateOBSText(sourceNames.C, obsPeriodStates[currentPeriodIndex]);
    switchScene(sourceNames.sceneName);
}
function changePeriod(delta) { setPeriod(Math.max(0, Math.min(uiPeriodStates.length - 1, currentPeriodIndex + delta))); }

function updateTeamName(team, newName) { updateOBSText(team === 'A' ? sourceNames.A_Name : sourceNames.B_Name, newName.toUpperCase()); }
function directChangeScore(team, delta) {
    scores[team] = Math.max(0, scores[team] + delta);
    document.getElementById("score" + team).textContent = scores[team];
    updateOBSText(sourceNames[team], scores[team]);
}
function resizeBoxes(delta) {
    boxSize = Math.max(0, boxSize + delta);
    document.querySelectorAll(".zone").forEach(zone => { zone.style.padding = boxSize + "px " + (boxSize * 2) + "px"; });
}
function toggleLayout() { document.body.classList.toggle("horizontal-layout"); }

// --- OBS ACTIONS ---
function switchScene(sceneName) {
    if (!ensureOBSConnection()) return;
    sendReq("SetCurrentProgramScene", { sceneName: sceneName });
    currentLiveScene = sceneName;
}

function triggerGraphic(sourceName) {
    setSourceVisibility(sourceName, true, sourceNames.sceneName);
    if (graphicTimeouts[sourceName]) clearTimeout(graphicTimeouts[sourceName]);
    graphicTimeouts[sourceName] = setTimeout(() => { setSourceVisibility(sourceName, false, sourceNames.sceneName); }, 5000);
}

// --- MODALS ---
let currentModalAction = null; let currentModalTeam = null; let currentModalDuration = null; let overlayDisplayTimeout = null;

function openPlayerModal(action, team, penaltyDuration) {
    currentModalAction = action; currentModalTeam = team; currentModalDuration = penaltyDuration;
    const teamName = document.getElementById(team === 'A' ? "visName" : "domName").value;
    document.getElementById("modal-title").textContent = action === 'BUT' ? `BUT POUR ${teamName} !` : `PÉNALITÉ DE ${penaltyDuration} MIN`;
    
    const grid = document.getElementById("player-grid"); grid.innerHTML = ""; 
    const players = teamRoster[team] ||[];
    
    if (players.length === 0) {
        const btn = document.createElement("button"); btn.textContent = "Équipe (Aucun joueur chargé)"; btn.onclick = () => submitPlayerAction("Équipe", ""); grid.appendChild(btn);
    } else {
        players.forEach(p => {
            const btn = document.createElement("button");
            btn.innerHTML = `<b>${p.num}</b><br>${p.nom}`; btn.className = p.type === 'S' ? "staff-btn" : "";
            btn.onclick = () => submitPlayerAction(p.nom, p.num); grid.appendChild(btn);
        });
        const btnInc = document.createElement("button"); btnInc.innerHTML = `<b>?</b><br>Inconnu / Équipe`; btnInc.className = "staff-btn"; btnInc.onclick = () => submitPlayerAction("Équipe", ""); grid.appendChild(btnInc);
    }
    document.getElementById("player-modal").style.display = "flex";
}

function promptTimeout() {
    currentModalAction = 'TIMEOUT'; document.getElementById("modal-title").textContent = "TEMPS MORT DEMANDÉ PAR :";
    const grid = document.getElementById("player-grid"); grid.innerHTML = "";['domName', 'visName'].forEach(id => {
        const name = document.getElementById(id).value || (id === 'domName' ? 'Domicile' : 'Visiteur');
        const btn = document.createElement("button"); btn.innerHTML = `<b style="font-size:18px;">${name}</b>`; btn.style.padding = "20px";
        btn.onclick = () => submitTimeoutAction(name); grid.appendChild(btn);
    });
    document.getElementById("player-modal").style.display = "flex";
}

function closePlayerModal() { document.getElementById("player-modal").style.display = "none"; }
function submitPlayerAction(nom, num) {
    closePlayerModal();
    const overlayText = `${currentModalAction} - ${nom} ${num ? `n°${num}` : ""}`.trim();
    if (currentModalAction === 'BUT') directChangeScore(currentModalTeam, 1);
    else if (currentModalAction === 'PEN') { penalties[currentModalTeam].push({ id: Date.now(), timeRemaining: currentModalDuration * 60 }); renderPenalties(); updatePenaltyOBSText(); }
    triggerOverlay(overlayText);
}
function submitTimeoutAction(teamName) { closePlayerModal(); if (timerInterval) stopTimer(); triggerOverlay(`TEMPS MORT - ${teamName}`); }
function promptGoal(team) { openPlayerModal('BUT', team, null); }
function promptPenalty(team, duration) { openPlayerModal('PEN', team, duration); }
function triggerOverlay(text) {
    updateOBSText(sourceNames.overlayName, text.toUpperCase());
    setSourceVisibility(sourceNames.overlayImage, true, sourceNames.sceneName); setSourceVisibility(sourceNames.overlayName, true, sourceNames.sceneName);
    clearTimeout(overlayDisplayTimeout);
    overlayDisplayTimeout = setTimeout(() => { setSourceVisibility(sourceNames.overlayImage, false, sourceNames.sceneName); setSourceVisibility(sourceNames.overlayName, false, sourceNames.sceneName); }, 6000);
}

// --- REPLAY ---
function updateReplayBtnUI() {
    const btn = document.getElementById("toggleReplayBtn"); const content = document.getElementById("replay-content");
    if (replayBufferActive) { btn.textContent = "⏹️ Désactiver le Replay Buffer"; btn.classList.replace("start-btn", "stop-btn"); content.className = "replay-content-active"; } 
    else { btn.textContent = "▶️ Activer le Replay Buffer"; btn.classList.replace("stop-btn", "start-btn"); content.className = "replay-content-hidden"; }
}
function toggleReplayBuffer() { sendReq(replayBufferActive ? "StopReplayBuffer" : "StartReplayBuffer"); }
function saveReplay() { sendReq("SaveReplayBuffer"); document.getElementById("saveReplayBtn").textContent = "⏳ Capture en cours..."; }
function playReplays(paths) { if (!ensureOBSConnection() || paths.length === 0) return; playQueue = [...paths]; switchScene(sourceNames.sceneName); playNextInQueue(true); }
function playNextInQueue(isFirstVideo = false) {
    if (playQueue.length > 0) {
        const nextFile = playQueue.shift();
        if (currentLiveScene !== "") setSourceVisibility(sourceNames.replayGroup, false, currentLiveScene);
        clearTimeout(playTimeout);
        playTimeout = setTimeout(() => {
            sendReq("SetInputSettings", { inputName: sourceNames.replaySource, inputSettings: { local_file: nextFile, is_local_file: true, looping: false, restart_on_activate: true, speed_percent: 60 } });
            sendReq("TriggerMediaInputAction", { inputName: sourceNames.replaySource, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART" });
            sendReq("SetInputMute", { inputName: sourceNames.replaySource, inputMuted: true });
            if (isFirstVideo && currentLiveScene !== "") setSourceVisibility(sourceNames.replayGroup, true, currentLiveScene);
        }, 40); 
    } else {
        if (isLoopingAll && document.getElementById("loopReplaysCheckbox").checked && replayList.length > 0) { playQueue =[...replayList]; playNextInQueue(false); } 
        else hideReplayOnStream();
    }
}
function playLastReplay() { if (replayList.length > 0) { isLoopingAll = false; playReplays([replayList[replayList.length - 1]]); } else alert("Aucune vidéo capturée !"); }
function playAllReplays() { if (replayList.length > 0) { isLoopingAll = true; playReplays(replayList); } else alert("Liste vide !"); }
function clearReplays() { replayList = []; playQueue =[]; document.getElementById("replayCount").innerText = "0"; document.getElementById("deleteBtn").textContent = "✅ Vidé !"; setTimeout(() => { document.getElementById("deleteBtn").textContent = "🗑️ Vider la liste"; }, 1500); }
function hideReplayOnStream() { playQueue =[]; isLoopingAll = false; clearTimeout(playTimeout); sendReq("TriggerMediaInputAction", { inputName: sourceNames.replaySource, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP" }); if (currentLiveScene !== "") setSourceVisibility(sourceNames.replayGroup, false, currentLiveScene); }

// --- WEBSOCKET OBS v5 ---
function sendReq(type, data = {}, reqId = null) { if (!ensureOBSConnection()) return; obs.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: reqId || (type + Date.now()), requestData: data } })); }
function connectOBS() {
    obs = new WebSocket("ws://localhost:4455");
    obs.onmessage = (event) => {
        const p = JSON.parse(event.data);
        if (p.op === 0) obs.send(JSON.stringify({ op: 1, d: { rpcVersion: 1 } }));
        else if (p.op === 2) { console.log("✅ Connecté à OBS"); updateOBSText(sourceNames.C, obsPeriodStates[currentPeriodIndex]); syncTimerDisplayAndOBS(); updatePenaltyOBSText(); sendReq("GetReplayBufferStatus", {}, "init-replay-status"); } 
        else if (p.op === 5) {
            const t = p.d.eventType; const d = p.d.eventData;
            if (t === "ReplayBufferStateChanged") { replayBufferActive = d.outputActive; updateReplayBtnUI(); } 
            else if (t === "ReplayBufferSaved") {
                if (d.savedReplayPath && !replayList.includes(d.savedReplayPath)) {
                    replayList.push(d.savedReplayPath); document.getElementById("replayCount").innerText = replayList.length;
                    document.getElementById("saveReplayBtn").textContent = "✅ Action capturée !"; setTimeout(() => { document.getElementById("saveReplayBtn").textContent = "📸 Capturer l'action !"; }, 2000);
                }
            } 
            else if (t === "MediaInputPlaybackEnded") { if (d.inputName === sourceNames.replaySource) playNextInQueue(false); }
        } 
        else if (p.op === 7) {
            if (!p.d.requestStatus.result) return;
            if (p.d.requestId === "init-replay-status") { replayBufferActive = p.d.responseData.outputActive; updateReplayBtnUI(); } 
            else if (p.d.requestId.startsWith("getid:::")) {
                const pts = p.d.requestId.split(":::"); sceneItemIds[pts[1] + ":::" + pts[2]] = p.d.responseData.sceneItemId;
                sendReq("SetSceneItemEnabled", { sceneName: pts[1], sceneItemId: p.d.responseData.sceneItemId, sceneItemEnabled: pts[3] === "true" });
            }
        }
    };
    obs.onerror = err => console.error("❌ Erreur OBS :", err);
    obs.onclose = () => setTimeout(connectOBS, 3000);
}
function ensureOBSConnection() { return (obs && obs.readyState === WebSocket.OPEN); }
function setSourceVisibility(sourceName, isVisible, targetScene) {
    if (!targetScene) return;
    const cacheKey = targetScene + ":::" + sourceName;
    if (sceneItemIds[cacheKey] !== undefined) sendReq("SetSceneItemEnabled", { sceneName: targetScene, sceneItemId: sceneItemIds[cacheKey], sceneItemEnabled: isVisible });
    else sendReq("GetSceneItemId", { sceneName: targetScene, sourceName: sourceName }, "getid:::" + targetScene + ":::" + sourceName + ":::" + isVisible);
}
function updateOBSText(sourceName, newText) { sendReq("SetInputSettings", { inputName: sourceName, inputSettings: { text: String(newText) } }); }

// --- MODULE INTELLIGENT DE NETTOYAGE DES NOMS ---
const cleanTeamName = (name) => {
    if (!name) return "";
    let clean = name.replace(/^\d+\s*-\s*/, ''); // Supprime "01177 - "
    clean = clean.replace(/\s*-?\s*(ELITE|N[1-4]|N\s*[1-4]|PRENAT|NAT).*$/i, ''); // Supprime " ELITE", "- N1", etc.
    return clean.trim();
};

// --- MODULE D'ASPIRATION AUTOMATIQUE (CORS UNBLOCKED) OU MANUELLE ---
async function fetchWithProxy(url) {
    try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        if (res.ok) return await res.json();
    } catch(e) {}
    
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error("Accès bloqué.");
    return await res.json();
}

async function fetchRolskanetData() {
    const input = document.getElementById("rolskanetId").value.trim();
    if (!input) return alert("Veuillez coller un code JSON ou l'ID d'un match.");

    const statusText = document.getElementById("rolskanet-status");
    statusText.style.color = "yellow"; statusText.innerText = "⏳ Analyse en cours...";

    let parsedData = null;

    try {
        if (input.startsWith("{") || input.startsWith("[")) {
            parsedData = JSON.parse(input);
        } else {
            const matchId = input.replace(/\D/g, ""); 
            if (!matchId) throw new Error("ID_INVALID");
            parsedData = await fetchWithProxy(`https://rolskanet.fr/sportif/live/${matchId}/ajax/ajax/init-data`);
        }

        // 1. MATCH EN DIRECT
        if (parsedData.receveur && parsedData.joueurs) {
            const domName = cleanTeamName(parsedData.receveur.libelle_court || parsedData.receveur.libelle);
            const visName = cleanTeamName(parsedData.visiteur.libelle_court || parsedData.visiteur.libelle);
            document.getElementById("domName").value = domName; document.getElementById("visName").value = visName;
            updateTeamName('B', domName); updateTeamName('A', visName);

            let scoreDom = 0; let scoreVis = 0;
            if (parsedData.scores) {
                parsedData.scores.forEach(s => {
                    if (s.equipe_id === parsedData.receveur.id) scoreDom = s.score;
                    if (s.equipe_id === parsedData.visiteur.id) scoreVis = s.score;
                });
            }
            scores.B = scoreDom; document.getElementById("scoreB").textContent = scoreDom; updateOBSText(sourceNames.B, scoreDom);
            scores.A = scoreVis; document.getElementById("scoreA").textContent = scoreVis; updateOBSText(sourceNames.A, scoreVis);

            const jDom = parsedData.joueurs.filter(j => j.equipe_id === parsedData.receveur.id);
            const jVis = parsedData.joueurs.filter(j => j.equipe_id === parsedData.visiteur.id);
            const sDom = parsedData.staffs ? parsedData.staffs.filter(s => s.equipe_id === parsedData.receveur.id) : [];
            const sVis = parsedData.staffs ? parsedData.staffs.filter(s => s.equipe_id === parsedData.visiteur.id) :[];
            
            const sortByNum = (a, b) => (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0);
            jDom.sort(sortByNum); jVis.sort(sortByNum);

            const formatNom = (nom) => nom.replace(/^(M |Mme )/, "");
            teamRoster.B = jDom.map(j => ({ nom: formatNom(j.nom_complet), num: j.numero || "0", type: "J" }));
            teamRoster.B.push(...sDom.map(s => ({ nom: formatNom(s.nom_complet), num: "Staff", type: "S" })));
            teamRoster.A = jVis.map(j => ({ nom: formatNom(j.nom_complet), num: j.numero || "0", type: "J" }));
            teamRoster.A.push(...sVis.map(s => ({ nom: formatNom(s.nom_complet), num: "Staff", type: "S" })));

            const buildCompo = (joueurs, staffs) => {
                let str = "";
                joueurs.forEach(j => { let attr = ""; if(j.attributs && j.attributs.length > 0) { if(j.attributs[0].code === "CA") attr = " (C)"; if(j.attributs[0].code === "ASS") attr = " (A)"; } str += `${j.numero || "0"} - ${formatNom(j.nom_complet)}${attr}\n`; });
                staffs.forEach(s => { let role = s.attributs && s.attributs.length > 0 ? s.attributs[0].libelle : "Staff"; str += `${role} - ${formatNom(s.nom_complet)}\n`; });
                return str.trim();
            };

            updateOBSText(sourceNames.B_Compo, buildCompo(jDom, sDom)); 
            updateOBSText(sourceNames.A_Compo, buildCompo(jVis, sVis));
            statusText.innerText = "✅ Équipes, Scores et Compos mis à jour !";
        }
        
        // 2. CLASSEMENT
        else if (parsedData.data && parsedData.data[0] && parsedData.data[0].data && parsedData.data[0].data[0] && parsedData.data[0].data[0].position !== undefined) {
            let strEquipes = ""; let strPoints = "";
            parsedData.data[0].data.slice(0, 5).forEach(t => {
                let nom = cleanTeamName(t.equipe.nom_court || t.equipe.nom);
                strEquipes += `${t.position} - ${nom}\n`;
                strPoints += `${t.nombre_point}\n`;
            });
            updateOBSText(sourceNames.top5ClassEquipe, strEquipes.trim());
            updateOBSText(sourceNames.top5ClassPts, strPoints.trim());
            statusText.innerText = "✅ TOP 5 Classement mis à jour !";
        }
        
        // 3. POINTEURS
        else if (parsedData.data && parsedData.data[0] && parsedData.data[0].info && parsedData.data[0].info.nom_complet) {
            let strJoueurs = ""; let strPtsPoint = "";
            parsedData.data.slice(0, 5).forEach((p, index) => {
                strJoueurs += `${index + 1} - ${p.info.nom_complet}\n`;
                strPtsPoint += `${p.data.points}\n`;
            });
            updateOBSText(sourceNames.top5PointJoueurs, strJoueurs.trim());
            updateOBSText(sourceNames.top5PointPts, strPtsPoint.trim());
            statusText.innerText = "✅ TOP 5 Pointeurs mis à jour !";
        }
        
        // 4. MATCHS EN DIRECT
        else if (parsedData.data && parsedData.data[0] && parsedData.data[0].infosRencontre) {
            let strMatchs = "";
            const today = new Date();
            
            const recentMatches = parsedData.data.filter(m => {
                if (!m.infosRencontre || !m.infosRencontre.date_rencontre) return false;
                const parts = m.infosRencontre.date_rencontre.split(" ")[0].split("/");
                const mDate = new Date(parts[2], parts[1] - 1, parts[0]);
                return (Math.abs(today - mDate) / (1000 * 60 * 60 * 24)) <= 2.5; 
            });

            recentMatches.slice(0, 5).forEach(m => {
                let dom = cleanTeamName(m.receveur.libelle_court || m.receveur.libelle);
                let vis = cleanTeamName(m.visiteur.libelle_court || m.visiteur.libelle);
                let scoreD = 0; let scoreV = 0;
                if(m.score && m.score.length > 0) {
                    m.score.forEach(s => {
                        if(s.equipe_id === m.receveur.id) scoreD = s.score;
                        if(s.equipe_id === m.visiteur.id) scoreV = s.score;
                    });
                }
                strMatchs += `${dom} ${scoreD} - ${scoreV} ${vis}\n`;
            });
            updateOBSText(sourceNames.matchsDirectTexte, strMatchs.trim() || "Aucun match récent trouvé.");
            statusText.innerText = "✅ Matchs en direct mis à jour !";
        }
        
        else {
            throw new Error("Ce JSON ne correspond à aucun modèle connu.");
        }

        document.getElementById("rolskanetId").value = ""; 
        statusText.style.color = "#1ed760";

    } catch (error) {
        console.error(error);
        statusText.style.color = "#ff4d4d"; 
        statusText.innerHTML = `❌ Erreur : ${error.message}`;
    }
}

// Fonction pour tout aspirer d'un coup (Si vous avez désactivé la sécurité OBS)
async function updatePublicStats() {
    const statusText = document.getElementById("rolskanet-status");
    statusText.style.color = "yellow";
    statusText.innerText = "⏳ Aspiration des stats en cours...";

    try {
        const dataMatchs = await fetchWithProxy("https://rolskanet.fr/sportif/synthese/ajax/liste_rencontres");
        if (dataMatchs && dataMatchs.data) {
            let strMatchs = "";
            const today = new Date();
            const recentMatches = dataMatchs.data.filter(m => {
                if (!m.infosRencontre || !m.infosRencontre.date_rencontre) return false;
                const parts = m.infosRencontre.date_rencontre.split(" ")[0].split("/");
                const mDate = new Date(parts[2], parts[1] - 1, parts[0]);
                return (Math.abs(today - mDate) / (1000 * 60 * 60 * 24)) <= 2.5; 
            });

            recentMatches.slice(0, 5).forEach(m => {
                let dom = cleanTeamName(m.receveur.libelle_court || m.receveur.libelle);
                let vis = cleanTeamName(m.visiteur.libelle_court || m.visiteur.libelle);
                let scoreD = 0; let scoreV = 0;
                if(m.score && m.score.length > 0) {
                    m.score.forEach(s => {
                        if(s.equipe_id === m.receveur.id) scoreD = s.score;
                        if(s.equipe_id === m.visiteur.id) scoreV = s.score;
                    });
                }
                strMatchs += `${dom} ${scoreD} - ${scoreV} ${vis}\n`;
            });
            updateOBSText(sourceNames.matchsDirectTexte, strMatchs.trim() || "Aucun match récent");
        }

        const dataClass = await fetchWithProxy("https://rolskanet.fr/sportif/synthese/ajax/liste_classement");
        if (dataClass && dataClass.data && dataClass.data[0] && dataClass.data[0].data) {
            let strEquipes = ""; let strPoints = "";
            dataClass.data[0].data.slice(0, 5).forEach(t => {
                let nom = cleanTeamName(t.equipe.nom_court || t.equipe.nom);
                strEquipes += `${t.position} - ${nom}\n`;
                strPoints += `${t.nombre_point}\n`;
            });
            updateOBSText(sourceNames.top5ClassEquipe, strEquipes.trim());
            updateOBSText(sourceNames.top5ClassPts, strPoints.trim());
        }
        
        const dataPoint = await fetchWithProxy("https://rolskanet.fr/sportif/statistiques/joueurs/query");
        if (dataPoint && dataPoint.data) {
            let strJoueurs = ""; let strPtsPoint = "";
            dataPoint.data.slice(0, 5).forEach((p, index) => {
                strJoueurs += `${index + 1} - ${p.info.nom_complet}\n`;
                strPtsPoint += `${p.data.points}\n`;
            });
            updateOBSText(sourceNames.top5PointJoueurs, strJoueurs.trim());
            updateOBSText(sourceNames.top5PointPts, strPtsPoint.trim());
        }

        statusText.style.color = "#1ed760";
        statusText.innerText = "✅ Statistiques globales mises à jour !";
    } catch(e) {
        console.error(e);
        statusText.style.color = "#ff4d4d";
        statusText.innerHTML = `❌ Erreur Proxy. Collez les JSON dans la case.`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    resetTimer(); renderPenalties(); connectOBS();
});