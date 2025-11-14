const API_BASE = 'http://localhost:3000/api';
let currentToken = null;
let charts = {};

// Palette de couleurs HawkSight
const COLORS = {
    charcoal: '#0B0C10',
    steel: '#3A3F47',
    mist: '#F2F2F2',
    amber: '#E8832A',
    amberLight: '#ff9942',
    glacier: '#3DB2E0',
    moss: '#6DAA75'
};

// Configuration globale Chart.js pour le thème sombre
if (typeof Chart !== 'undefined') {
    Chart.defaults.color = COLORS.mist;
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.font.family = "'Inter', sans-serif";
}

// Gestion de l'état de l'application
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
    updateNavigation();

    // Charger les KPI quand on accède à la page Chiffres clés
    if (pageId === 'kpiPage') {
        loadKPIsWithFilter();
    }

    // Charger le calendrier quand on accède à la page Calendrier
    if (pageId === 'calendarPage') {
        loadCalendar();
    }

    // Charger les activités quand on accède à la page Activités
    if (pageId === 'activitiesPage') {
        loadActivities();
    }
}

function updateNavigation() {
    const navButtons = document.getElementById('navButtons');
    const currentPage = document.querySelector('.page.active').id;

    navButtons.innerHTML = '';

    if (currentToken) {
        navButtons.innerHTML = `
            <button class="btn btn-secondary" onclick="showPage('activitiesPage')">Activités</button>
            <button class="btn btn-secondary" onclick="showPage('kpiPage')">Chiffres clés</button>
            <button class="btn btn-secondary" onclick="showPage('calendarPage')">Calendrier</button>
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
    await loadRepartition();
    loadGoals();
    await updateGoalsProgress();
    await updateMonthlySummary();
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

    const kpiConfig = {
        total_km_run: { unit: 'km', label: 'Course à pied' },
        total_km_trail: { unit: 'km', label: 'Trail' },
        total_km_bike: { unit: 'km', label: 'Vélo' },
        total_km_swim: { unit: 'km', label: 'Natation' },
        total_hours: { unit: 'h', label: 'Sport' },
        total_dplus_run_trail: { unit: 'm', label: 'dénivelé en courant' },
        total_dplus_bike: { unit: 'm', label: 'dénivelé à vélo' }
    };

    // Liste des KPIs à afficher (exclure ceux non souhaités)
    const kpisToDisplay = [
        'total_km_run',
        'total_km_trail',
        'total_km_bike',
        'total_km_swim',
        'total_hours',
        'total_dplus_run_trail',
        'total_dplus_bike'
    ];

    const formatNumber = (num) => {
        // Arrondir vers le haut tous les chiffres
        const roundedNum = Math.ceil(num);
        const formatted = new Intl.NumberFormat('fr-FR').format(roundedNum);
        // Remplacer l'espace (séparateur de milliers français) par un point
        return formatted.replace(/\s/g, '.');
    };

    // Afficher uniquement les KPIs sélectionnés
    kpisToDisplay.forEach((key) => {
        if (kpis[key] === undefined || kpis[key] === null) return;

        const kpiCard = document.createElement('div');
        kpiCard.className = 'kpi-card';
        const value = kpis[key];
        const displayValue = formatNumber(value);
        const config = kpiConfig[key];

        kpiCard.innerHTML = `
            <div class="kpi-value">${displayValue} ${config.unit}</div>
            <div class="kpi-label" style="color: rgba(242, 242, 242, 0.6);">${config.label}</div>
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
                    backgroundColor: COLORS.glacier,
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
                <div class="activity-stat-value" style="color: ${COLORS.amber};">${activity.distance_km.toFixed(2)} km</div>
                <div class="activity-stat-label">Distance</div>
            </div>
            <div class="activity-stat">
                <div class="activity-stat-value" style="color: ${COLORS.glacier};">${activity.duree_hms}</div>
                <div class="activity-stat-label">Temps</div>
            </div>
            <div class="activity-stat">
                <div class="activity-stat-value" style="color: ${COLORS.glacier};">${Math.round(activity.denivele_m || 0)} m</div>
                <div class="activity-stat-label">Dénivelé+</div>
            </div>
            <div class="activity-stat">
                <div class="activity-stat-value" style="color: ${COLORS.amber};">${activity.allure_min_per_km} min/km</div>
                <div class="activity-stat-label">Allure</div>
            </div>
            ${activity.bpm_moyen ? `
            <div class="activity-stat">
                <div class="activity-stat-value" style="color: ${COLORS.moss};">${Math.round(activity.bpm_moyen)} bpm</div>
                <div class="activity-stat-label">BPM moyen</div>
            </div>
            ` : ''}
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
        color: COLORS.amber,
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
        color: COLORS.amber,
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
    console.log('loadActivityElevation appelée avec sportType:', sportType);
    const headers = getAuthHeaders();
    if (!headers) {
        console.log('Pas de headers auth');
        return;
    }

    try {
        // Si sportType est vide ou null, ne pas ajouter le paramètre
        const url = sportType
            ? `${API_BASE}/activities/last_activity_streams?sport_type=${encodeURIComponent(sportType)}`
            : `${API_BASE}/activities/last_activity_streams`;

        console.log('Fetching elevation data from:', url);
        const response = await fetch(url, {
            headers: headers
        });

        console.log('Response status:', response.status);
        if (!response.ok) {
            console.log('Pas de données d\'élévation disponibles');
            clearElevationChart();
            return;
        }

        const data = await response.json();
        console.log('Données reçues:', data);

        if (!data.streams || data.streams.length === 0) {
            console.log('Aucun stream d\'élévation trouvé');
            clearElevationChart();
            return;
        }

        console.log('Appel de displayElevationProfile avec', data.streams.length, 'points');
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

function displayElevationProfile(streams) {
    // Rétablir le canvas s'il a été supprimé
    const container = document.getElementById('elevationContainer');
    if (container && !container.querySelector('#elevationChart')) {
        container.innerHTML = '<canvas id="elevationChart" width="600" height="200"></canvas>';
    }

    const canvas = document.getElementById('elevationChart');
    if (!canvas) {
        console.error('Canvas elevationChart non trouvé');
        return;
    }

    if (charts.elevation) {
        charts.elevation.destroy();
    }

    const ctx = canvas.getContext('2d');
    const distances = streams.map(s => s.distance_m / 1000);
    const elevations = streams.map(s => s.altitude);

    // Créer des paires de données {x: distance, y: altitude}
    const dataPoints = distances.map((dist, index) => ({
        x: dist,
        y: elevations[index]
    }));

    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const totalDistance = Math.max(...distances);

    console.log('Données élévation:', {
        totalDistance,
        points: dataPoints.length,
        minElevation,
        maxElevation
    });

    charts.elevation = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Altitude (m)',
                data: dataPoints,
                borderColor: COLORS.glacier,
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                backgroundColor: 'rgba(61, 178, 224, 0.2)',
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Distance (km)' },
                    grid: { display: false },
                    min: 0,
                    max: Math.ceil(totalDistance),
                    ticks: {
                        stepSize: 1,
                        maxRotation: 0,
                        minRotation: 0,
                        callback: function(value) {
                            return Math.round(value);
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
                            return `${context.parsed.y.toFixed(0)} m à ${context.parsed.x.toFixed(2)} km`;
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
            console.log('loadDailyHours - Données reçues:', data);
            displayDailyHours(data);
            updateWeekLabel(data);
        } else {
            console.error('Erreur réponse API:', response.status, response.statusText);
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

    console.log('displayDailyHours - Structure des données:', {
        hasLabels: !!data.labels,
        hasDatasets: !!data.datasets,
        datasetCount: data.datasets?.length || 0
    });

    // Utiliser les données formatées du backend
    const labels = data.labels || ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

    // Palette de couleurs avec nuances de bleu et violet-bleu
    const sportColors = {
        'Run': '#3DB2E0',        // Bleu glacier (charte graphique)
        'Trail': '#1E6A8F',      // Bleu glacier beaucoup plus foncé
        'Bike': '#7B6BC8',       // Violet nuancé bleu
        'Swim': '#8B92A0',       // Gris clair (inchangé)
        'WeightTraining': '#9477D9', // Violet nuancé
        'Hike': '#5A5F6C'        // Gris foncé (inchangé)
    };

    // Si pas de datasets, afficher un graphique vide
    let datasets = [];
    if (data.datasets && data.datasets.length > 0) {
        // Préparer les datasets pour chaque sport avec conversion en heures
        datasets = data.datasets.map(dataset => {
            console.log(`Dataset ${dataset.label}:`, dataset.data);
            const hoursData = dataset.data.map(minutes => {
                const hours = minutes / 60;
                return hours;
            });
            console.log(`Dataset ${dataset.label} en heures:`, hoursData);
            return {
                label: dataset.label,
                data: hoursData,
                backgroundColor: sportColors[dataset.label] || '#667eea',
                borderColor: sportColors[dataset.label] || '#667eea',
                borderWidth: 1
            };
        });
    }

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
                    title: { display: false },
                    grid: { display: false },
                    beginAtZero: true,
                    max: 8,
                    ticks: {
                        stepSize: 2,
                        callback: function(value) {
                            // Afficher uniquement les heures paires (2h, 4h, 6h, 8h), pas le 0h
                            if (value === 0) return '';
                            return Math.round(value) + 'h';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
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

async function updateWeekLabel(weekInfo) {
    const label = document.getElementById('currentWeekLabel');
    if (currentWeekOffset === 0) {
        label.textContent = '';
    } else {
        label.textContent = `Il y a ${currentWeekOffset} semaine${currentWeekOffset > 1 ? 's' : ''}`;
    }

    // Calculer et afficher la plage de dates (lundi - dimanche)
    const today = new Date();
    const thisMonday = today - (today.getDay() === 0 ? 6 : today.getDay() - 1) * 86400000;
    const startWeek = new Date(thisMonday - currentWeekOffset * 7 * 86400000);
    const monday = new Date(startWeek);
    const sunday = new Date(startWeek);
    sunday.setDate(monday.getDate() + 6);

    const formatDate = (date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month}`;
    };

    const rangeLabel = document.getElementById('dailyWeekRange');
    if (rangeLabel) {
        rangeLabel.textContent = `${formatDate(monday)} - ${formatDate(sunday)}`;
    }

    // Mettre à jour les statistiques de la semaine affichée
    await updateWeekStats(monday, sunday);
}

async function updateWeekStats(monday, sunday) {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        // Formater les dates pour l'API (YYYY-MM-DD)
        const formatDateForAPI = (date) => {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const startDate = formatDateForAPI(monday);
        const endDate = formatDateForAPI(sunday);

        // Récupérer les données de la semaine pour chaque sport
        const responses = await Promise.all([
            fetch(`${API_BASE}/activities/filter_activities?sport_type=Run&start_date=${startDate}&end_date=${endDate}`, { headers }),
            fetch(`${API_BASE}/activities/filter_activities?sport_type=Trail&start_date=${startDate}&end_date=${endDate}`, { headers })
        ]);

        const [runData, trailData] = await Promise.all(
            responses.map(async r => r.ok ? await r.json() : { activities: [] })
        );

        // API already filters correctly with start_date and end_date (including Sunday)
        const runActivities = runData.activities || [];
        const trailActivities = trailData.activities || [];

        // Calculer les totaux pour Run + Trail
        const allActivities = [...runActivities, ...trailActivities];

        console.log('updateWeekStats - Activités trouvées:', allActivities.length);
        if (allActivities.length > 0) {
            console.log('Exemple d\'activité:', allActivities[0]);
        }

        // Essayer à la fois distance_km et distance
        const totalDistance = allActivities.reduce((total, activity) => {
            const distance = activity.distance_km || activity.distance || 0;
            return total + distance;
        }, 0);
        const totalElevation = allActivities.reduce((total, activity) => total + (activity.total_elevation_gain || 0), 0);
        const totalTime = allActivities.reduce((total, activity) => total + (activity.moving_time || 0), 0);

        console.log('Totaux calculés:', { totalDistance, totalElevation, totalTime });

        // Mettre à jour l'affichage
        document.getElementById('statDistance').textContent = totalDistance.toFixed(1);
        document.getElementById('statElevation').textContent = Math.round(totalElevation);
        document.getElementById('statTime').textContent = (totalTime / 60).toFixed(1);

    } catch (error) {
        console.error('Erreur mise à jour stats semaine:', error);
    }
}

// 2. Graphique des heures par semaine avec navigation
async function loadWeeklyHours() {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        // Ajouter 1 semaine pour s'assurer que la semaine en cours est incluse
        const weeks = 11 + Math.abs(currentWeeklyOffset);
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

    // Créer les labels avec les dates au format DD/MM
    const labels = weekData.map(d => {
        const date = new Date(d.period);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month}`;
    });

    // Convertir moving_time (minutes) en heures
    const hours = weekData.map(d => d.moving_time / 60);

    // Calculer et afficher la moyenne
    const totalHours = hours.reduce((sum, h) => sum + h, 0);
    const averageHours = hours.length > 0 ? totalHours / hours.length : 0;
    const averageLabel = document.getElementById('weeklyHoursAverage');
    if (averageLabel) {
        averageLabel.textContent = `Moyenne : ${averageHours.toFixed(1)}h/semaine`;
    }

    // Créer un dégradé de couleur orange basé sur le nombre d'heures
    const maxHours = Math.max(...hours, 1); // Éviter division par zéro
    const backgroundColor = hours.map(h => {
        // Calculer l'intensité (0 = clair, 1 = foncé)
        const intensity = h / maxHours;
        // Interpoler entre orange clair (#E8832A) et orange noir charbon (#3A2010)
        const r = Math.round(232 - intensity * 174);  // De 232 à 58
        const g = Math.round(131 - intensity * 99);   // De 131 à 32
        const b = Math.round(42 - intensity * 26);    // De 42 à 16
        return `rgb(${r}, ${g}, ${b})`;
    });

    charts.weeklyHours = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Heures',
                data: hours,
                backgroundColor: backgroundColor,
                borderWidth: 0
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
                    title: { display: false },
                    grid: { display: false },
                    beginAtZero: true,
                    max: 15,
                    ticks: {
                        stepSize: 2,
                        callback: function(value) {
                            return Math.round(value) + 'h';
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
        // Ajouter 1 semaine pour s'assurer que la semaine en cours est incluse
        const weeks = 11 + Math.abs(currentWeeklyOffset);
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

    // Créer les labels avec les dates au format DD/MM
    const labels = weekData.map(d => {
        const date = new Date(d.period);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month}`;
    });

    // Utiliser directement la distance (déjà en km)
    const distances = weekData.map(d => d.distance);

    // Calculer et afficher la moyenne
    const totalDistance = distances.reduce((sum, d) => sum + d, 0);
    const averageDistance = distances.length > 0 ? totalDistance / distances.length : 0;
    const averageLabel = document.getElementById('weeklyDistanceAverage');
    if (averageLabel) {
        averageLabel.textContent = `Moyenne : ${averageDistance.toFixed(1)} km/semaine`;
    }

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
                borderColor: COLORS.amber,
                backgroundColor: 'rgba(232, 131, 42, 0.1)',
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
                    title: { display: false },
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

// 4. Graphique de répartition des activités
async function loadRepartition() {
    const headers = getAuthHeaders();
    if (!headers) return;

    const sportFilter = document.getElementById('repartitionSportFilter').value;
    const weeks = document.getElementById('repartitionWeeksFilter').value;
    const sportTypes = sportFilter.split(',');

    try {
        let url = `${API_BASE}/plot/repartition_run?weeks=${weeks}`;
        if (sportTypes.length > 0) {
            const sportParams = sportTypes.map(s => `sport_type=${encodeURIComponent(s)}`).join('&');
            url += `&${sportParams}`;
        }

        const response = await fetch(url, { headers });

        if (response.ok) {
            const data = await response.json();
            displayRepartition(data);
        }
    } catch (error) {
        console.error('Erreur chargement répartition:', error);
    }
}

function displayRepartition(data) {
    const canvas = document.getElementById('repartitionChart');
    if (!canvas) return;

    if (charts.repartition) {
        charts.repartition.destroy();
    }

    const ctx = canvas.getContext('2d');

    // Couleurs HawkSight par type de sport
    const sportColors = {
        'Run': COLORS.amber,
        'Trail': COLORS.amberLight,
        'Bike': COLORS.glacier,
        'Swim': COLORS.moss,
        'Run,Trail': COLORS.amber  // Orange pour Run & Trail combiné
    };

    // Récupérer le sport sélectionné
    const selectedSport = document.getElementById('repartitionSportFilter').value;
    const color = sportColors[selectedSport] || COLORS.amber;

    // Créer un dégradé de couleurs pour chaque catégorie
    const backgroundColors = data.labels.map((label, index) => {
        const opacity = 0.7 - (index * 0.15); // Dégradé d'opacité
        return color + Math.round(opacity * 255).toString(16).padStart(2, '0');
    });

    charts.repartition = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'Nombre d\'activités',
                data: data.values || [],
                backgroundColor: backgroundColors,
                borderColor: color,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: {
                    grid: { display: false },
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return Math.round(value);
                        }
                    }
                },
                y: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.x} activité${context.parsed.x > 1 ? 's' : ''}`;
                        }
                    }
                }
            }
        }
    });
}

// 5. Gestion des objectifs hebdomadaires
let goalsWeekOffset = 0;

function loadGoals() {
    const goals = JSON.parse(localStorage.getItem('weekly_goals') || '{}');

    document.getElementById('goalRunTrail').value = goals.runTrail || '';
    document.getElementById('goalBike').value = goals.bike || '';
    document.getElementById('goalSwim').value = goals.swim || '';

    // Afficher la semaine courante et mettre à jour la progression
    displayCurrentWeek();
    updateGoalsProgress();
}

function changeGoalsWeek(direction) {
    const newOffset = goalsWeekOffset + direction;

    // Ne pas permettre d'aller au-delà de la semaine en cours
    if (newOffset > 0) {
        return;
    }

    goalsWeekOffset = newOffset;
    displayCurrentWeek();
    updateGoalsProgress();

    // Mettre à jour l'état du bouton "suivant"
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    if (nextWeekBtn) {
        nextWeekBtn.disabled = goalsWeekOffset >= 0;
    }
}

function displayCurrentWeek() {
    const currentWeekDisplay = document.getElementById('currentWeekDisplay');
    if (!currentWeekDisplay) return;

    // Obtenir le lundi de la semaine courante + offset
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday + (goalsWeekOffset * 7));

    // Obtenir le dimanche de la semaine
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Formater les dates
    const formatDate = (date) => {
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month}`;
    };

    if (goalsWeekOffset === 0) {
        currentWeekDisplay.textContent = `Semaine en cours (${formatDate(monday)} - ${formatDate(sunday)})`;
    } else {
        currentWeekDisplay.textContent = `Semaine du ${formatDate(monday)} au ${formatDate(sunday)}`;
    }
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
        // Calculer les dates de la semaine courante + offset (lundi à dimanche)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

        const monday = new Date(today);
        monday.setDate(today.getDate() + diffToMonday + (goalsWeekOffset * 7));
        monday.setHours(0, 0, 0, 0); // Début du lundi à 00:00:00

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999); // Fin du dimanche à 23:59:59

        console.log('Période des objectifs:', {
            monday: monday.toISOString(),
            sunday: sunday.toISOString()
        });

        // Formater les dates pour l'API (YYYY-MM-DD)
        const formatDateForAPI = (date) => {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const startDate = formatDateForAPI(monday);
        const endDate = formatDateForAPI(sunday);

        // Récupérer TOUTES les activités de la semaine (sans filtrer par sport)
        const response = await fetch(`${API_BASE}/activities/filter_activities?start_date=${startDate}&end_date=${endDate}`, { headers });

        if (!response.ok) {
            console.warn('Erreur API:', response.status, response.statusText);
            return;
        }

        const allActivitiesData = await response.json();

        // Normaliser les données (gérer différents formats de réponse API)
        const normalizeData = (data) => {
            if (Array.isArray(data)) return data;
            if (data?.activities && Array.isArray(data.activities)) return data.activities;
            return [];
        };

        const allActivities = normalizeData(allActivitiesData);

        // Filtrer par type de sport
        const runActivities = allActivities.filter(a => a.sport_type === 'Run');
        const trailActivities = allActivities.filter(a => a.sport_type === 'Trail');
        const bikeActivities = allActivities.filter(a => a.sport_type === 'Bike');
        const swimActivities = allActivities.filter(a => a.sport_type === 'Swim');

        console.log('Activités de la semaine:', {
            total: allActivities.length,
            run: runActivities.length,
            trail: trailActivities.length,
            bike: bikeActivities.length,
            swim: swimActivities.length
        });

        const goals = JSON.parse(localStorage.getItem('weekly_goals') || '{}');

        console.log('Activités filtrées:', {
            run: runActivities.length,
            trail: trailActivities.length,
            bike: bikeActivities.length,
            swim: swimActivities.length
        });

        // Log un exemple d'activité pour voir la structure
        if (runActivities.length > 0) {
            console.log('Exemple activité Run:', runActivities[0]);
        } else if (trailActivities.length > 0) {
            console.log('Exemple activité Trail:', trailActivities[0]);
        }

        // Calculer les distances totales pour chaque sport
        // Essayer différents noms de colonnes possibles
        const getDistance = (activity) => {
            return activity.distance_km || activity.distance || 0;
        };

        const runTrailKm = [...runActivities, ...trailActivities].reduce((total, activity) => total + getDistance(activity), 0);
        const bikeKm = bikeActivities.reduce((total, activity) => total + getDistance(activity), 0);
        const swimKm = swimActivities.reduce((total, activity) => total + getDistance(activity), 0);

        console.log('Distances calculées:', { runTrailKm, bikeKm, swimKm });
        console.log('Objectifs:', goals);

        updateProgressBar('RunTrail', runTrailKm, goals.runTrail || 0);
        updateProgressBar('Bike', bikeKm, goals.bike || 0);
        updateProgressBar('Swim', swimKm, goals.swim || 0);

        // Récupérer les données de la semaine précédente pour comparaison
        const prevMonday = new Date(monday);
        prevMonday.setDate(monday.getDate() - 7);
        const prevSunday = new Date(sunday);
        prevSunday.setDate(sunday.getDate() - 7);

        const prevStartDate = formatDateForAPI(prevMonday);
        const prevEndDate = formatDateForAPI(prevSunday);

        const prevResponse = await fetch(`${API_BASE}/activities/filter_activities?start_date=${prevStartDate}&end_date=${prevEndDate}`, { headers });
        let prevActivities = [];
        if (prevResponse.ok) {
            const prevData = await prevResponse.json();
            prevActivities = normalizeData(prevData);
        }

        // Mettre à jour la card "Cette Semaine" avec TOUTES les activités
        updateWeeklySummary(allActivities, prevActivities, goals);

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

function updateWeeklySummary(allActivities, prevActivities, goals) {
    // Calculer les totaux pour TOUTES les activités
    const getDistance = (activity) => activity.distance_km || activity.distance || 0;
    const getElevation = (activity) => activity.total_elevation_gain || 0;
    const getHours = (activity) => (activity.moving_time || activity.elapsed_time || 0) / 60; // Convertir minutes en heures

    const totalDistance = allActivities.reduce((sum, act) => sum + getDistance(act), 0);
    const totalElevation = allActivities.reduce((sum, act) => sum + getElevation(act), 0);
    const totalHours = allActivities.reduce((sum, act) => sum + getHours(act), 0);
    const totalSessions = allActivities.length; // Compte toutes les activités (Run, Trail, Bike, Swim, WeightTraining, etc.)

    // Calculer les heures de la semaine précédente
    const prevHours = prevActivities.reduce((sum, act) => sum + getHours(act), 0);

    // Calculer le pourcentage de différence
    let percentageDiff = 0;
    if (prevHours > 0) {
        percentageDiff = ((totalHours - prevHours) / prevHours) * 100;
    } else if (totalHours > 0) {
        percentageDiff = 100; // Si aucune activité la semaine d'avant mais des activités cette semaine
    }

    // Déterminer la tendance avec le pourcentage
    const trendEl = document.getElementById('weeklyTrend');
    if (trendEl) {
        const absPercentage = Math.abs(percentageDiff);
        if (percentageDiff > 0) {
            trendEl.textContent = `↑ ${absPercentage.toFixed(0)}%`;
            trendEl.style.color = '#6DAA75'; // Vert (moss)
        } else if (percentageDiff < 0) {
            trendEl.textContent = `↓ ${absPercentage.toFixed(0)}%`;
            trendEl.style.color = '#E74C3C'; // Rouge
        } else {
            trendEl.textContent = '→ 0%';
            trendEl.style.color = '#3A3F47'; // Gris
        }
    }

    // Calculer le pourcentage de l'objectif global (somme des objectifs)
    const totalGoal = (goals.runTrail || 0) + (goals.bike || 0) + (goals.swim || 0);
    const percentage = totalGoal > 0 ? Math.min((totalDistance / totalGoal) * 100, 100) : 0;

    // Mettre à jour les éléments DOM
    const distanceEl = document.getElementById('weeklySummaryDistance');
    const elevationEl = document.getElementById('weeklySummaryElevation');
    const sessionsEl = document.getElementById('weeklySummarySessions');
    const progressBar = document.getElementById('weeklyProgressBar');
    const progressText = document.getElementById('weeklyProgressText');

    if (distanceEl) distanceEl.textContent = `${totalDistance.toFixed(1)} km`;
    if (elevationEl) elevationEl.textContent = `${Math.round(totalElevation).toLocaleString()} m`;
    if (sessionsEl) sessionsEl.textContent = totalSessions;
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (progressText) progressText.textContent = `${Math.round(percentage)}% de l'objectif hebdomadaire`;
}

async function updateMonthlySummary() {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        // Calculer les dates du mois en cours (1er du mois à aujourd'hui)
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        firstDayOfMonth.setHours(0, 0, 0, 0);

        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        lastDayOfMonth.setHours(23, 59, 59, 999);

        // Formater les dates pour l'API (YYYY-MM-DD)
        const formatDateForAPI = (date) => {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const startDate = formatDateForAPI(firstDayOfMonth);
        const endDate = formatDateForAPI(lastDayOfMonth);

        // Récupérer TOUTES les activités du mois (sans filtrer par sport)
        const response = await fetch(`${API_BASE}/activities/filter_activities?start_date=${startDate}&end_date=${endDate}`, { headers });

        if (!response.ok) {
            console.warn('Erreur API:', response.status, response.statusText);
            return;
        }

        const allActivitiesData = await response.json();

        // Normaliser les données
        const normalizeData = (data) => {
            if (Array.isArray(data)) return data;
            if (data?.activities && Array.isArray(data.activities)) return data.activities;
            return [];
        };

        const allActivities = normalizeData(allActivitiesData);

        const getDistance = (activity) => activity.distance_km || activity.distance || 0;
        const getElevation = (activity) => activity.total_elevation_gain || 0;
        const getHours = (activity) => (activity.moving_time || activity.elapsed_time || 0) / 60; // Convertir minutes en heures

        const totalDistance = allActivities.reduce((sum, act) => sum + getDistance(act), 0);
        const totalElevation = allActivities.reduce((sum, act) => sum + getElevation(act), 0);
        const totalHours = allActivities.reduce((sum, act) => sum + getHours(act), 0);
        const totalSessions = allActivities.length; // Compte toutes les activités (Run, Trail, Bike, Swim, WeightTraining, etc.)

        // Récupérer les données du mois précédent pour comparaison
        // IMPORTANT: On compare avec le même nombre de jours du mois précédent
        const daysPassed = today.getDate(); // Nombre de jours écoulés dans le mois en cours

        const prevFirstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        // Pour comparer équitablement, on prend les mêmes jours du mois précédent
        const prevLastDayToCompare = new Date(today.getFullYear(), today.getMonth() - 1, daysPassed);

        const prevStartDate = formatDateForAPI(prevFirstDay);
        const prevEndDate = formatDateForAPI(prevLastDayToCompare);

        const prevResponse = await fetch(`${API_BASE}/activities/filter_activities?start_date=${prevStartDate}&end_date=${prevEndDate}`, { headers });
        let prevActivities = [];
        if (prevResponse.ok) {
            const prevData = await prevResponse.json();
            prevActivities = normalizeData(prevData);
        }

        // Calculer les heures du mois précédent (sur le même nombre de jours)
        const prevHours = prevActivities.reduce((sum, act) => sum + getHours(act), 0);

        // Calculer le pourcentage de différence
        let percentageDiff = 0;
        if (prevHours > 0) {
            percentageDiff = ((totalHours - prevHours) / prevHours) * 100;
        } else if (totalHours > 0) {
            percentageDiff = 100; // Si aucune activité le mois d'avant mais des activités ce mois
        }

        // Déterminer la tendance avec le pourcentage
        const trendEl = document.getElementById('monthlyTrend');
        if (trendEl) {
            const absPercentage = Math.abs(percentageDiff);
            if (percentageDiff > 0) {
                trendEl.textContent = `↑ ${absPercentage.toFixed(0)}%`;
                trendEl.style.color = '#6DAA75'; // Vert (moss)
            } else if (percentageDiff < 0) {
                trendEl.textContent = `↓ ${absPercentage.toFixed(0)}%`;
                trendEl.style.color = '#E74C3C'; // Rouge
            } else {
                trendEl.textContent = '→ 0%';
                trendEl.style.color = '#3A3F47'; // Gris
            }
        }

        // Calculer le pourcentage du mois écoulé
        const daysInMonth = lastDayOfMonth.getDate();
        const monthProgress = (daysPassed / daysInMonth) * 100;

        // Mettre à jour les éléments DOM
        const distanceEl = document.getElementById('monthlySummaryDistance');
        const elevationEl = document.getElementById('monthlySummaryElevation');
        const sessionsEl = document.getElementById('monthlySummarySessions');
        const progressBar = document.getElementById('monthlyProgressBar');
        const progressText = document.getElementById('monthlyProgressText');

        if (distanceEl) distanceEl.textContent = `${totalDistance.toFixed(1)} km`;
        if (elevationEl) elevationEl.textContent = `${Math.round(totalElevation).toLocaleString()} m`;
        if (sessionsEl) sessionsEl.textContent = totalSessions;
        if (progressBar) progressBar.style.width = `${monthProgress}%`;
        if (progressText) progressText.textContent = `${daysPassed}/${daysInMonth} jours du mois`;

    } catch (error) {
        console.error('Erreur mise à jour résumé mensuel:', error);
    }
}

// -----------------------------
// Calendrier
// -----------------------------
let currentCalendarDate = new Date();

function loadCalendar() {
    generateCalendar(currentCalendarDate);
}

function previousMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    generateCalendar(currentCalendarDate);
}

function nextMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    generateCalendar(currentCalendarDate);
}

function generateCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();

    // Mettre à jour le titre
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                       'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    document.getElementById('currentMonthYear').textContent = `${monthNames[month]} ${year}`;

    // Premier jour du mois
    const firstDay = new Date(year, month, 1);
    // Dernier jour du mois
    const lastDay = new Date(year, month + 1, 0);

    // Ajuster pour que la semaine commence le lundi (0 = dimanche, 1 = lundi, ...)
    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Convertir dimanche (0) en 6

    // Date de début (peut être dans le mois précédent)
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - startDayOfWeek);

    const calendarGrid = document.getElementById('calendarGrid');
    calendarGrid.innerHTML = '';

    // En-têtes des jours de la semaine
    const weekdays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const weekdaysRow = document.createElement('div');
    weekdaysRow.className = 'calendar-weekdays';

    weekdays.forEach(day => {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-weekday';
        dayElement.textContent = day;
        calendarGrid.appendChild(dayElement);
    });

    // En-tête pour la colonne des stats
    const statsHeader = document.createElement('div');
    statsHeader.className = 'calendar-week-stats-header';
    statsHeader.textContent = 'Semaine';
    calendarGrid.appendChild(statsHeader);

    // Générer les jours
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentDate = new Date(startDate);
    let weekCount = 0;

    while (currentDate <= lastDay || currentDate.getDay() !== 1) {
        const weekElement = document.createElement('div');
        weekElement.className = 'calendar-week';

        // Générer 7 jours pour cette semaine
        for (let i = 0; i < 7; i++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';

            const isCurrentMonth = currentDate.getMonth() === month;
            const isToday = currentDate.getTime() === today.getTime();

            if (!isCurrentMonth) {
                dayElement.classList.add('other-month');
            }
            if (isToday) {
                dayElement.classList.add('today');
            }

            const dayNumber = document.createElement('div');
            dayNumber.className = 'calendar-day-number';
            dayNumber.textContent = currentDate.getDate();
            dayElement.appendChild(dayNumber);

            // Zone pour les activités (à remplir plus tard)
            const activitiesDiv = document.createElement('div');
            activitiesDiv.className = 'calendar-day-activities';
            dayElement.appendChild(activitiesDiv);

            calendarGrid.appendChild(dayElement);

            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Ajouter la zone de stats de la semaine
        const weekStats = document.createElement('div');
        weekStats.className = 'calendar-week-stats';
        weekStats.innerHTML = `
            <div class="calendar-week-stats-item">
                <span class="calendar-week-stats-label">Distance:</span>
                <span class="calendar-week-stats-value">-</span>
            </div>
            <div class="calendar-week-stats-item">
                <span class="calendar-week-stats-label">Temps:</span>
                <span class="calendar-week-stats-value">-</span>
            </div>
        `;
        calendarGrid.appendChild(weekStats);

        weekCount++;

        // Arrêter si on a dépassé le dernier jour du mois et qu'on est sur un lundi
        if (currentDate > lastDay && currentDate.getDay() === 1) {
            break;
        }
    }
}

// -----------------------------
// Page Activités
// -----------------------------
let allActivities = [];
let currentPage = 1;
const activitiesPerPage = 10;

async function loadActivities() {
    const headers = getAuthHeaders();
    if (!headers) return;

    try {
        const response = await fetch(`${API_BASE}/activities/activities`, { headers });
        if (response.ok) {
            allActivities = await response.json();
            // Trier par date décroissante
            allActivities.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
            currentPage = 1;
            displayActivities();
        }
    } catch (error) {
        console.error('Erreur chargement activités:', error);
    }
}

function displayActivities() {
    const container = document.getElementById('activitiesList');
    if (!container) return;

    const startIndex = (currentPage - 1) * activitiesPerPage;
    const endIndex = startIndex + activitiesPerPage;
    const activitiesToShow = allActivities.slice(startIndex, endIndex);

    const sportColors = {
        'Run': { bg: 'rgba(232, 131, 42, 0.125)', color: '#E8832A' },
        'Trail': { bg: 'rgba(232, 131, 42, 0.125)', color: '#E8832A' },
        'Bike': { bg: 'rgba(61, 178, 224, 0.125)', color: '#3DB2E0' },
        'Swim': { bg: 'rgba(109, 170, 117, 0.125)', color: '#6DAA75' },
        'Hike': { bg: 'rgba(109, 170, 117, 0.125)', color: '#6DAA75' },
        'WeightTraining': { bg: 'rgba(58, 63, 71, 0.125)', color: '#3A3F47' }
    };

    container.innerHTML = activitiesToShow.map(activity => {
        const date = new Date(activity.start_date);
        const formattedDate = `${date.getDate()} ${date.toLocaleDateString('fr-FR', { month: 'short' })} ${date.getFullYear()}`;
        const sportColor = sportColors[activity.sport_type] || sportColors['Run'];

        return `
            <div class="activity-card" style="--color: ${sportColor.color};">
                <div class="activity-card-header">
                    <div>
                        <h5 class="activity-card-title">${activity.name || 'Activité sans titre'}</h5>
                        <div class="activity-card-date">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M8 2v4"></path>
                                <path d="M16 2v4"></path>
                                <rect width="18" height="18" x="3" y="4" rx="2"></rect>
                                <path d="M3 10h18"></path>
                            </svg>
                            <span>${formattedDate}</span>
                        </div>
                    </div>
                    <div class="activity-card-badge" style="background-color: ${sportColor.bg}; color: ${sportColor.color};">
                        ${activity.sport_type}
                    </div>
                </div>
                <div class="activity-card-stats">
                    <div class="activity-card-stat">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="${COLORS.amber}" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <div>
                            <p class="activity-card-stat-value" style="color: ${COLORS.amber};">${(activity.distance || 0).toFixed(1)} km</p>
                            <p class="activity-card-stat-label">Distance</p>
                        </div>
                    </div>
                    <div class="activity-card-stat">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="${COLORS.glacier}" stroke-width="2" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 6v6l4 2"></path>
                        </svg>
                        <div>
                            <p class="activity-card-stat-value" style="color: ${COLORS.glacier};">${activity.moving_time_hms || '-'}</p>
                            <p class="activity-card-stat-label">Durée</p>
                        </div>
                    </div>
                    ${activity.sport_type !== 'WeightTraining' && activity.speed_minutes_per_km_hms ? `
                    <div class="activity-card-stat">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="${COLORS.amber}" stroke-width="2" viewBox="0 0 24 24">
                            <path d="m12 14 4-4"></path>
                            <path d="M3.34 19a10 10 0 1 1 17.32 0"></path>
                        </svg>
                        <div>
                            <p class="activity-card-stat-value" style="color: ${COLORS.amber};">${activity.speed_minutes_per_km_hms} /km</p>
                            <p class="activity-card-stat-label">Allure</p>
                        </div>
                    </div>
                    ` : ''}
                    ${activity.total_elevation_gain ? `
                    <div class="activity-card-stat">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="${COLORS.glacier}" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <div>
                            <p class="activity-card-stat-value" style="color: ${COLORS.glacier};">${Math.round(activity.total_elevation_gain)} m</p>
                            <p class="activity-card-stat-label">D+</p>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Mettre à jour la pagination
    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(allActivities.length / activitiesPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} sur ${totalPages}`;
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage === totalPages;
}

function changePage(delta) {
    const totalPages = Math.ceil(allActivities.length / activitiesPerPage);
    const newPage = currentPage + delta;

    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        displayActivities();
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
