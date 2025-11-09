const API_BASE = 'http://localhost:3000/api';
let currentToken = null;
let charts = {};

// Gestion de l'état de l'application
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
    updateNavigation();
}

function updateNavigation() {
    const navButtons = document.getElementById('navButtons');
    const currentPage = document.querySelector('.page.active').id;

    navButtons.innerHTML = '';

    if (currentToken) {
        navButtons.innerHTML = `
            <button class="btn btn-secondary" onclick="showPage('dashboardPage')">Dashboard</button>
            <button class="btn btn-secondary" onclick="showPage('homePage')">Accueil</button>
            <button class="btn btn-primary" onclick="logout()">Déconnexion</button>
        `;
        if (currentPage === 'homePage') {
            showPage('dashboardPage');
        }
    } else {
        navButtons.innerHTML = `
            <button class="btn btn-secondary" onclick="showPage('homePage')">Accueil</button>
            <button class="btn btn-primary" onclick="showLogin()">Se connecter</button>
        `;
    }
}

function showLogin() {
    showPage('loginPage');
}

// Authentification
async function login(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const statusEl = document.getElementById('loginStatus');

    statusEl.innerHTML = '<div class="status-message loading">Connexion en cours...</div>';

    try {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            setSecureToken(data.access_token);
            statusEl.innerHTML = '<div class="status-message success">Connexion réussie!</div>';
            setTimeout(() => {
                showPage('dashboardPage');
                loadDashboard();
            }, 1000);
        } else {
            statusEl.innerHTML = '<div class="status-message error">Identifiants incorrects</div>';
        }
    } catch (error) {
        statusEl.innerHTML = '<div class="status-message error">Erreur de connexion</div>';
    }
}

function logout() {
    currentToken = null;
    localStorage.removeItem('eyesight_token');
    showPage('homePage');
}

// Mise à jour base de données
async function updateDatabase() {
    const statusEl = document.getElementById('updateStatus');
    statusEl.innerHTML = '<div class="status-message loading">Mise à jour en cours...</div>';

    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        const response = await fetch(`${API_BASE}/activities/update_db`, {
            method: 'POST',
            headers: headers
        });

        const data = await response.json();

        if (response.ok) {
            statusEl.innerHTML = '<div class="status-message success">Base de données mise à jour!</div>';
        } else {
            statusEl.innerHTML = '<div class="status-message error">Erreur lors de la mise à jour</div>';
        }
    } catch (error) {
        statusEl.innerHTML = '<div class="status-message error">Erreur de connexion</div>';
    }
}

async function updateStreams() {
    const statusEl = document.getElementById('updateStatus');
    statusEl.innerHTML = '<div class="status-message loading">Mise à jour des streams...</div>';

    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        const response = await fetch(`${API_BASE}/activities/update_streams`, {
            method: 'POST',
            headers: headers
        });

        const data = await response.json();

        if (response.ok) {
            statusEl.innerHTML = '<div class="status-message success">Streams mis à jour!</div>';
        } else {
            statusEl.innerHTML = '<div class="status-message error">Erreur lors de la mise à jour</div>';
        }
    } catch (error) {
        statusEl.innerHTML = '<div class="status-message error">Erreur de connexion</div>';
    }
}

// Utilitaires API
function getAuthHeaders() {
    if (!currentToken || isTokenExpired()) {
        return null;
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
    };
}

function isTokenExpired() {
    if (!currentToken) return true;
    try {
        const payload = JSON.parse(atob(currentToken.split('.')[1]));
        return payload.exp * 1000 < Date.now();
    } catch {
        return true;
    }
}

function setSecureToken(token) {
    currentToken = token;
    localStorage.setItem('eyesight_token', token);
}

function validateToken() {
    const token = localStorage.getItem('eyesight_token');
    if (!token || isTokenExpired()) {
        logout();
        return false;
    }
    currentToken = token;
    return true;
}

// Chargement du dashboard
async function loadDashboard() {
    await loadKPIsWithFilter();
    await loadLastActivity();
    await loadAnalytics();
}

// Variables globales pour les analyses
let currentWeekOffset = 0;
let currentWeeklyOffset = 0;

// Chargement des analyses
async function loadAnalytics() {
    await loadDailyHours();
    await loadWeeklyHours();
    await loadWeeklyDistance();
    loadGoals();
    await updateGoalsProgress();
}

async function loadKPIs() {
    try {
        const response = await fetch(`${API_BASE}/kpi/`, {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            displayKPIs(data.kpis);
        }
    } catch (error) {
        console.error('Erreur chargement KPIs:', error);
    }
}

async function loadKPIsWithFilter() {
    const year = document.getElementById('yearFilter').value;

    let query = '';
    if (year) {
        query = `?start_date=${year}-01-01&end_date=${year}-12-31`;
    }

    try {
        const response = await fetch(`${API_BASE}/kpi/${query}`, {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            displayKPIs(data.kpis);
        }
    } catch (error) {
        console.error('Erreur chargement KPIs filtrés :', error);
    }
}


function displayKPIs(kpis) {
    const container = document.getElementById('kpiContainer');
    container.innerHTML = '';

    const kpiLabels = {
        total_km_run: 'Km Run',
        total_km_trail: 'Km Trail',
        total_km_run_trail: 'Km Run + Trail',
        total_km_bike: 'Km Bike',
        total_km_swim: 'Km Swim',
        total_hours: 'Heures totales',
        total_dplus_run: 'D+ Run',
        total_dplus_trail: 'D+ Trail',
        total_dplus_run_trail: 'D+ Run + Trail',
        total_dplus_bike: 'D+ Bike'
    };

    const formatNumber = (num) => {
        if (Number.isInteger(num)) {
            return new Intl.NumberFormat('fr-FR').format(num);
        } else {
            return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(num);
        }
    };

    // Afficher toutes les KPI sauf "nombre d'activités par sport"
    Object.entries(kpis).forEach(([key, value]) => {
        if (key === "nombre d'activités par sport") return; // skip ici

        const kpiCard = document.createElement('div');
        kpiCard.className = 'kpi-card';
        let displayValue = value;

        if (typeof value === 'number') {
            displayValue = formatNumber(value);
        }

        kpiCard.innerHTML = `
            <div class="kpi-value">${displayValue}</div>
            <div class="kpi-label">${kpiLabels[key] || key.replace(/_/g, ' ')}</div>
        `;
        container.appendChild(kpiCard);
    });

    // ==========================
    // Graphique horizontal : nombre d'activités par sport
    // ==========================
    if (kpis["nombre d'activités par sport"]) {
        const chartContainer = document.getElementById('activityCountChartContainer');
        chartContainer.innerHTML = '';

        if (charts.activityCount) {
            charts.activityCount.destroy();
        }

        const canvas = document.createElement('canvas');
        chartContainer.appendChild(canvas);

        const value = kpis["nombre d'activités par sport"];
        const sports = ["Run", "Bike", "Trail", "WeightTraining", "Hike", "Swim"];
        const labels = [];
        const counts = [];

        sports.forEach(sport => {
            if (value[sport] !== undefined) {
                labels.push(sport);
                counts.push(value[sport]);
            }
        });

        charts.activityCount = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Nombre d\'activités',
                    data: counts,
                    backgroundColor: '#667eea',
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { display: false },
                        ticks: {
                            callback: function(val) {
                                return new Intl.NumberFormat('fr-FR').format(val);
                            }
                        }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { mirror: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return new Intl.NumberFormat('fr-FR').format(context.raw);
                            }
                        }
                    }
                }
            }
        });
    }
}





// Chargement de la dernière activité
async function loadLastActivity(sportType = null) {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        // Si sportType est vide ou null, ne pas ajouter le paramètre (pour obtenir la dernière activité tous sports confondus)
        const url = sportType
            ? `${API_BASE}/activities/last_activity?sport_type=${encodeURIComponent(sportType)}`
            : `${API_BASE}/activities/last_activity`;

        const response = await fetch(url, {
            headers: headers
        });

        if (response.ok) {
            const data = await response.json();
            if (data.message) {
                displayNoActivityMessage(data.message);
            } else {
                displayLastActivity(data);
                await loadActivityTrace(data);
                await loadActivityElevation(sportType);
            }
        }
    } catch (error) {
        console.error('Erreur chargement dernière activité:', error);
    }
}

async function loadLastActivityWithFilter() {
    const sportType = document.getElementById('sportFilter').value;
    // Si sportType est une chaîne vide, passer null pour obtenir la dernière activité tous sports confondus
    await loadLastActivity(sportType || null);
}

function displayNoActivityMessage(message) {
    const container = document.getElementById('lastActivityInfo');
    container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #666;">
            <p>${message}</p>
        </div>
    `;

    // Vider les cartes et graphiques
    document.getElementById('lastActivityMapInteractive').innerHTML = '';
    document.getElementById('lastActivityMapStatic').innerHTML = '';
    clearElevationChart();
}

function displayLastActivity(activity) {
    const container = document.getElementById('lastActivityInfo');

    const date = new Date(activity.date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    container.innerHTML = `
        <div class="activity-header">
            <div class="activity-title">${activity.name || 'Activité'}</div>
            <div class="activity-date">${date}</div>
        </div>

        <div class="activity-info">
            <div class="activity-stat">
                <div class="activity-stat-value">${activity.distance_km.toFixed(2)} km</div>
                <div class="activity-stat-label">Distance</div>
            </div>
            <div class="activity-stat">
                <div class="activity-stat-value">${activity.duree_hms}</div>
                <div class="activity-stat-label">Temps</div>
            </div>
            <div class="activity-stat">
                <div class="activity-stat-value">${Math.round(activity.denivele_m || 0)} m</div>
                <div class="activity-stat-label">Dénivelé+</div>
            </div>
            <div class="activity-stat">
                <div class="activity-stat-value">${activity.vitesse_kmh.toFixed(1)} km/h</div>
                <div class="activity-stat-label">Vitesse moy.</div>
            </div>
            <div class="activity-stat">
                <div class="activity-stat-value">${activity.allure_min_per_km}</div>
                <div class="activity-stat-label">Allure</div>
            </div>
        </div>
    `;

    const coords = activity.polyline_coords || [];
    if (coords.length === 0) return;

    initializeInteractiveMap(coords);
    initializeStaticMap(coords);
}

function initializeInteractiveMap(coords) {
    if (!mapInteractive) {
        mapInteractive = L.map('lastActivityMapInteractive', {
            zoomControl: true,
            attributionControl: false
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        }).addTo(mapInteractive);
    }

    if (polylineInteractive) {
        mapInteractive.removeLayer(polylineInteractive);
    }

    polylineInteractive = L.polyline(coords, {
        color: '#FF5733',
        weight: 4,
        opacity: 0.9,
        lineJoin: 'round'
    }).addTo(mapInteractive);

    mapInteractive.fitBounds(polylineInteractive.getBounds(), { padding: [20, 20] });
}

function initializeStaticMap(coords) {
    if (!mapStatic) {
        mapStatic = L.map('lastActivityMapStatic', {
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            tap: false
        });
    }

    if (polylineStatic) {
        mapStatic.removeLayer(polylineStatic);
    }

    polylineStatic = L.polyline(coords, {
        color: '#352f99ff',
        weight: 3,
        opacity: 1,
        lineJoin: 'round'
    }).addTo(mapStatic);

    mapStatic.fitBounds(polylineStatic.getBounds(), { padding: [20, 20] });
}


// Chargement de la trace d'activité
async function loadActivityTrace(activity) {
    try {
        // Utiliser directement les coords de l'activité
        if (activity.coords && activity.coords.length > 0) {
            displayActivityTrace(activity.coords);
        } else {
            document.getElementById('activityMap').innerHTML =
                '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">Aucune donnée GPS disponible</div>';
        }
    } catch (error) {
        console.error('Erreur chargement trace:', error);
        document.getElementById('activityMap').innerHTML =
            '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #dc3545;">Erreur chargement trace</div>';
    }
}

function displayActivityTrace(coords) {
    const mapContainer = document.getElementById('activityMap');

    if (!coords || coords.length === 0) {
        if (mapContainer) {
            mapContainer.innerHTML =
                '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">Aucune coordonnée GPS disponible</div>';
        }
        return;
    }

    // Les coords sont déjà au format [lat, lon]
    const validPoints = coords.filter(coord =>
        coord[0] !== null && coord[1] !== null &&
        !isNaN(coord[0]) && !isNaN(coord[1])
    );

    if (validPoints.length === 0) {
        if (mapContainer) {
            mapContainer.innerHTML =
                '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">Aucune coordonnée GPS valide</div>';
        }
        return;
    }

    // Calculer les limites
    const lats = validPoints.map(p => p[0]);
    const lons = validPoints.map(p => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    // Dimensions du conteneur
    const width = 400;
    const height = 400;
    const padding = 20;

    // Fonction de projection
    const latRange = maxLat - minLat;
    const lonRange = maxLon - minLon;

    const scaleX = (width - 2 * padding) / (lonRange || 0.001);
    const scaleY = (height - 2 * padding) / (latRange || 0.001);
    const scale = Math.min(scaleX, scaleY);

    const projectX = lon => padding + (lon - minLon) * scale;
    const projectY = lat => height - padding - (lat - minLat) * scale;

    // Créer le SVG avec la polyline
    const pathPoints = validPoints.map(coord =>
        `${projectX(coord[1])},${projectY(coord[0])}`
    ).join(' L ');

    if (mapContainer) {
        mapContainer.innerHTML = `
            <svg class="polyline-svg" viewBox="0 0 ${width} ${height}">
                <rect width="100%" height="100%" fill="#f8f9fa"/>
                <polyline
                    points="M ${pathPoints}"
                    fill="none"
                    stroke="#667eea"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
                <circle
                    cx="${projectX(validPoints[0][1])}"
                    cy="${projectY(validPoints[0][0])}"
                    r="6"
                    fill="#28a745"
                    stroke="#fff"
                    stroke-width="2"
                />
                <circle
                    cx="${projectX(validPoints[validPoints.length - 1][1])}"
                    cy="${projectY(validPoints[validPoints.length - 1][0])}"
                    r="6"
                    fill="#dc3545"
                    stroke="#fff"
                    stroke-width="2"
                />
            </svg>
        `;
    }
}

let mapInteractive, mapStatic;
let polylineInteractive, polylineStatic;




async function loadActivityElevation(sportType = null) {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        // Si sportType est vide ou null, ne pas ajouter le paramètre
        const url = sportType
            ? `${API_BASE}/activities/last_activity_streams?sport_type=${encodeURIComponent(sportType)}`
            : `${API_BASE}/activities/last_activity_streams`;

        const response = await fetch(url, {
            headers: headers
        });

        if (!response.ok) {
            console.log('Pas de données d\'élévation disponibles');
            clearElevationChart();
            return;
        }

        const data = await response.json();

        if (!data.streams || data.streams.length === 0) {
            console.log('Aucun stream d\'élévation trouvé');
            clearElevationChart();
            return;
        }

        displayElevationProfile(data.streams);

    } catch (error) {
        console.error('Erreur chargement élévation:', error);
        clearElevationChart();
    }
}

function clearElevationChart() {
    const canvas = document.getElementById('elevationChart');
    if (canvas && charts.elevation) {
        charts.elevation.destroy();
        charts.elevation = null;
    }

    const container = document.getElementById('elevationContainer');
    if (container) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Aucune donnée d\'élévation disponible</p>';
    }
}

// -----------------------------
// Affichage du graphique de dénivelé
// -----------------------------
function displayElevationProfile(streams) {
    const canvas = document.getElementById('elevationChart');
    if (!canvas) {
        console.error('Canvas elevationChart non trouvé');
        return;
    }

    if (charts.elevation) {
        charts.elevation.destroy();
    }

    // Rétablir le canvas s'il a été supprimé
    const container = document.getElementById('elevationContainer');
    if (container && !container.querySelector('#elevationChart')) {
        container.innerHTML = '<canvas id="elevationChart" width="600" height="200"></canvas>';
        const newCanvas = document.getElementById('elevationChart');
        if (!newCanvas) return;
    }

    const ctx = canvas.getContext('2d');
    const distances = streams.map(s => s.distance_m / 1000);
    const elevations = streams.map(s => s.altitude);

    console.log('Données élévation:', { distances: distances.length, elevations: elevations.length });

    charts.elevation = new Chart(ctx, {
        type: 'line',
        data: {
            labels: distances,
            datasets: [{
                label: 'Altitude (m)',
                data: elevations,
                borderColor: '#7B68EE',
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                backgroundColor: 'rgba(123,104,238,0.2)',
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: 'Distance (km)' },
                    grid: { display: false },
                    ticks: {
                        callback: function(value) {
                            const total = distances[distances.length - 1];
                            if (!total) return '';

                            const mid = total / 2;
                            const labelValue = this.getLabelForValue(value);

                            if (labelValue === 0) return '0';
                            if (Math.abs(labelValue - mid) < total * 0.1) return mid.toFixed(1);
                            if (Math.abs(labelValue - total) < total * 0.1) return total.toFixed(1);
                            return '';
                        }
                    }
                },
                y: {
                    title: { display: true, text: 'Altitude (m)' },
                    grid: { display: false },
                    beginAtZero: false
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y.toFixed(0)}m à ${context.parsed.x.toFixed(2)}km`;
                        }
                    }
                }
            }
        }
    });
}



// Analyses hebdomadaires

// 1. Graphique des heures par jour de la semaine
async function loadDailyHours() {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        const url = `${API_BASE}/plot/daily_hours_bar?week_offset=${currentWeekOffset}`;
        const response = await fetch(url, { headers });

        if (response.ok) {
            const data = await response.json();
            displayDailyHours(data);
            updateWeekLabel(data);
        }
    } catch (error) {
        console.error('Erreur chargement heures quotidiennes:', error);
    }
}

function displayDailyHours(data) {
    const canvas = document.getElementById('dailyHoursChart');
    if (!canvas) return;

    if (charts.dailyHours) {
        charts.dailyHours.destroy();
    }

    const ctx = canvas.getContext('2d');

    // Utiliser les données formatées du backend
    const labels = data.labels || ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

    // Palette de couleurs pour les différents sports
    const sportColors = {
        'Run': '#FF6B6B',
        'Trail': '#4ECDC4',
        'Bike': '#45B7D1',
        'Swim': '#96CEB4',
        'WeightTraining': '#FFEAA7',
        'Hike': '#DDA0DD'
    };

    // Préparer les datasets pour chaque sport avec conversion en heures
    const datasets = data.datasets.map(dataset => ({
        label: dataset.label,
        data: dataset.data.map(minutes => minutes / 60), // Convertir les minutes en heures
        backgroundColor: sportColors[dataset.label] || '#667eea',
        borderColor: sportColors[dataset.label] || '#667eea',
        borderWidth: 1
    }));

    charts.dailyHours = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false }
                },
                y: {
                    stacked: true,
                    title: { display: true, text: 'Heures' },
                    grid: { display: false },
                    beginAtZero: true,
                    max: 8,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return value.toFixed(1) + 'h';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} heures`;
                        }
                    }
                }
            }
        }
    });
}

function changeWeekOffset(delta) {
    if (currentWeekOffset + delta >= 0) {
        currentWeekOffset += delta;
        loadDailyHours();
    }
}

function updateWeekLabel(weekInfo) {
    const label = document.getElementById('currentWeekLabel');
    if (currentWeekOffset === 0) {
        label.textContent = '';
    } else {
        label.textContent = `Il y a ${currentWeekOffset} semaine${currentWeekOffset > 1 ? 's' : ''}`;
    }

    // Afficher la semaine si disponible
    //if (weekInfo && weekInfo.week) {
      //  label.textContent += ` (${weekInfo.week})`;
    //}
}

// 2. Graphique des heures par semaine avec navigation
async function loadWeeklyHours() {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        const weeks = 10 + Math.abs(currentWeeklyOffset);
        const url = `${API_BASE}/plot/weekly_bar?value_col=moving_time&weeks=${weeks}`;
        const response = await fetch(url, { headers });

        if (response.ok) {
            const data = await response.json();
            displayWeeklyHours(data);
            updateWeeklyLabel();
        }
    } catch (error) {
        console.error('Erreur chargement heures hebdomadaires:', error);
    }
}

function displayWeeklyHours(data) {
    const canvas = document.getElementById('weeklyHoursChart');
    if (!canvas) return;

    if (charts.weeklyHours) {
        charts.weeklyHours.destroy();
    }

    const ctx = canvas.getContext('2d');

    // Prendre les 10 dernières semaines (les données arrivent du plus ancien au plus récent)
    // Si offset = 0 : prendre les 10 dernières (semaine courante à droite)
    // Si offset = 1 : sauter la dernière et prendre les 10 précédentes
    const totalWeeks = data.length;
    const endIndex = totalWeeks - currentWeeklyOffset;
    const startIndex = Math.max(0, endIndex - 10);
    const weekData = data.slice(startIndex, endIndex);

    // Créer les labels avec les dates au format DD/MM/YYYY
    const labels = weekData.map(d => {
        const date = new Date(d.period);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    });

    // Convertir moving_time (minutes) en heures
    const hours = weekData.map(d => d.moving_time / 60);

    charts.weeklyHours = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Heures',
                data: hours,
                backgroundColor: '#667eea',
                borderColor: '#667eea',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    title: { display: true, text: 'Heures' },
                    grid: { display: false },
                    beginAtZero: true,
                    max: 15,
                    ticks: {
                        stepSize: 2,
                        callback: function(value) {
                            return value.toFixed(1) + 'h';
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y.toFixed(1)} heures`;
                        }
                    }
                }
            }
        }
    });
}

// Fonction utilitaire pour obtenir le numéro de semaine
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

function changeWeeklyView(delta) {
    // Navigation semaine par semaine (delta de 1 ou -1)
    currentWeeklyOffset = Math.max(0, currentWeeklyOffset + delta);
    loadWeeklyHours();
    loadWeeklyDistance(); // Mettre à jour aussi le graphique des distances
}

function updateWeeklyLabel() {
    const label = document.getElementById('weeklyRangeLabel');
    if (currentWeeklyOffset === 0) {
        label.textContent = '';
    } else if (currentWeeklyOffset === 1) {
        label.textContent = 'Il y a 1 semaine';
    } else {
        label.textContent = `Il y a ${currentWeeklyOffset} semaines`;
    }
}

// 3. Graphique des kilomètres par semaine avec filtre
async function loadWeeklyDistance() {
    const headers = getAuthHeaders();
    if (!headers) return;

    const sportFilter = document.getElementById('distanceSportFilter').value;
    const sportTypes = sportFilter.split(',');

    try {
        const weeks = 10 + Math.abs(currentWeeklyOffset);
        let url = `${API_BASE}/plot/weekly_bar?value_col=distance&weeks=${weeks}`;
        if (sportTypes.length > 0) {
            const sportParams = sportTypes.map(s => `sport_types=${encodeURIComponent(s)}`).join('&');
            url += `&${sportParams}`;
        }

        const response = await fetch(url, { headers });

        if (response.ok) {
            const data = await response.json();
            displayWeeklyDistance(data);
        }
    } catch (error) {
        console.error('Erreur chargement distance hebdomadaire:', error);
    }
}

function displayWeeklyDistance(data) {
    const canvas = document.getElementById('weeklyDistanceChart');
    if (!canvas) return;

    if (charts.weeklyDistance) {
        charts.weeklyDistance.destroy();
    }

    const ctx = canvas.getContext('2d');

    // Prendre les 10 dernières semaines (les données arrivent du plus ancien au plus récent)
    // Si offset = 0 : prendre les 10 dernières (semaine courante à droite)
    // Si offset = 1 : sauter la dernière et prendre les 10 précédentes
    const totalWeeks = data.length;
    const endIndex = totalWeeks - currentWeeklyOffset;
    const startIndex = Math.max(0, endIndex - 10);
    const weekData = data.slice(startIndex, endIndex);

    // Mettre à jour les statistiques de la dernière semaine affichée (la plus récente)
    if (weekData.length > 0) {
        const lastWeek = weekData[weekData.length - 1];
        const distance = (lastWeek.distance || 0).toFixed(1);
        const elevation = Math.round(lastWeek.total_elevation_gain || 0);
        const time = ((lastWeek.moving_time || 0) / 60).toFixed(1);

        document.getElementById('statDistance').textContent = distance;
        document.getElementById('statElevation').textContent = elevation;
        document.getElementById('statTime').textContent = time;
    } else {
        document.getElementById('statDistance').textContent = '-';
        document.getElementById('statElevation').textContent = '-';
        document.getElementById('statTime').textContent = '-';
    }

    // Créer les labels avec les dates au format DD/MM/YYYY
    const labels = weekData.map(d => {
        const date = new Date(d.period);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    });

    // Utiliser directement la distance (déjà en km)
    const distances = weekData.map(d => d.distance);

    // Calculer l'échelle dynamique
    const maxDistance = Math.max(...distances, 0);
    const suggestedMax = maxDistance > 0 ? Math.ceil(maxDistance * 1.1 / 25) * 25 : 50; // Arrondir au multiple de 25 supérieur avec 10% de marge
    const stepSize = Math.max(Math.ceil(suggestedMax / 8 / 5) * 5, 5); // Environ 8 graduations, arrondies au multiple de 5

    charts.weeklyDistance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Distance (km)',
                data: distances,
                borderColor: '#764ba2',
                backgroundColor: 'rgba(118, 75, 162, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { display: false }
                },
                y: {
                    title: { display: true, text: 'Kilomètres' },
                    grid: { display: false },
                    beginAtZero: true,
                    suggestedMax: suggestedMax,
                    ticks: {
                        stepSize: stepSize,
                        callback: function(value) {
                            return value.toFixed(0) + ' km';
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y.toFixed(1)} km`;
                        }
                    }
                }
            }
        }
    });
}

// 4. Gestion des objectifs hebdomadaires
function loadGoals() {
    const goals = JSON.parse(localStorage.getItem('weekly_goals') || '{}');

    document.getElementById('goalRunTrail').value = goals.runTrail || '';
    document.getElementById('goalBike').value = goals.bike || '';
    document.getElementById('goalSwim').value = goals.swim || '';

    // Afficher la semaine courante
    displayCurrentWeek();
}

function displayCurrentWeek() {
    const currentWeekDisplay = document.getElementById('currentWeekDisplay');
    if (!currentWeekDisplay) return;

    // Obtenir le lundi de la semaine courante
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Si dimanche (0), aller à -6, sinon 1 - jour actuel

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);

    // Obtenir le dimanche de la semaine courante
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Formater les dates
    const formatDate = (date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month}`;
    };

    currentWeekDisplay.textContent = `semaine du ${formatDate(monday)} au ${formatDate(sunday)}`;
}

function saveGoals() {
    const goals = {
        runTrail: parseFloat(document.getElementById('goalRunTrail').value) || 0,
        bike: parseFloat(document.getElementById('goalBike').value) || 0,
        swim: parseFloat(document.getElementById('goalSwim').value) || 0
    };

    localStorage.setItem('weekly_goals', JSON.stringify(goals));
    updateGoalsProgress();
}

async function updateGoalsProgress() {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        // Calculer les dates de la semaine courante (lundi à dimanche)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

        const monday = new Date(today);
        monday.setDate(today.getDate() + diffToMonday);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        // Formater les dates pour l'API (YYYY-MM-DD)
        const formatDateForAPI = (date) => {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const startDate = formatDateForAPI(monday);
        const endDate = formatDateForAPI(sunday);

        // Récupérer les données de la semaine courante pour chaque sport
        const responses = await Promise.all([
            fetch(`${API_BASE}/activities/filter_activities?sport_type=Run&start_date=${startDate}`, { headers }),
            fetch(`${API_BASE}/activities/filter_activities?sport_type=Trail&start_date=${startDate}`, { headers }),
            fetch(`${API_BASE}/activities/filter_activities?sport_type=Bike&start_date=${startDate}`, { headers }),
            fetch(`${API_BASE}/activities/filter_activities?sport_type=Swim&start_date=${startDate}`, { headers })
        ]);

        const [runData, trailData, bikeData, swimData] = await Promise.all(
            responses.map(async r => r.ok ? await r.json() : { activities: [] })
        );

        const goals = JSON.parse(localStorage.getItem('weekly_goals') || '{}');

        // Filtrer les activités pour ne garder que celles de la semaine courante (entre lundi et dimanche)
        const filterWeekActivities = (data) => {
            if (!data.activities) return [];
            return data.activities.filter(activity => {
                const activityDate = new Date(activity.start_date);
                return activityDate >= monday && activityDate <= sunday;
            });
        };

        const runActivities = filterWeekActivities(runData);
        const trailActivities = filterWeekActivities(trailData);
        const bikeActivities = filterWeekActivities(bikeData);
        const swimActivities = filterWeekActivities(swimData);

        // Calculer les distances totales pour chaque sport
        const runTrailKm = [...runActivities, ...trailActivities].reduce((total, activity) => total + (activity.distance_km || 0), 0);
        const bikeKm = bikeActivities.reduce((total, activity) => total + (activity.distance_km || 0), 0);
        const swimKm = swimActivities.reduce((total, activity) => total + (activity.distance_km || 0), 0);

        console.log('Distances calculées:', { runTrailKm, bikeKm, swimKm });
        console.log('Objectifs:', goals);

        updateProgressBar('RunTrail', runTrailKm, goals.runTrail || 0);
        updateProgressBar('Bike', bikeKm, goals.bike || 0);
        updateProgressBar('Swim', swimKm, goals.swim || 0);

    } catch (error) {
        console.error('Erreur mise à jour progression:', error);
    }
}

function updateProgressBar(sport, current, goal) {
    const progressFill = document.getElementById(`progress${sport}`);
    const progressText = document.getElementById(`progress${sport}Text`);

    console.log(`updateProgressBar(${sport}):`, { current, goal, progressFill: !!progressFill, progressText: !!progressText });

    if (!progressFill || !progressText) {
        console.warn(`Éléments non trouvés pour ${sport}`);
        return;
    }

    const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;

    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${current.toFixed(1)}/${goal} km`;

    // Changer la couleur selon la progression
    if (percentage >= 100) {
        progressFill.style.background = '#2ECC71'; // Vert
    } else if (percentage >= 75) {
        progressFill.style.background = 'linear-gradient(90deg, #667eea, #764ba2)'; // Gradient normal
    } else if (percentage >= 50) {
        progressFill.style.background = '#F39C12'; // Orange
    } else {
        progressFill.style.background = '#E74C3C'; // Rouge
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    currentToken = localStorage.getItem('eyesight_token');

    if (currentToken && !isTokenExpired()) {
        showPage('dashboardPage');
        loadDashboard();
    } else if (currentToken) {
        logout();
    }

    updateNavigation();
});
