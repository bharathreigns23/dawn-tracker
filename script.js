// --- Data and State ---
const DEFAULT_HABITS = [
    { id: '1', name: 'Drink water' },
    { id: '2', name: 'Workout' },
    { id: '3', name: 'Read 20 minutes' },
    { id: '4', name: 'Meditate' },
    { id: '5', name: 'Sleep by 10pm' }
];

let state = {
    habits: [],
    ticks: {} // format: "habitId-YYYY-MM-DD": true
};

let currentMonthDate = new Date();
currentMonthDate.setDate(1); // Set to 1st of month to avoid overflow

let draggedHabitIndex = null;

// --- Theme Management ---
function initTheme() {
    const savedTheme = localStorage.getItem('habitTrackerTheme');
    if (savedTheme) {
        setTheme(savedTheme);
    } else {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    }
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('habitTrackerTheme', theme);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.checked = theme === 'dark';
    }
}

document.getElementById('theme-toggle').addEventListener('change', (e) => {
    setTheme(e.target.checked ? 'dark' : 'light');
});


// --- Data Management Functions ---
function loadData() {
    try {
        const data = localStorage.getItem('habitTrackerData');
        if (data) {
            const parsed = JSON.parse(data);
            state.habits = parsed.habits || [];
            state.ticks = parsed.ticks || {};
            if (!parsed.habits && !parsed.ticks) {
                state.habits = [...DEFAULT_HABITS];
            }
        } else {
            state.habits = [...DEFAULT_HABITS];
            state.ticks = {};
        }
    } catch (e) {
        console.error("Error parsing local storage data, falling back to defaults.", e);
        state.habits = [...DEFAULT_HABITS];
        state.ticks = {};
    }
}

function saveData() {
    localStorage.setItem('habitTrackerData', JSON.stringify(state));
}

// --- Habit Management Functions ---
function addHabit(name) {
    const trimmed = name.trim();
    const errorEl = document.getElementById('habit-error');
    errorEl.textContent = '';

    if (!trimmed) {
        errorEl.textContent = 'Habit name cannot be empty.';
        return false;
    }

    if (state.habits.some(h => h.name.toLowerCase() === trimmed.toLowerCase())) {
        errorEl.textContent = 'Habit already exists.';
        return false;
    }

    const newId = Date.now().toString();
    state.habits.push({ id: newId, name: trimmed });
    saveData();
    render();
    return true;
}

function deleteHabit(id) {
    if (confirm("Delete this habit? This cannot be undone.")) {
        state.habits = state.habits.filter(h => h.id !== id);
        
        for (let key in state.ticks) {
            if (key.startsWith(id + '-')) {
                delete state.ticks[key];
            }
        }
        
        saveData();
        render();
    }
}

function renameHabit(id, newName) {
    const trimmed = newName.trim();
    if (trimmed) {
        const habit = state.habits.find(h => h.id === id);
        if (habit) {
            habit.name = trimmed;
            saveData();
            render();
        }
    }
}

function toggleTick(habitId, dateString) {
    const key = `${habitId}-${dateString}`;
    if (state.ticks[key]) {
        delete state.ticks[key];
    } else {
        state.ticks[key] = true;
    }
    saveData();
    render();
}

// --- Date Utilities ---
function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function formatDateString(year, month, day) {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
}

function getDayLetter(year, month, day) {
    const date = new Date(year, month, day);
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return days[date.getDay()];
}

function isToday(year, month, day) {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
}

function isPastDay(year, month, day) {
    const date = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
}

function isFutureDay(year, month, day) {
    const date = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
}

function getWeekStartAndEnd(date) {
    const current = new Date(date);
    let dayOfWeek = current.getDay();
    const diffToMonday = current.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); 
    
    const weekStart = new Date(current.setDate(diffToMonday));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    return { weekStart, weekEnd };
}

// --- Calculations ---
function dailyPercent(year, month, day) {
    if (state.habits.length === 0) return 0;
    const dateString = formatDateString(year, month, day);
    let ticks = 0;
    state.habits.forEach(h => {
        if (state.ticks[`${h.id}-${dateString}`]) {
            ticks++;
        }
    });
    return Math.round((ticks / state.habits.length) * 100);
}

function weeklyPercent(habitId, year, month, day) {
    const today = new Date();
    const { weekStart, weekEnd } = getWeekStartAndEnd(today);
    
    let possibleDays = 0;
    let ticks = 0;

    let d = new Date(weekStart);
    while (d <= weekEnd && d <= today) {
        possibleDays++;
        const dateString = formatDateString(d.getFullYear(), d.getMonth(), d.getDate());
        if (state.ticks[`${habitId}-${dateString}`]) {
            ticks++;
        }
        d.setDate(d.getDate() + 1);
    }
    
    if (possibleDays === 0) return 0;
    return Math.round((ticks / possibleDays) * 100);
}

function monthlyPercent(habitId, year, month) {
    const days = daysInMonth(year, month);
    const today = new Date();
    
    let possibleDays = days;
    
    if (year === today.getFullYear() && month === today.getMonth()) {
        possibleDays = today.getDate();
    } else if (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth())) {
        possibleDays = 0;
    }

    if (possibleDays === 0) return 0;
    
    let ticks = 0;
    for (let d = 1; d <= possibleDays; d++) {
        const dateString = formatDateString(year, month, d);
        if (state.ticks[`${habitId}-${dateString}`]) {
            ticks++;
        }
    }
    return Math.round((ticks / possibleDays) * 100);
}

function calculateStreak() {
    if (state.habits.length === 0) return 0;
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    let dateToCheck = new Date(currentDate);
    
    while (true) {
        const dateString = formatDateString(dateToCheck.getFullYear(), dateToCheck.getMonth(), dateToCheck.getDate());
        let hasTick = false;
        
        for (let i = 0; i < state.habits.length; i++) {
            if (state.ticks[`${state.habits[i].id}-${dateString}`]) {
                hasTick = true;
                break;
            }
        }
        
        if (hasTick) {
            streak++;
            dateToCheck.setDate(dateToCheck.getDate() - 1);
        } else {
            if (dateToCheck.getTime() === currentDate.getTime()) {
                 dateToCheck.setDate(dateToCheck.getDate() - 1);
            } else {
                break;
            }
        }
    }
    return streak;
}

function overallMonthlyCompletion(year, month) {
    if (state.habits.length === 0) return 0;
    
    let totalPossible = 0;
    let totalTicks = 0;
    
    const days = daysInMonth(year, month);
    const today = new Date();
    
    let maxDay = days;
    if (year === today.getFullYear() && month === today.getMonth()) {
        maxDay = today.getDate();
    } else if (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth())) {
        maxDay = 0;
    }
    
    if (maxDay === 0) return 0;

    for (let d = 1; d <= maxDay; d++) {
        const dateString = formatDateString(year, month, d);
        for (let h of state.habits) {
            totalPossible++;
            if (state.ticks[`${h.id}-${dateString}`]) {
                totalTicks++;
            }
        }
    }
    
    if (totalPossible === 0) return 0;
    return Math.round((totalTicks / totalPossible) * 100);
}

// --- Render ---
function createPercentCell(percent, isTodayFlag = false) {
    const td = document.createElement('td');
    td.className = 'percent-cell';
    if (isTodayFlag) td.classList.add('today-col');
    
    const bar = document.createElement('div');
    bar.className = 'percent-bar';
    bar.style.width = `${percent}%`;
    
    if (percent >= 75) {
        bar.style.backgroundColor = 'var(--color-primary)';
    } else if (percent >= 40) {
        bar.style.backgroundColor = 'var(--color-warn)';
    } else {
        bar.style.backgroundColor = 'var(--color-error)';
    }
    
    const text = document.createElement('span');
    text.className = 'percent-text';
    text.textContent = `${percent}%`;
    
    td.appendChild(bar);
    td.appendChild(text);
    return td;
}

function render() {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const days = daysInMonth(year, month);
    
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    document.getElementById('current-month-display').textContent = `${monthNames[month]} ${year}`;
    
    const monthlyComp = overallMonthlyCompletion(year, month);
    document.getElementById('monthly-completion').textContent = `${monthlyComp}%`;
    document.getElementById('monthly-progress-fill').style.width = `${monthlyComp}%`;
    document.getElementById('current-streak').textContent = `${calculateStreak()} days`;

    const table = document.getElementById('tracker-table');
    table.innerHTML = '';
    
    const trHead = document.createElement('tr');
    const thHabit = document.createElement('th');
    thHabit.className = 'habit-name-col';
    thHabit.textContent = 'Habits';
    trHead.appendChild(thHabit);
    
    const thStreak = document.createElement('th');
    thStreak.textContent = 'Streak';
    trHead.appendChild(thStreak);
    
    for (let d = 1; d <= days; d++) {
        const thDay = document.createElement('th');
        thDay.className = 'day-header';
        if (isToday(year, month, d)) {
            thDay.classList.add('today-col');
        }
        thDay.innerHTML = `<div class="day-number">${d}</div><div class="weekday">${getDayLetter(year, month, d)}</div>`;
        trHead.appendChild(thDay);
    }
    
    const thWeekly = document.createElement('th');
    thWeekly.textContent = 'Weekly %';
    trHead.appendChild(thWeekly);
    
    const thMonthly = document.createElement('th');
    thMonthly.textContent = 'Monthly %';
    trHead.appendChild(thMonthly);
    
    table.appendChild(trHead);
    
    const trDaily = document.createElement('tr');
    trDaily.className = 'daily-done-row';
    const tdDailyLabel = document.createElement('td');
    tdDailyLabel.textContent = 'Daily Done %';
    tdDailyLabel.className = 'habit-name-col';
    trDaily.appendChild(tdDailyLabel);
    
    trDaily.appendChild(document.createElement('td'));
    
    for (let d = 1; d <= days; d++) {
        const isTdy = isToday(year, month, d);
        if (isFutureDay(year, month, d)) {
             const tdPercent = document.createElement('td');
             if (isTdy) tdPercent.classList.add('today-col');
             tdPercent.textContent = '-';
             trDaily.appendChild(tdPercent);
        } else {
             const p = dailyPercent(year, month, d);
             trDaily.appendChild(createPercentCell(p, isTdy));
        }
    }
    trDaily.appendChild(document.createElement('td'));
    trDaily.appendChild(document.createElement('td'));
    table.appendChild(trDaily);
    
    state.habits.forEach((habit, index) => {
        const tr = document.createElement('tr');
        
        const tdName = document.createElement('td');
        tdName.className = 'habit-name-col';
        
        const nameWrapper = document.createElement('div');
        nameWrapper.className = 'habit-name-wrapper';
        
        const spanName = document.createElement('span');
        spanName.className = 'habit-name-text';
        spanName.textContent = habit.name;
        spanName.addEventListener('dblclick', () => {
            const newName = prompt("Rename habit:", habit.name);
            if (newName !== null) {
                renameHabit(habit.id, newName);
            }
        });
        
        const btnDelete = document.createElement('button');
        btnDelete.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
        btnDelete.className = 'delete-btn';
        btnDelete.title = "Delete Habit";
        btnDelete.addEventListener('click', () => {
            if (confirm("Delete this habit?")) {
                deleteHabit(habit.id);
            }
        });
        
        nameWrapper.appendChild(spanName);
        nameWrapper.appendChild(btnDelete);
        tdName.appendChild(nameWrapper);
        tr.appendChild(tdName);
        
        const tdStreak = document.createElement('td');
        tdStreak.innerHTML = `🔥 ${calculateHabitStreak(habit.id)}`;
        tdStreak.style.fontWeight = 'bold';
        tdStreak.style.color = 'var(--color-warn)';
        tdStreak.style.fontSize = '0.9rem';
        tr.appendChild(tdStreak);
        
        const allHabitKeys = Object.keys(state.ticks).filter(k => k.startsWith(habit.id + '-'));
        const firstTickDate = allHabitKeys.length > 0 ? allHabitKeys.sort()[0].split('-').slice(1).join('-') : null;
        
        for (let d = 1; d <= days; d++) {
            const td = document.createElement('td');
            const dateString = formatDateString(year, month, d);
            const isTicked = state.ticks[`${habit.id}-${dateString}`];
            const future = isFutureDay(year, month, d);
            const past = isPastDay(year, month, d);
            const beforeFirstTick = firstTickDate && dateString < firstTickDate;
            
            if (isToday(year, month, d)) td.classList.add('today-col');
            
            if (isTicked) {
                td.classList.add('ticked');
            } else if (beforeFirstTick) {
                td.classList.add('before-first-tick');
            } else if (past) {
                td.classList.add('unticked-past');
            } else if (future) {
                td.classList.add('future');
            }
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = !!isTicked;
            checkbox.setAttribute('aria-label', `${habit.name} on ${dateString}`);
            
            if (future) {
                checkbox.disabled = true;
            } else {
                checkbox.addEventListener('change', () => toggleTick(habit.id, dateString));
            }
            
            td.appendChild(checkbox);
            tr.appendChild(td);
        }
        
        const today = new Date();
        const wkP = weeklyPercent(habit.id, today.getFullYear(), today.getMonth(), today.getDate());
        tr.appendChild(createPercentCell(wkP, false));
        
        const moP = monthlyPercent(habit.id, year, month);
        tr.appendChild(createPercentCell(moP, false));
        
        table.appendChild(tr);
    });

    setTimeout(() => {
        const todayCol = document.querySelector('.today-col');
        if (todayCol) {
            todayCol.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, 100);
}

// --- Event Listeners ---
document.getElementById('prev-month').addEventListener('click', () => {
    currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
    render();
});

document.getElementById('next-month').addEventListener('click', () => {
    currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
    render();
});

document.getElementById('add-habit-btn').addEventListener('click', () => {
    const input = document.getElementById('new-habit-input');
    if (addHabit(input.value)) {
        input.value = '';
    }
});

document.getElementById('new-habit-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const input = document.getElementById('new-habit-input');
        if (addHabit(input.value)) {
            input.value = '';
        }
    }
});

// --- Initialization ---
initTheme();
loadData();
render();

// --- Data Export / Import ---
document.getElementById('export-btn').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "habit_tracker_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedData = JSON.parse(event.target.result);
            if (importedData && importedData.habits && importedData.ticks) {
                state = importedData;
                saveData();
                render();
                alert('Data imported successfully!');
            } else {
                alert('Invalid backup file format.');
            }
        } catch(err) {
            alert('Error parsing the file.');
        }
    };
    reader.readAsText(file);
});

function calculateHabitStreak(habitId) {
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    let dateToCheck = new Date(currentDate);
    
    while (true) {
        const dateString = formatDateString(dateToCheck.getFullYear(), dateToCheck.getMonth(), dateToCheck.getDate());
        const hasTick = !!state.ticks[`${habitId}-${dateString}`];
        
        if (hasTick) {
            streak++;
            dateToCheck.setDate(dateToCheck.getDate() - 1);
        } else {
            if (dateToCheck.getTime() === currentDate.getTime()) {
                dateToCheck.setDate(dateToCheck.getDate() - 1);
            } else {
                break;
            }
        }
    }
    return streak;
}

// --- Smart Sort ---
document.getElementById('sort-btn').addEventListener('click', () => {
    state.habits.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;
        for (let key in state.ticks) {
            if (state.ticks[key]) {
                if (key.startsWith(a.id + '-')) scoreA++;
                if (key.startsWith(b.id + '-')) scoreB++;
            }
        }
        return scoreB - scoreA;
    });
    saveData();
    render();
});

let progressChart = null;
function renderChart() {
    const ctx = document.getElementById('progress-chart');
    if (!ctx) return;
    
    const labels = [];
    const data = [];
    
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(`${d.getMonth()+1}/${d.getDate()}`);
        
        const y = d.getFullYear();
        const m = d.getMonth();
        const day = d.getDate();
        
        data.push(dailyPercent(y, m, day));
    }
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#e6eae7' : '#1f2a24';
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    
    if (progressChart) {
        progressChart.destroy();
    }
    
    progressChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Completion %',
                data: data,
                borderColor: '#8e44ad',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: textColor } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                }
            }
        }
    });
}

const originalRender = render;
render = function() {
    originalRender();
    if(typeof renderChart === 'function') renderChart();
};

const originalSetTheme = setTheme;
setTheme = function(theme) {
    originalSetTheme(theme);
    if(typeof renderChart === 'function') renderChart();
    applyCustomBackground();
};

function applyCustomBackground() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark && state.bgDark) {
        document.body.style.backgroundImage = `url(${state.bgDark})`;
    } else if (!isDark && state.bgLight) {
        document.body.style.backgroundImage = `url(${state.bgLight})`;
    } else {
        document.body.style.backgroundImage = ''; // fallback to css default
    }
}

// Ensure background is applied on load
const originalLoadData = loadData;
loadData = function() {
    originalLoadData();
    applyCustomBackground();
};
// Trigger it immediately in case it already loaded
applyCustomBackground();

// --- Background Upload & Compression ---
document.getElementById('bg-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_SIZE = 1920;

            if (width > height && width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
            } else if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6); // Compress to save localStorage space

            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                state.bgDark = compressedBase64;
            } else {
                state.bgLight = compressedBase64;
            }
            saveData();
            applyCustomBackground();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// --- Hunter Leveling System ---
const HUNTER_RANKS = [
    { name: 'E-Rank', xp: 0, color: '#8c8c8c' },
    { name: 'D-Rank', xp: 100, color: '#4a90e2' },
    { name: 'C-Rank', xp: 500, color: '#27ae60' },
    { name: 'B-Rank', xp: 1500, color: '#f39c12' },
    { name: 'A-Rank', xp: 3500, color: '#e74c3c' },
    { name: 'S-Rank', xp: 7500, color: '#f1c40f' },
    { name: 'National Level', xp: 15000, color: '#e056fd' },
    { name: 'Shadow Monarch', xp: 30000, color: '#8e44ad' }
];

function updateHunterSystem() {
    // Calculate total XP (10 XP per tick)
    let totalTicks = 0;
    for (let key in state.ticks) {
        if (state.ticks[key]) totalTicks++;
    }
    const currentXP = totalTicks * 10;
    
    // Determine Rank
    let currentRank = HUNTER_RANKS[0];
    let nextRank = null;
    
    for (let i = 0; i < HUNTER_RANKS.length; i++) {
        if (currentXP >= HUNTER_RANKS[i].xp) {
            currentRank = HUNTER_RANKS[i];
            nextRank = HUNTER_RANKS[i+1] || null;
        }
    }
    
    // Update UI
    const rankEl = document.getElementById('hunter-rank');
    const xpTextEl = document.getElementById('hunter-xp-text');
    const nextRankEl = document.getElementById('hunter-next-rank');
    const xpFillEl = document.getElementById('hunter-xp-fill');
    
    rankEl.textContent = `${currentRank.name} HUNTER`;
    rankEl.style.color = currentRank.color;
    rankEl.style.textShadow = `0 0 15px ${currentRank.color}80`;
    
    xpTextEl.textContent = `${currentXP} XP`;
    
    if (nextRank) {
        nextRankEl.textContent = `Next: ${nextRank.name} (${nextRank.xp} XP)`;
        
        // Calculate percentage for progress bar relative to current rank tier
        const rankXpRange = nextRank.xp - currentRank.xp;
        const xpIntoRank = currentXP - currentRank.xp;
        const percentage = Math.min(100, Math.max(0, (xpIntoRank / rankXpRange) * 100));
        
        xpFillEl.style.width = `${percentage}%`;
        xpFillEl.style.background = `linear-gradient(90deg, ${currentRank.color}, ${nextRank.color})`;
        xpFillEl.style.boxShadow = `0 0 10px ${currentRank.color}80`;
    } else {
        nextRankEl.textContent = 'MAX LEVEL REACHED';
        xpFillEl.style.width = '100%';
        xpFillEl.style.background = `linear-gradient(90deg, ${currentRank.color}, #000)`;
    }
}

// Hook into render to update hunter system whenever state changes
const originalRender2 = render;
render = function() {
    originalRender2();
    updateHunterSystem();
};

// Initial update
updateHunterSystem();

// --- Chidori Effect ---


