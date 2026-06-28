const SERVER_BASE = 'https://code-alpha-collaborative-task-management-1yij.onrender.com';
const API_URL = `${SERVER_BASE}/api`;
let token = localStorage.getItem('token') || '';
let activeProjectId = '';
let currentAuthMode = 'login'; 
let socket;
let globalLoadedTasksArray = []; 
let velocityChartInstance = null;
let isRightPanelVisible = true;

// Core Configuration Implementations
if (localStorage.getItem('appTheme') === 'dark') document.body.classList.add('dark-theme');
if (localStorage.getItem('layoutDensity') === 'compact') document.body.classList.add('compact-mode');
if (localStorage.getItem('appNotifications') === 'granted' && Notification.permission !== 'granted') Notification.requestPermission();

if (token) {
  setupSocketConnection();
  revealDashboard();
}

function switchAuthMode(mode) {
  currentAuthMode = mode;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const selectedTab = document.getElementById(`tab-${mode}`);
  if (selectedTab) selectedTab.classList.add('active');
  
  const nameInput = document.getElementById('auth-name');
  if (nameInput) {
    if (mode === 'register') {
      nameInput.style.display = 'block';
      document.getElementById('auth-submit-btn').innerText = '📝 Create Account Profile';
    } else {
      nameInput.style.display = 'none';
      document.getElementById('auth-submit-btn').innerText = '🔑 Access Workspace';
    }
  }
}
async function submitAuthForm() {
  console.log('submitAuthForm called');
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value.trim();
  
  // Clean initialization check for the hidden name field input parameter
  let name = "";
  const nameElement = document.getElementById('auth-name');
  if (nameElement) {
    name = nameElement.value.trim();
  }

  // Basic client-side guard validation
  if (!email || !password) {
    alert("⚠️ Please fill out all required fields.");
    return;
  }
  if (currentAuthMode === 'register' && !name) {
    alert("⚠️ Please enter your Full Name to complete your registration.");
    return;
  }

  try {
    const payload = currentAuthMode === 'register' 
      ? { name, email, password } 
      : { email, password };

    const res = await fetch(`${API_URL}/auth/${currentAuthMode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    
    if (res.ok && data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.name || name || 'User');
      token = data.token;
      
      setupSocketConnection();
      revealDashboard();
    } else {
      alert('❌ Authorization Failed: ' + (data.msg || 'Invalid credentials or database match fault.'));
    }
  } catch (err) {
    console.error("Auth server connection fault:", err);
    alert("❌ Could not connect to the backend server. Make sure your Node server is running on port 5000.");
  }
}
function setupSocketConnection() {
  socket = io(SERVER_BASE);
  socket.on('taskUpdated', () => {
    if (activeProjectId) {
      loadProjectTasksEngine();
    }
  });
}

function revealDashboard() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('workspace-screen').style.display = 'flex';
  document.getElementById('logout-btn').style.display = 'block';
  document.getElementById('settings-btn').style.display = 'inline-block';
  document.getElementById('welcome-msg').innerText = `👤 Session: ${localStorage.getItem('username')}`;
  
  document.getElementById('setting-theme').value = localStorage.getItem('appTheme') || 'light';
  document.getElementById('setting-density').value = localStorage.getItem('layoutDensity') || 'comfortable';
  document.getElementById('setting-timeout').value = localStorage.getItem('appTimeout') || 'off';
  document.getElementById('setting-audio').value = localStorage.getItem('appAudio') || 'enabled';
  
  initializeAutoLockTimer();
  syncProjectsList();
}

function logout() {
  localStorage.clear();
  window.location.reload();
}

function toggleSettingsModal(shouldOpen) {
  document.getElementById('settings-modal').style.display = shouldOpen ? 'flex' : 'none';
}

function applyThemePreference(themeValue) {
  if (themeValue === 'dark') document.body.classList.add('dark-theme');
  else document.body.classList.remove('dark-theme');
}

function applyDensityPreference(densityValue) {
  if (densityValue === 'compact') document.body.classList.add('compact-mode');
  else document.body.classList.remove('compact-mode');
}

function saveSettingsOptions() {
  localStorage.setItem('appTheme', document.getElementById('setting-theme').value);
  localStorage.setItem('layoutDensity', document.getElementById('setting-density').value);
  localStorage.setItem('appAudio', document.getElementById('setting-audio').value);
  
  const notifVal = document.getElementById('setting-notifications').value;
  localStorage.setItem('appNotifications', notifVal);
  if (notifVal === 'granted') Notification.requestPermission();
  
  localStorage.setItem('appTimeout', document.getElementById('setting-timeout').value);
  initializeAutoLockTimer();
  
  toggleSettingsModal(false);
}

function toggleRightCollaborationPanel() {
  const panelElement = document.getElementById('right-collaboration-panel');
  const toggleBtn = document.getElementById('toggle-right-panel-btn');
  if (!panelElement) return;
  isRightPanelVisible = !isRightPanelVisible;
  if (isRightPanelVisible) {
    panelElement.style.display = 'flex';
    if (toggleBtn) toggleBtn.innerText = "👥 Hide Activity Panel";
  } else {
    panelElement.style.display = 'none';
    if (toggleBtn) toggleBtn.innerText = "👥 Show Activity Panel";
  }
}

async function syncProjectsList() {
  const container = document.getElementById('project-navigation-list');
  container.innerHTML = '';
  try {
    const res = await fetch(`${API_URL}/projects`, { headers: { 'Authorization': `Bearer ${token}` } });
    const userProjects = await res.json();
    // Cache projects locally so UI can recover when a refresh breaks network access
    try { localStorage.setItem('cachedProjects', JSON.stringify(userProjects || [])); } catch (e) {}

    userProjects.forEach(p => {
      const li = document.createElement('li');
      li.innerText = `📁 ${p.name}`;
      li.className = 'demo-badge';
      li.onclick = () => mountProjectBoard(p._id, `📁 ${p.name}`);
      container.appendChild(li);
    });
  } catch (err) {
    console.error('Failed to load projects from API:', err);
    // Try loading cached projects so the UI still shows something after refresh
    const cached = localStorage.getItem('cachedProjects');
    if (cached) {
      try {
        const cachedProjects = JSON.parse(cached);
        cachedProjects.forEach(p => {
          const li = document.createElement('li');
          li.innerText = `📁 ${p.name}`;
          li.className = 'demo-badge';
          li.onclick = () => mountProjectBoard(p._id, `📁 ${p.name}`);
          container.appendChild(li);
        });
        return;
      } catch (e) { console.error('Invalid cached projects', e); }
    }
    container.innerHTML = '<li style="color:var(--secondary);">Could not load projects — please sign in or check the server.</li>';
  }
}

async function createNewProject() {
  const name = document.getElementById('proj-title').value;
  const description = document.getElementById('proj-desc').value;
  if (!name.trim()) return;

  await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ name, description })
  });
  
  document.getElementById('proj-title').value = '';
  document.getElementById('proj-desc').value = '';
  playSystemFeedbackSound('success');
  syncProjectsList();
}

function mountProjectBoard(id, name) {
  activeProjectId = id;
  document.getElementById('board-empty-state').style.display = 'none';
  document.getElementById('active-board').style.display = 'block';
  document.getElementById('right-collaboration-panel').style.display = 'flex';
  isRightPanelVisible = true;
  document.getElementById('toggle-right-panel-btn').innerText = "👥 Hide Activity Panel";
  
  const boardTitle = document.getElementById('active-project-name');
  if (boardTitle) boardTitle.innerText = `📂 Working Directory: ${name.replace('📁 ', '')}`;
  
  document.getElementById('global-board-search').value = '';

  if (socket && socket.connected) socket.emit('joinProject', id);
  loadProjectTasksEngine();
}

async function loadProjectTasksEngine() {
  if (!activeProjectId) return;
  try {
    const res = await fetch(`${API_URL}/tasks/${activeProjectId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    globalLoadedTasksArray = await res.json();
    renderTasksToDOM(globalLoadedTasksArray);
  } catch (err) {
    console.error(err);
  }
}
/* --- UPGRADED SEARCH ENGINE: FIXED BUTTONS + SHIMMER TRIGGER --- */
function handleGlobalBoardFilterSearch(queryText, event) {
  const sanitizedInput = queryText.toLowerCase().trim();
  const allCardsOnScreen = document.querySelectorAll('.task-card');
  let firstMatchedCard = null;

  allCardsOnScreen.forEach(cardElement => {
    // Read clean structural text fields inside the card
    const cardTitle = cardElement.querySelector('h4')?.innerText.toLowerCase() || '';
    const cardDesc = cardElement.querySelector('p')?.innerText.toLowerCase() || '';
    
    if (cardTitle.includes(sanitizedInput) || cardDesc.includes(sanitizedInput)) {
      // ✅ Keep card visible and ensure internal buttons stay interactive
      cardElement.style.display = 'block';
      if (!firstMatchedCard && sanitizedInput !== '') {
        firstMatchedCard = cardElement;
      }
    } else {
      cardElement.style.display = 'none';
    }
  });

  // ⚡ IF USER PRESSES 'ENTER', TRIGGER THE CELEBRATION SHINE!
  if (event && event.key === 'Enter' && firstMatchedCard) {
    event.preventDefault(); // Stop page from accidently shifting
    
    // Smoothly scroll the matched card right into view center
    firstMatchedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Inject the shimmer class anim
    firstMatchedCard.classList.add('found-shimmer-highlight');
    
    // Clean up class after animation ends so it can be re-triggered later
    setTimeout(() => {
      firstMatchedCard.classList.remove('found-shimmer-highlight');
    }, 1500);
  }
}

function handleTaskDragStarted(event, taskId) {
  event.dataTransfer.setData('text/plain', taskId);
  event.currentTarget.classList.add('dragging-active-state');
}

function handleTaskDragEnded(event) {
  event.currentTarget.classList.remove('dragging-active-state');
  document.querySelectorAll('.kanban-col').forEach(col => col.classList.remove('drag-hover-zone'));
}

function allowTaskDropzoneTracking(event) {
  event.preventDefault();
  event.currentTarget.classList.add('drag-hover-zone');
}

function handleTaskDroppedAction(event, destinationLane) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-hover-zone');
  const uniqueMovedTaskId = event.dataTransfer.getData('text/plain');
  
  dispatchStatusTransition(uniqueMovedTaskId, destinationLane);
}

function updateProductivityVelocityChart(todoCount, progressCount, doneCount) {
  const chartCanvasElement = document.getElementById('velocityChart');
  if (!chartCanvasElement) return;

  if (velocityChartInstance) {
    velocityChartInstance.destroy();
  }

  velocityChartInstance = new Chart(chartCanvasElement, {
    type: 'doughnut',
    data: {
      labels: ['Todo', 'In Progress', 'Completed'],
      datasets: [{
        data: [todoCount, progressCount, doneCount],
        backgroundColor: ['#64748b', '#3b82f6', '#10b981'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'right', labels: { boxWidth: 12, font: { size: 10 } } }
      }
    }
  });
}

function renderTasksToDOM(tasks) {
  let counts = { Todo: 0, 'In Progress': 0, Done: 0 };
  
  ['Todo', 'In Progress', 'Done'].forEach(lane => {
    const laneStack = document.querySelector(`#lane-${lane} .task-stack`);
    if (laneStack) laneStack.innerHTML = '';
  });

  const assignmentsContainer = document.getElementById('assignment-directory');
  const globalActivityFeed = document.getElementById('global-activity-stream');
  
  if (assignmentsContainer) assignmentsContainer.innerHTML = '';
  if (globalActivityFeed) globalActivityFeed.innerHTML = '';
  
  let allCommentsCompiled = [];

  tasks.forEach((task, index) => {
    counts[task.status] = (counts[task.status] || 0) + 1;
    let targetLane = document.querySelector(`#lane-${task.status} .task-stack`);

    if (targetLane) {
      const generatedDomCardId = `task-dom-ref-${task._id || index}`;
      const commentsHTML = task.comments.map(c => `<div>💬 <strong>${c.user}:</strong> ${c.text}</div>`).join('');
      const priorityStr = task.priority || 'Medium';

      task.comments.forEach(c => {
        allCommentsCompiled.push({ targetId: generatedDomCardId, taskTitle: task.title, user: c.user, text: c.text });
      });

      const assignmentLi = document.createElement('li');
      assignmentLi.style.cursor = 'pointer';
      assignmentLi.innerHTML = `👤 <strong>${task.assignedTo || 'Unassigned'}</strong>:<br> ${task.title}`;
      assignmentLi.onclick = () => focalHighlightTaskCard(generatedDomCardId);
      assignmentsContainer.appendChild(assignmentLi);

      const card = document.createElement('div');
      card.className = 'task-card';
      card.id = generatedDomCardId;
      
      card.setAttribute('draggable', 'true');
      card.ondragstart = (e) => handleTaskDragStarted(e, task._id);
      card.ondragend = (e) => handleTaskDragEnded(e);

      card.innerHTML = `
        <span class="priority-tag ${priorityStr.toLowerCase()}">${priorityStr} Priority</span>
        <h4>📌 ${task.title}</h4>
        <p>📝 ${task.description || 'No execution brief provided.'}</p>
        <p><small>🏁 Assignee: <strong>👤 ${task.assignedTo}</strong></small></p>
        <select onchange="dispatchStatusTransition('${task._id}', this.value)" style="margin-top:5px;">
          <option ${task.status === 'Todo' ? 'selected' : ''}>⏳ Todo</option>
          <option ${task.status === 'In Progress' ? 'selected' : ''}>⚙️ In Progress</option>
          <option ${task.status === 'Done' ? 'selected' : ''}>✅ Done</option>
        </select>
        <div class="comment-block">
          <div class="comment-list">${commentsHTML}</div>
          <input type="text" class="comment-input" placeholder="💬 Feedback + hit Enter" onkeydown="if(event.key==='Enter') dispatchComment('${task._id}', this.value)">
        </div>
      `;
      targetLane.appendChild(card);
    }
  });

  updateProductivityVelocityChart(counts['Todo'], counts['In Progress'], counts['Done']);
  playSystemFeedbackSound('update');

  if (document.getElementById('diag-projects')) {
    const projectsListCount = document.getElementById('project-navigation-list')?.getElementsByTagName('li').length || 0;
    document.getElementById('diag-projects').innerText = `${projectsListCount} Operational Boards`;
    document.getElementById('diag-tasks').innerText = `${tasks.length} Active Cards`;
  }

  if (allCommentsCompiled.length === 0) {
    globalActivityFeed.innerHTML = `<div style="text-align:center; color:var(--secondary); font-size:0.8rem;">No team discussion threads yet.</div>`;
  } else {
    allCommentsCompiled.forEach(comment => {
      const feedBlock = document.createElement('div');
      feedBlock.className = 'activity-card';
      feedBlock.style.cursor = 'pointer';
      feedBlock.innerHTML = `<strong>💬 ${comment.user}</strong>: "${comment.text}"<span class="meta-task">on task: ${comment.taskTitle}</span>`;
      feedBlock.onclick = () => focalHighlightTaskCard(comment.targetId);
      globalActivityFeed.appendChild(feedBlock);
    });
  }
}

async function createNewTask() {
  const title = document.getElementById('task-title').value;
  const description = document.getElementById('task-desc').value;
  const assignedTo = document.getElementById('task-assignee').value;
  const priority = document.getElementById('task-priority').value; 
  if (!title.trim()) return;

  await fetch(`${API_URL}/tasks/${activeProjectId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ title, description, assignedTo, priority })
  });
  loadProjectTasksEngine();
  
  playSystemFeedbackSound('success');
  document.getElementById('task-title').value = '';
  document.getElementById('task-desc').value = '';
  document.getElementById('task-assignee').value = '';
}

async function dispatchStatusTransition(taskId, newStatus) {
  const cleanStatus = newStatus.includes('Todo') ? 'Todo' : newStatus.includes('In Progress') ? 'In Progress' : 'Done';
  await fetch(`${API_URL}/tasks/${taskId}`, { 
    method: 'PUT', 
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
    body: JSON.stringify({ status: cleanStatus }) 
  });
  loadProjectTasksEngine();
}

async function dispatchComment(taskId, commentText) {
  if (!commentText.trim()) return;
  await fetch(`${API_URL}/tasks/${taskId}/comment`, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
    body: JSON.stringify({ text: commentText }) 
  });
  loadProjectTasksEngine();
}

function focalHighlightTaskCard(domIdString) {
  const targetedDomElement = document.getElementById(domIdString);
  if (targetedDomElement) {
    targetedDomElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetedDomElement.style.border = '2px solid var(--primary)';
    setTimeout(() => { targetedDomElement.style.border = '1px solid var(--gray)'; }, 2500);
  }
}

function playSystemFeedbackSound(type) {
  if (localStorage.getItem('appAudio') === 'disabled') return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode); gainNode.connect(audioCtx.destination);
    if (type === 'success') {
      oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime); oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.1);
    } else {
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.08);
    }
  } catch (e) {}
}

let autoLockTimeoutReference;
function initializeAutoLockTimer() {
  const timeoutPreference = localStorage.getItem('appTimeout') || 'off';
  if (autoLockTimeoutReference) clearTimeout(autoLockTimeoutReference);
  if (timeoutPreference === 'off') return;
  const totalMillisecondsDelay = parseInt(timeoutPreference) * 60 * 1000;
  const resetTimerAction = () => {
    clearTimeout(autoLockTimeoutReference);
    autoLockTimeoutReference = setTimeout(() => { alert("⏱️ Session Expired due to inactivity. Logging out."); logout(); }, totalMillisecondsDelay);
  };
  window.onmousemove = resetTimerAction; window.onkeypress = resetTimerAction;
  resetTimerAction();
}

function wipeLocalWorkspaceCache() {
  if (confirm("⚠️ Are you sure you want to clear the workspace cache?")) {
    localStorage.clear(); window.location.reload();
  }
}

// Ensure functions used by inline `onclick` attributes are available globally
window.submitAuthForm = submitAuthForm;