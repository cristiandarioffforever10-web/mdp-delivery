import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInAnonymously,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig, APP_ID } from './config/firebase.config.js';
import { getURLs } from './config/urls.js';

// 1. Inicialización ISOLADA de Firebase para Delivery
// Usar un nombre de app distinto ("DeliveryApp") crea una instancia de Auth separada.
// Esto evita que al desloguearse aquí, termine la sesión del panel administrativo en la misma pestaña/navegador.
const deliveryApp = initializeApp(firebaseConfig, "DeliveryApp");
const auth = getAuth(deliveryApp);
const db = getFirestore(deliveryApp);

let currentUser = null;
let currentStaffName = null;
let activeTicketId = null;

// Funciones de Base de Datos (Reimplementadas para usar la instancia 'db' aislada)
const dbOps = {
    async loginWithPIN(pin) {
        if (!pin) throw new Error("PIN requerido");
        try {
            await signInAnonymously(auth);
            const staffRef = collection(db, 'staff_access');
            const q = query(staffRef, where("pin", "==", pin));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const staffData = querySnapshot.docs[0].data();
                return { ...staffData, name: (staffData.name || '').trim(), role: 'operativo' };
            } else {
                await signOut(auth);
                throw new Error("PIN incorrecto");
            }
        } catch (error) {
            console.error("Delivery Auth Error:", error);
            if (error.code === 'auth/admin-restricted-operation') {
                alert("ERROR CRÍTICO: Habilita 'Anonymous Auth' en Firebase Console.");
            }
            throw error;
        }
    },

    subscribeToOrders(callback) {
        // Misma referencia que el main app, pero con la instancia 'db' aislada
        const ordersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'orders');
        return onSnapshot(ordersRef, (snapshot) => {
            const orders = {};
            snapshot.forEach(doc => {
                orders[doc.id] = { id: doc.id, ...doc.data() };
            });
            callback(orders);
        });
    },

    async reportIncident(id, text) {
        const orderRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'orders', id.toString());
        await updateDoc(orderRef, {
            incident: text,
            incidentTime: Date.now(),
            response: null
        });
    },

    async finalizeOrder(id) {
        const orderRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'orders', id.toString());
        await updateDoc(orderRef, {
            status: 'entregado',
            deliveredAt: serverTimestamp()
        });
    },

    async deleteOrder(id) {
        const orderRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'orders', id.toString());
        await deleteDoc(orderRef);
    }
};

const init = async () => {
    const loadingScreen = document.getElementById('loading-screen');
    const driverDisplay = document.getElementById('driver-name-display');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            currentStaffName = localStorage.getItem('rutatotal_staff_name');

            // Si hay usuario pero no hay nombre (quizás expiró storage), forzar login
            if (!currentStaffName) {
                // Intentar recuperar sesión o redirigir
                window.location.href = getURLs().login;
                return;
            }

            driverDisplay.textContent = currentStaffName;

            // Suscribirse a los pedidos
            dbOps.subscribeToOrders((orders) => {
                renderOrders(orders);
                if (loadingScreen && loadingScreen.style.display !== 'none') {
                    loadingScreen.style.opacity = '0';
                    setTimeout(() => loadingScreen.style.display = 'none', 500);
                }
            });

        } else {
            // Si no está autenticado en la app "DeliveryApp", redirigir
            // IMPORTANTE: Esto no afecta a la app por defecto (Panel Maestro)
            window.location.href = getURLs().login;
        }
    });

    // Eventos Globales
    document.getElementById('logout-btn').onclick = () => {
        if (confirm("¿Cerrar sesión de repartidor?")) {
            signOut(auth).then(() => {
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
                dbOps.reportIncident(activeTicketId, opt).then(() => {
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

    console.log("DEBUG [Delivery]: Renderizando para:", currentStaffName);

    const sortedOrders = Object.values(orders)
        .filter(o => {
            if (o.status === 'entregado') return false;
            if (!o.repartidor) return false;

            const searchRep = (currentStaffName || '').toLowerCase().trim();
            const orderRep = (o.repartidor || '').toLowerCase().trim();

            return orderRep === searchRep || orderRep.includes(searchRep) || searchRep.includes(orderRep);
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

        // Diseño Alineado con Monitor Local (UI Manager)
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div class="flex flex-col">
                    <span class="text-[10px] font-black text-muted block uppercase tracking-wide" style="color: #64748b;">Ticket</span>
                    <span class="text-3xl font-black text-main font-mono leading-none my-1">#${o.id}</span>
                </div>
                <div class="text-right flex flex-col items-end">
                    <span class="text-xs font-bold text-slate-500 block mb-1">${o.time}</span>
                    <span class="text-[10px] font-black block uppercase px-2 py-0.5 rounded bg-slate-800" style="color: #ffffff;">${o.repartidor}</span>
                </div>
            </div>
            
            ${incidentContent}

            <div class="flex justify-between items-center mt-3 pt-2 border-t border-slate-800/50" style="border-color: rgba(30, 41, 59, 0.1);">
                <div class="flex-grow">
                    <button class="finalize-btn w-full bg-emerald-600 text-white text-xs font-black py-3 rounded-lg uppercase shadow-lg hover:bg-emerald-500 transition-all">Finalizar</button>
                </div>
                <div class="flex gap-1 ml-2">
                    <button class="report-btn p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition" title="Reportar">
                        <i class="fas fa-comment-dots text-lg"></i>
                    </button>
                    <button class="trash-btn p-3 text-slate-600 hover:text-red-500 transition hover:bg-red-500/10 rounded-lg" title="Eliminar">
                        <i class="fas fa-trash-alt text-lg"></i>
                    </button>
                </div>
            </div>
        `;

        // Eventos
        card.querySelector('.finalize-btn').onclick = () => {
            dbOps.finalizeOrder(o.id).then(() => playSound("C5"));
        };

        card.querySelector('.report-btn').onclick = () => {
            activeTicketId = o.id;
            document.getElementById('modal-ticket-id').textContent = `#${o.id}`;
            document.getElementById('incident-modal').style.display = 'flex';
        };

        card.querySelector('.trash-btn').onclick = () => {
            if (confirm(`¿Eliminar ticket #${o.id}?`)) {
                dbOps.deleteOrder(o.id).then(() => playSound("A2"));
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

// Exponer dbOps para el login desde index.html si fuera necesario, 
// o manejar el login aquí si se rediseñara el flujo, 
// pero por ahora el login principal sigue siendo en index.html con la app "default".
// PROBLEMA: El login en index.html usa la app default. 
// Si el usuario se loguea en index.html, se autentica en la app "default" (borrando al admin).
// LUEGO, al ser redirigido a delivery.html, este script inicializa "DeliveryApp", ve que no hay usuario (porque Auth es independiente), y redirige al login.
// BUCLE INFINITO O DESCONEXIÓN.

// SOLUCIÓN:
// El login de repartidor DEBE hacerse usando la instancia "DeliveryApp".
// Como index.html usa authService (App Default), no podemos usar ese login para el repartidor si queremos aislamiento total.
// ESTRATEGIA:
// 1. Modificar index.html para que detecte si es login de PIN.
// 2. Si es PIN, importar dinámicamente este script o una función que use "DeliveryApp" para autenticar.
// O MÁS SIMPLE:
// Hacer que delivery.html tenga SU PROPIA pantalla de login si no detecta sesión.
// Pero el usuario ya tiene un flujo en index.html.

// REVISIÓN DE ESTRATEGIA:
// Si index.html autentica en "Defaults", mata la sesión Admin.
// Login PIN en index.html -> authService.loginWithPIN (Default App) -> SignOut Admin. ¡Ese es el conflicto!

// CAMBIO NECESARIO:
// El login de repartidor NO DEBE ocurris en la app por defecto si queremos mantener al admin logueado.
// Voy a añadir lógica de login DIRECTAMENTE en delivery.html/delivery.js.
// Si delivery.js no detecta usuario y venimos de un redireccionamiento con credenciales (mala idea pasar pin por url)...

// Mejor: El login de repartidor en index.html solo verifica credenciales? No, firebase auth requiere persistencia.
// SÍ o SÍ, la acción de "Loguearse con PIN" debe instanciar "DeliveryApp".

// ACTUALIZACIÓN DEL PLAN:
// Voy a exponer una función global `window.loginDeliveryWithPIN` desde este script (o uno similar) 
// y usarla en index.html cuando se mete el PIN.
// Para eso, delivery.js debería ser capaz de exportar esa función.

// Exportar para uso en index.html sin inicializar UI
export const loginDeliveryWithPIN = dbOps.loginWithPIN;

// Solo inicializar si estamos en la vista de delivery
if (document.getElementById('orders-list')) {
    init();
}
