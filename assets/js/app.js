const API_BASE = 'http://localhost:3000/api';
let currentToken = localStorage.getItem('eyesight_token');
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
            currentToken = data.access_token;
            localStorage.setItem('eyesight_token', currentToken);
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

    try {
        const response = await fetch(`${API_BASE}/activities/update_db`, {
            method: 'POST',
            headers: getAuthHeaders()
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

    try {
        const response = await fetch(`${API_BASE}/activities/update_streams`, {
            method: 'POST',
            headers: getAuthHeaders()
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
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
    };
}

// Chargement du dashboard
async function loadDashboard() {
    await loadKPIsWithFilter();
    await loadLastActivity();
    await loadActivityElevation();
    await displayElevationProfile();
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
        chartContainer.innerHTML = ''; // clear

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

        new Chart(canvas.getContext('2d'), {
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
                indexAxis: 'y',  // barre horizontale
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(val) {
                                return new Intl.NumberFormat('fr-FR').format(val);
                            }
                        }
                    },
                    y: { ticks: { mirror: false } }
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
async function loadLastActivity() {
    try {
        const response = await fetch(`${API_BASE}/activities/last_activity`, {
            headers: getAuthHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            displayLastActivity(data);
            await loadActivityTrace(data);
            await loadActivityElevation();
        }
    } catch (error) {
        console.error('Erreur chargement dernière activité:', error);
    }
}

function displayLastActivity(activity) {
    const container = document.getElementById('lastActivityInfo');

    // Formatage de la date
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
                <div class="activity-stat-label">Durée</div>
            </div>
            <div class="activity-stat">
                <div class="activity-stat-value">${Math.round(activity.denivele_m || 0)} m</div>
                <div class="activity-stat-label">Dénivelé+</div>
            </div>
            <div class="activity-stat">
                <div class="activity-stat-value">${activity.allure_min_per_km}</div>
                <div class="activity-stat-label">Allure (min/km)</div>
            </div>
            <div class="activity-stat">
                <div class="activity-stat-value">${activity.vitesse_kmh.toFixed(1)} km/h</div>
                <div class="activity-stat-label">Vitesse moy.</div>
            </div>
        </div>
    `;
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
        mapContainer.innerHTML =
            '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">Aucune coordonnée GPS disponible</div>';
        return;
    }

    // Les coords sont déjà au format [lat, lon]
    const validPoints = coords.filter(coord =>
        coord[0] !== null && coord[1] !== null &&
        !isNaN(coord[0]) && !isNaN(coord[1])
    );

    if (validPoints.length === 0) {
        mapContainer.innerHTML =
            '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">Aucune coordonnée GPS valide</div>';
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

let mapInteractive, mapStatic;
let polylineInteractive, polylineStatic;

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

    // ========================
    // 🗺️ Carte interactive
    // ========================
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

    // ========================
    // 🌈 Carte figée stylée
    // ========================
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


    // Trace blanche
    polylineStatic = L.polyline(coords, {
        color: '#352f99ff',
        weight: 3,
        opacity: 1,
        lineJoin: 'round'
    }).addTo(mapStatic);

    mapStatic.fitBounds(polylineStatic.getBounds(), { padding: [20, 20] });
}




async function loadActivityElevation() {
    try {
        const response = await fetch(`${API_BASE}/activities/last_activity_streams`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) return;

        const data = await response.json();

        if (!data.streams || data.streams.length === 0) return;

        // Appeler le graphique avec les streams récupérés
        displayElevationProfile(data.streams);

    } catch (error) {
        console.error('Erreur chargement élévation:', error);
    }
}

// -----------------------------
// Affichage du graphique de dénivelé
// -----------------------------
function displayElevationProfile(streams) {
    const canvas = document.getElementById('elevationChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const distances = streams.map(s => s.distance_m / 1000); // km
    const elevations = streams.map(s => s.altitude);          // m

    new Chart(ctx, {
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
            scales: {
                x: {
                title: { display: true, text: 'Distance (km)' },
                ticks: {
                    callback: function(value, index) {
                        const total = distances[distances.length - 1];       // distance totale
                        const mid = total / 2;                               // moitié de la distance
                        const labelValue = this.getLabelForValue(value);     // valeur réelle du tick

                        if (labelValue === 0) return '';                     // début = vide
                        if (Math.abs(labelValue - mid) < 1e-6) return Math.round(mid); // milieu
                        if (Math.abs(labelValue - total) < 1e-6) return Math.round(total); // fin
                        return '';                                           // rien pour les autres
                    }
                }
            },y: { title: { display: true, text: 'Altitude (m)' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}



// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    updateNavigation();

    if (currentToken) {
        showPage('dashboardPage');
        loadDashboard();
    }



});
