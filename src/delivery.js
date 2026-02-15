import { authService } from './services/auth.service.js';
import { databaseService } from './services/database.service.js';
import { getURLs } from './config/urls.js';

let currentUser = null;
let currentStaffName = null;
let activeTicketId = null;

const init = async () => {
    const loadingScreen = document.getElementById('loading-screen');
    const driverDisplay = document.getElementById('driver-name-display');

    authService.onAuthChange(async (user) => {
        if (user) {
            currentUser = user;
            currentStaffName = localStorage.getItem('rutatotal_staff_name');

            if (!currentStaffName) {
                window.location.href = getURLs().login;
                return;
            }

            driverDisplay.textContent = currentStaffName;

            // Suscribirse a los pedidos
            databaseService.subscribeToOrders((orders) => {
                renderOrders(orders);
                if (loadingScreen) {
                    loadingScreen.style.opacity = '0';
                    setTimeout(() => loadingScreen.style.display = 'none', 500);
                }
            });

        } else {
            window.location.href = getURLs().login;
        }
    });

    // Eventos Globales
    document.getElementById('logout-btn').onclick = () => {
        if (confirm("¿Cerrar sesión de repartidor?")) {
            authService.logout().then(() => {
                localStorage.removeItem('rutatotal_role');
                localStorage.removeItem('rutatotal_staff_name');
                window.location.href = getURLs().login;
            });
        }
    };

    document.getElementById('close-modal').onclick = () => {
        document.getElementById('incident-modal').style.display = 'none';
    };

    document.querySelectorAll('.incident-opt').forEach(btn => {
        btn.onclick = () => {
            const opt = btn.getAttribute('data-opt');
            if (activeTicketId && opt) {
                databaseService.reportIncident(activeTicketId, opt).then(() => {
                    document.getElementById('incident-modal').style.display = 'none';
                    playSound("D4");
                });
            }
        };
    });
};

const renderOrders = (orders) => {
    const container = document.getElementById('orders-list');
    container.innerHTML = '';

    console.log("DEBUG: Iniciando renderOrders para:", currentStaffName);
    console.log("DEBUG: Total pedidos en DB:", Object.keys(orders).length);

    const sortedOrders = Object.values(orders)
        .filter(o => {
            if (o.status === 'entregado') return false;
            if (!o.repartidor) return false;

            // Match flexible: insensible a mayúsculas y espacios
            const searchRep = (currentStaffName || '').toLowerCase().trim();
            const orderRep = (o.repartidor || '').toLowerCase().trim();

            const isExactMatch = orderRep === searchRep;
            const isPartialMatch = orderRep.includes(searchRep) || searchRep.includes(orderRep);

            if (isExactMatch || isPartialMatch) {
                console.log(`DEBUG: Pedido #${o.id} COINCIDE (${o.repartidor})`);
                return true;
            }
            return false;
        })
        .sort((a, b) => b.timestamp - a.timestamp);

    if (sortedOrders.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center p-12 text-slate-500 text-center">
                <i class="fas fa-check-circle text-4xl mb-4 text-emerald-500/20"></i>
                <p class="font-bold text-sm uppercase">¡Todo al día!</p>
                <p class="text-[10px] mt-1">No tienes pedidos pendientes asignados.</p>
            </div>
        `;
        return;
    }

    sortedOrders.forEach(o => {
        const card = document.createElement('div');
        card.className = 'order-card';

        let incidentContent = '';
        if (o.incident) {
            incidentContent = `
                <div class="incident-box">
                    <p class="incident-text"><i class="fas fa-exclamation-triangle mr-2"></i>${o.incident}</p>
                    ${o.response ? `
                        <div class="response-box">
                            <p class="response-text"><span class="opacity-50">RESPUESTA:</span> ${o.response}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        card.innerHTML = `
            <div class="ticket-header">
                <div>
                    <span class="ticket-label">Ticket</span>
                    <div class="ticket-id">#${o.id}</div>
                </div>
                <div class="text-right">
                    <div class="ticket-time">${o.time}</div>
                    <div class="driver-badge">${o.repartidor}</div>
                </div>
            </div>
            
            ${incidentContent}

            <div class="divider"></div>
            
            <div class="actions">
                <button class="finalize-btn" data-id="${o.id}">Finalizar</button>
                <button class="report-btn" data-id="${o.id}" title="Reportar"><i class="fas fa-comment-dots"></i></button>
                <button class="trash-btn" data-id="${o.id}" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;

        // Eventos
        card.querySelector('.finalize-btn').onclick = () => {
            databaseService.finalizeOrder(o.id).then(() => playSound("C5"));
        };

        card.querySelector('.report-btn').onclick = () => {
            activeTicketId = o.id;
            document.getElementById('modal-ticket-id').textContent = `#${o.id}`;
            document.getElementById('incident-modal').style.display = 'flex';
        };

        card.querySelector('.trash-btn').onclick = () => {
            if (confirm(`¿Eliminar ticket #${o.id}?`)) {
                databaseService.deleteOrder(o.id).then(() => playSound("A2"));
            }
        };

        container.appendChild(card);
    });
};

const playSound = (f) => {
    const synth = new Tone.PolySynth(Tone.Synth).toDestination();
    if (Tone.context.state !== 'running') Tone.start();
    synth.triggerAttackRelease(f, "8n");
};

init();
