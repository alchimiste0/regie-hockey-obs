let scores = { A: 0, B: 0 };
let boxSize = 20;

const periodStates =["ÉCHAUFF.", "PÉRIODE 1", "MI-TEMPS", "PÉRIODE 2", "PROLONG.", "PÉNALTIES"];
let currentPeriodIndex = 0;

let timerInterval = null;
let timerCurrentSeconds = 0;
let timerMaxSeconds = 1200;
let isCountdown = false;

let penalties = { A: [], B:[] };

// --- Variables Replay ---
let replayList = [];
let replayBufferActive = false;
let playQueue =[];
let sceneItemIds = {}; 
let currentLiveScene = ""; 
let isLoopingAll = false; 
let playTimeout = null; 

// --- DICTIONNAIRE LIGUE ELITE ---
const sourceNames = {
  sceneName: "LIVE", // Scène principale
  compoScene: "COMPOSITION", // Scène des compositions d'équipe
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
  replaySource: "Media Replay" 
};

let obs;

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return {
        minutes: String(minutes).padStart(2, '0'),
        seconds: String(seconds).padStart(2, '0')
    };
}

function syncTimerDisplayAndOBS() {
    const time = formatTime(timerCurrentSeconds);
    const timeString = `${time.minutes}:${time.seconds}`;
    document.getElementById('timerMinutes').value = time.minutes;
    document.getElementById('timerSeconds').value = time.seconds;
    updateOBSText(sourceNames.D, timeString);
}

function updatePenaltyOBSText() {
    ['A', 'B'].forEach(team => {
        const sortedPenalties = penalties[team].sort((a, b) => a.timeRemaining - b.timeRemaining);
        const isVisiteur = (team === 'A');
        
        const text1 = isVisiteur ? sourceNames.penaltyA1 : sourceNames.penaltyB1;
        const img1  = isVisiteur ? sourceNames.penaltyImageA : sourceNames.penaltyImageB;
        const text2 = isVisiteur ? sourceNames.penaltyA2 : sourceNames.penaltyB2;
        const img2  = isVisiteur ? sourceNames.penaltyImageA2 : sourceNames.penaltyImageB2;
        
        // Pénalité 1
        if (sortedPenalties.length >= 1) {
            const time1 = formatTime(sortedPenalties[0].timeRemaining);
            setSourceVisibility(text1, true, sourceNames.sceneName);
            setSourceVisibility(img1, true, sourceNames.sceneName);
            updateOBSText(text1, `${time1.minutes}:${time1.seconds}`);
        } else {
            setSourceVisibility(text1, false, sourceNames.sceneName);
            setSourceVisibility(img1, false, sourceNames.sceneName);
        }

        // Pénalité 2
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
    if (isCountdown) {
        if (timerCurrentSeconds > 0) timerCurrentSeconds--;
    } else {
        if (timerCurrentSeconds < timerMaxSeconds) timerCurrentSeconds++;
    }
    const currentPeriod = periodStates[currentPeriodIndex];
    if (currentPeriod !== "ÉCHAUFF." && currentPeriod !== "MI-TEMPS") {
        ['A', 'B'].forEach(team => {
            penalties[team].forEach(p => { if (p.timeRemaining > 0) p.timeRemaining--; });
            penalties[team] = penalties[team].filter(p => p.timeRemaining > 0);
        });
    }
    syncTimerDisplayAndOBS();
    renderPenalties();
    updatePenaltyOBSText();
    if ((isCountdown && timerCurrentSeconds <= 0) || (!isCountdown && timerCurrentSeconds >= timerMaxSeconds)) stopTimer();
}

function renderPenalties() {['A', 'B'].forEach(team => {
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

function addPenalty(team, minutes) {
    penalties[team].push({ id: Date.now(), timeRemaining: minutes * 60 });
    renderPenalties();
    updatePenaltyOBSText();
}
function deletePenalty(team, penaltyId) {
    penalties[team] = penalties[team].filter(p => p.id !== penaltyId);
    renderPenalties();
    updatePenaltyOBSText();
}
function manualSetPenaltyTime(team, penaltyId, element) {
    const penalty = penalties[team].find(p => p.id === penaltyId);
    if (!penalty) return;
    const inputs = element.parentElement.querySelectorAll('input');
    penalty.timeRemaining = (parseInt(inputs[0].value, 10) || 0) * 60 + (parseInt(inputs[1].value, 10) || 0);
    renderPenalties();
    updatePenaltyOBSText();
}

function startTimer() {
    if (timerInterval) return;
    const maxMinutes = parseInt(document.getElementById('maxMinutes').value, 10) || 0;
    const maxSeconds = parseInt(document.getElementById('maxSeconds').value, 10) || 0;
    timerMaxSeconds = (maxMinutes * 60) + maxSeconds;
    if (isCountdown && timerCurrentSeconds === 0) timerCurrentSeconds = timerMaxSeconds;
    timerInterval = setInterval(tick, 1000);
    const btn = document.getElementById('playPauseBtn');
    btn.textContent = '❚❚';
    btn.classList.replace('start-btn', 'stop-btn');
}
function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    const btn = document.getElementById('playPauseBtn');
    btn.textContent = '▶';
    btn.classList.replace('stop-btn', 'start-btn');
}
function toggleTimer() { if (timerInterval) stopTimer(); else startTimer(); }

function resetTimer() {
    stopTimer();
    if (isCountdown) {
        const m = parseInt(document.getElementById('maxMinutes').value, 10) || 0;
        const s = parseInt(document.getElementById('maxSeconds').value, 10) || 0;
        timerCurrentSeconds = (m * 60) + s;
    } else {
        timerCurrentSeconds = 0;
    }
    syncTimerDisplayAndOBS();
}

function manualSetTime() {
    const oldTime = timerCurrentSeconds;
    const m = parseInt(document.getElementById('timerMinutes').value, 10) || 0;
    const s = parseInt(document.getElementById('timerSeconds').value, 10) || 0;
    timerCurrentSeconds = (m * 60) + s;
    const delta = timerCurrentSeconds - oldTime;
    if (delta !== 0) updatePenaltiesWithDelta(delta);
    
    updateOBSText(sourceNames.D, `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    renderPenalties();
    updatePenaltyOBSText();
}

function adjustTimer(delta) {
    const oldTime = timerCurrentSeconds;
    let newTime = timerCurrentSeconds + delta;
    if (newTime < 0) newTime = 0;
    if (newTime > 5999) newTime = 5999; 
    
    timerCurrentSeconds = newTime;
    
    const realDelta = timerCurrentSeconds - oldTime;
    if (realDelta !== 0) updatePenaltiesWithDelta(realDelta);

    syncTimerDisplayAndOBS();
    renderPenalties();
    updatePenaltyOBSText();
}

function updatePenaltiesWithDelta(delta) {['A', 'B'].forEach(team => {
        penalties[team].forEach(p => {
            p.timeRemaining -= isCountdown ? -delta : delta;
            if (p.timeRemaining < 0) p.timeRemaining = 0;
        });
        penalties[team] = penalties[team].filter(p => p.timeRemaining > 0);
    });
}

function invertTimerDirection() {
    isCountdown = !isCountdown;
    document.getElementById('invertBtn').textContent = isCountdown ? "Mode: Décompte" : "Mode: Chrono";
    resetTimer();
}
function changePeriod(delta) {
    currentPeriodIndex = Math.max(0, Math.min(periodStates.length - 1, currentPeriodIndex + delta));
    const newPeriodText = periodStates[currentPeriodIndex];
    document.getElementById("periodDisplay").textContent = newPeriodText;
    updateOBSText(sourceNames.C, newPeriodText);
}
function changeScore(player, delta) {
    scores[player] += delta;
    document.getElementById("score" + player).textContent = scores[player];
    updateOBSText(sourceNames[player], scores[player]);
}
function resizeBoxes(delta) {
    boxSize = Math.max(0, boxSize + delta);
    document.querySelectorAll(".zone").forEach(zone => { zone.style.padding = boxSize + "px " + (boxSize * 2) + "px"; });
}
function toggleLayout() { document.body.classList.toggle("horizontal-layout"); }

// --- SYSTEME DE REPLAY ---

function updateReplayBtnUI() {
    const btn = document.getElementById("toggleReplayBtn");
    const content = document.getElementById("replay-content");
    if (replayBufferActive) {
        btn.textContent = "⏹️ Désactiver le Replay Buffer";
        btn.classList.replace("start-btn", "stop-btn");
        content.className = "replay-content-active"; 
    } else {
        btn.textContent = "▶️ Activer le Replay Buffer";
        btn.classList.replace("stop-btn", "start-btn");
        content.className = "replay-content-hidden"; 
    }
}

function toggleReplayBuffer() {
    sendReq(replayBufferActive ? "StopReplayBuffer" : "StartReplayBuffer");
}

function saveReplay() {
    sendReq("SaveReplayBuffer");
    document.getElementById("saveReplayBtn").textContent = "⏳ Capture en cours...";
}

function playReplays(paths) {
    if (!ensureOBSConnection() || paths.length === 0) return;
    playQueue = [...paths];
    sendReq("GetCurrentProgramScene", {}, "get-scene-for-replay");
}

function playNextInQueue(isFirstVideo = false) {
    if (playQueue.length > 0) {
        const nextFile = playQueue.shift();
        
        if (currentLiveScene !== "") setSourceVisibility(sourceNames.replayGroup, false, currentLiveScene);
        clearTimeout(playTimeout);
        playTimeout = setTimeout(() => {
            sendReq("SetInputSettings", {
                inputName: sourceNames.replaySource,
                inputSettings: { local_file: nextFile, is_local_file: true, looping: false, restart_on_activate: true, speed_percent: 60 }
            });
            sendReq("TriggerMediaInputAction", { inputName: sourceNames.replaySource, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART" });
            sendReq("SetInputMute", { inputName: sourceNames.replaySource, inputMuted: true });
            
            if (isFirstVideo && currentLiveScene !== "") {
                setSourceVisibility(sourceNames.replayGroup, true, currentLiveScene);
            }
        }, 40); 
    } else {
        const isLoopChecked = document.getElementById("loopReplaysCheckbox").checked;
        if (isLoopingAll && isLoopChecked && replayList.length > 0) {
            playQueue = [...replayList];
            playNextInQueue(false); 
        } else {
            hideReplayOnStream();
        }
    }
}

function playLastReplay() {
    if (replayList.length > 0) { isLoopingAll = false; playReplays([replayList[replayList.length - 1]]); } 
    else alert("Aucune vidéo capturée !");
}
function playAllReplays() {
    if (replayList.length > 0) { isLoopingAll = true; playReplays(replayList); } 
    else alert("Liste vide !");
}
function clearReplays() {
    replayList = []; playQueue =[]; document.getElementById("replayCount").innerText = "0";
    const btn = document.getElementById("deleteBtn");
    btn.textContent = "✅ Vidé !"; setTimeout(() => { btn.textContent = "🗑️ Vider la liste"; }, 1500);
}
function hideReplayOnStream() {
    playQueue =[]; isLoopingAll = false; clearTimeout(playTimeout);
    sendReq("TriggerMediaInputAction", { inputName: sourceNames.replaySource, mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP" });
    if (currentLiveScene !== "") setSourceVisibility(sourceNames.replayGroup, false, currentLiveScene);
}

// --- COMMUNICATION OBS WEBSOCKET NATIVE (v5) ---

function sendReq(type, data = {}, reqId = null) {
    if (!ensureOBSConnection()) return;
    obs.send(JSON.stringify({ op: 6, d: { requestType: type, requestId: reqId || (type + Date.now()), requestData: data } }));
}

function connectOBS() {
    obs = new WebSocket("ws://localhost:4455");
    obs.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.op === 0) obs.send(JSON.stringify({ op: 1, d: { rpcVersion: 1 } }));
        else if (payload.op === 2) {
            console.log("✅ Connecté à OBS");
            updateOBSText(sourceNames.C, periodStates[currentPeriodIndex]);
            syncTimerDisplayAndOBS();
            updatePenaltyOBSText();
            sendReq("GetReplayBufferStatus", {}, "init-replay-status");
        } 
        else if (payload.op === 5) {
            const type = payload.d.eventType;
            const data = payload.d.eventData;
            if (type === "ReplayBufferStateChanged") {
                replayBufferActive = data.outputActive; updateReplayBtnUI();
            } 
            else if (type === "ReplayBufferSaved") {
                const path = data.savedReplayPath;
                if (path && !replayList.includes(path)) {
                    replayList.push(path);
                    document.getElementById("replayCount").innerText = replayList.length;
                    const btn = document.getElementById("saveReplayBtn");
                    btn.textContent = "✅ Action capturée !";
                    setTimeout(() => { btn.textContent = "📸 Capturer l'action !"; }, 2000);
                }
            } 
            else if (type === "MediaInputPlaybackEnded") {
                if (data.inputName === sourceNames.replaySource) playNextInQueue(false);
            }
        } 
        else if (payload.op === 7) {
            const reqId = payload.d.requestId;
            const data = payload.d.responseData;
            const status = payload.d.requestStatus;

            if (!status.result) return;
            if (reqId === "init-replay-status") { replayBufferActive = data.outputActive; updateReplayBtnUI(); } 
            else if (reqId === "get-scene-for-replay") { currentLiveScene = data.currentProgramSceneName; playNextInQueue(true); }
            else if (reqId.startsWith("getid:::")) {
                const parts = reqId.split(":::");
                sceneItemIds[parts[1] + ":::" + parts[2]] = data.sceneItemId;
                sendReq("SetSceneItemEnabled", { sceneName: parts[1], sceneItemId: data.sceneItemId, sceneItemEnabled: parts[3] === "true" });
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
    if (sceneItemIds[cacheKey] !== undefined) {
        sendReq("SetSceneItemEnabled", { sceneName: targetScene, sceneItemId: sceneItemIds[cacheKey], sceneItemEnabled: isVisible });
    } else {
        sendReq("GetSceneItemId", { sceneName: targetScene, sourceName: sourceName }, "getid:::" + targetScene + ":::" + sourceName + ":::" + isVisible);
    }
}
function updateOBSText(sourceName, newText) {
    sendReq("SetInputSettings", { inputName: sourceName, inputSettings: { text: String(newText) } });
}


// --- MODULE D'IMPORTATION ROLSKANET ---

async function fetchRolskanetData() {
    const input = document.getElementById("rolskanetId").value.trim();
    if (!input) return alert("Veuillez entrer le lien ou l'ID du match.");

    // Extrait juste l'ID si l'utilisateur a collé tout le lien
    const matchId = input.replace(/\D/g, ""); 
    if (!matchId) return alert("ID invalide !");

    const statusText = document.getElementById("rolskanet-status");
    statusText.style.color = "yellow";
    statusText.innerText = "⏳ Connexion au serveur...";

    try {
        const targetUrl = `https://rolskanet.fr/sportif/live/${matchId}/ajax/ajax/init-data`;
        
        // ASTUCE ANTI-CORS (Spécial Fichier Local OBS) : 
        // On utilise "/get" au lieu de "/raw". Cela emballe la réponse et force l'autorisation.
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Le serveur proxy a refusé la connexion.");
        
        const wrapper = await response.json();
        if (!wrapper.contents) throw new Error("Le contenu renvoyé par la fédération est vide.");

        // On déballe les données du site de la fédération
        const data = JSON.parse(wrapper.contents);

        // 1. Mise à jour des Noms d'équipes (On enlève le "01179 - " au début)
        const domName = data.receveur.libelle_court.replace(/^\d+\s*-\s*/, '');
        const visName = data.visiteur.libelle_court.replace(/^\d+\s*-\s*/, '');
        
        document.getElementById("domName").innerText = domName;
        document.getElementById("visName").innerText = visName;
        updateOBSText(sourceNames.B_Name, domName);
        updateOBSText(sourceNames.A_Name, visName);

        // 2. Recherche du score
        let scoreDom = 0; let scoreVis = 0;
        if (data.scores) {
            data.scores.forEach(s => {
                if (s.equipe_id === data.receveur.id) scoreDom = s.score;
                if (s.equipe_id === data.visiteur.id) scoreVis = s.score;
            });
        }
        
        scores.B = scoreDom; document.getElementById("scoreB").textContent = scoreDom; updateOBSText(sourceNames.B, scoreDom);
        scores.A = scoreVis; document.getElementById("scoreA").textContent = scoreVis; updateOBSText(sourceNames.A, scoreVis);

        // 3. Génération des Compositions (Effectifs)
        let compoDom = "";
        let compoVis = "";

        if (data.joueurs) {
            data.joueurs.forEach(joueur => {
                let attributStr = "";
                // Si le joueur est Capitaine (CA) ou Assistant (ASS)
                if (joueur.attributs && joueur.attributs.length > 0) {
                    if (joueur.attributs[0].code === "CA") attributStr = " (C)";
                    if (joueur.attributs[0].code === "ASS") attributStr = " (A)";
                }
                
                // Format "94 - VAULLERIN Tom (C)"
                const ligne = `${joueur.numero || "0"} - ${joueur.nom_complet.replace("M ", "").replace("Mme ", "")}${attributStr}\n`;
                
                if (joueur.equipe_id === data.receveur.id) compoDom += ligne;
                if (joueur.equipe_id === data.visiteur.id) compoVis += ligne;
            });
        }

        // Envoi des compos entières dans la scène de présentation OBS
        updateOBSText(sourceNames.B_Compo, compoDom.trim());
        updateOBSText(sourceNames.A_Compo, compoVis.trim());

        statusText.style.color = "#1ed760";
        statusText.innerText = "✅ Importation réussie !";

    } catch (error) {
        console.error("Erreur Rolskanet:", error);
        statusText.style.color = "red";
        statusText.innerText = "❌ Erreur de récupération. Réessayez.";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    resetTimer();
    renderPenalties();
    connectOBS();
});