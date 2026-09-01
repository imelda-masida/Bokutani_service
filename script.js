
const ADMIN_PASSWORD_CORRECT = "1234";


let roleActuel = "UTILISATEUR";

const etatSalles = {
    "SALLE A": { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, pin: "" },
    "SALLE B": { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, pin: "" },
    "SALLE C": { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, pin: "" }
};

const historiqueGlobal = [];

// Demande de permission pour les notifications du navigateur
document.addEventListener("DOMContentLoaded", () => {
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
    rafraichirToutesLesSalles();
});


function changerRole() {
    const select = document.getElementById("user-role");
    const roleSelectionne = select.value;

    if (roleSelectionne === "ADMIN") {
        const pass = prompt("Saisissez le mot de passe Administrateur :");
        if (pass === ADMIN_PASSWORD_CORRECT) {
            roleActuel = "ADMIN";
            document.getElementById("admin-panel").classList.remove("hidden");
            rafraichirHistoriqueUI();
        } else {
            alert("Mot de passe incorrect.");
            select.value = roleActuel;
        }
    } else {
        roleActuel = roleSelectionne;
        document.getElementById("admin-panel").classList.add("hidden");
    }
}

// Formulaire Modale (Ouverture/Fermeture)
function ouvrirFormulaire(nomSalle) {
    const salle = etatSalles[nomSalle];

    // Vérifier si la salle est occupée
    if (salle.status !== "Libre" && Date.now() < salle.endTime) {
        alert(`${nomSalle} est actuellement ${salle.status.toLowerCase()} par ${salle.author}.`);
        return;
    }

    document.getElementById("salle-nom").value = nomSalle;
    const title = document.getElementById("modal-title");
    const deptGroup = document.getElementById("group-dept");

    if (roleActuel === "MAINTENANCE") {
        title.innerText = `Maintenance - ${nomSalle}`;
        deptGroup.classList.remove("hidden");
    } else {
        title.innerText = `Réserver - ${nomSalle}`;
        deptGroup.classList.add("hidden");
    }

    document.getElementById("modal-form").classList.remove("hidden");
}

function fermerFormulaire() {
    document.getElementById("modal-form").classList.add("hidden");
    document.getElementById("booking-form").reset();
}

// Validation de Réservation & Anti-Chevauchement
document.getElementById("booking-form").addEventListener("submit", function (e) {
    e.preventDefault();

    const nomSalle = document.getElementById("salle-nom").value;
    const author = document.getElementById("auteur").value.trim();
    const purpose = document.getElementById("motif").value.trim();
    const dureeMin = parseInt(document.getElementById("duree").value);
    const pin = document.getElementById("pin-code").value.trim();
    const dept = document.getElementById("dept-select").value;

    const maintentanceMode = (roleActuel === "MAINTENANCE");
    const start = Date.now();
    const end = start + (dureeMin * 60 * 1000);

    // Détection de conflit horaire
    const salleActuelle = etatSalles[nomSalle];
    if (salleActuelle.status !== "Libre" && start < salleActuelle.endTime) {
        alert("Conflit ! La salle est déjà occupée sur cette période.");
        return;
    }

    // Mise à jour de la salle
    const typeAction = maintentanceMode ? "MAINTENANCE" : "REUNION";
    const statusText = maintentanceMode ? "Maintenance" : "Occupée";

    etatSalles[nomSalle] = {
        status: statusText,
        author: maintentanceMode ? `[${dept}] ${author}` : author,
        purpose: purpose,
        type: typeAction,
        dept: maintentanceMode ? dept : "N/A",
        startTime: start,
        endTime: end,
        pin: pin
    };

    // Ajout dans l'historique admin
    historiqueGlobal.push({
        salle: nomSalle,
        type: statusText,
        author: etatSalles[nomSalle].author,
        purpose: purpose,
        duree: dureeMin,
        date: new Date().toLocaleString()
    });

    // Programmer les alertes de fin (-10 min et -5 min)
    programmerAlertes(nomSalle, dureeMin);

    rafraichirSalleUI(nomSalle);
    if (roleActuel === "ADMIN") rafraichirHistoriqueUI();
    fermerFormulaire();
});

// 4. Notifications Automatiques (-10 min et -5 min)
function programmerAlertes(nomSalle, dureeMin) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const totalMs = dureeMin * 60 * 1000;

    // Alerte à 10 minutes de la fin
    const delay10 = totalMs - (10 * 60 * 1000);
    if (delay10 > 0) {
        setTimeout(() => {
            new Notification("Bokutani - Rappel", {
                body: `La session dans la ${nomSalle} se termine dans 10 minutes.`
            });
        }, delay10);
    }

    // Alerte à 5 minutes de la fin
    const delay5 = totalMs - (5 * 60 * 1000);
    if (delay5 > 0) {
        setTimeout(() => {
            new Notification("Bokutani - Libération Imminente", {
                body: `Attention : la ${nomSalle} doit être libérée dans 5 minutes !`
            });
        }, delay5);
    }
}

// 5. Annulation par Code PIN
function demanderAnnulation(nomSalle) {
    const salle = etatSalles[nomSalle];
    const pinSaisi = prompt(`Entrez votre code PIN à 4 chiffres pour annuler la réservation de ${nomSalle} :`);

    if (pinSaisi === salle.pin || roleActuel === "ADMIN") {
        etatSalles[nomSalle] = { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, pin: "" };
        rafraichirSalleUI(nomSalle);
        alert(`${nomSalle} a été libérée avec succès.`);
    } else if (pinSaisi !== null) {
        alert("Code PIN incorrect. Opération refusée.");
    }
}

// Mise à jour de l'affichage (DOM)
function rafraichirSalleUI(nomSalle) {
    const key = nomSalle.toLowerCase().replace(" ", "-");
    const salle = etatSalles[nomSalle];

    const badge = document.getElementById(`status-${key}`);
    const details = document.getElementById(`details-${key}`);
    const btnCancel = document.getElementById(`btn-cancel-${key}`);

    // Vérifier l'expiration automatique
    if (salle.endTime && Date.now() >= salle.endTime) {
        etatSalles[nomSalle] = { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, pin: "" };
    }

    if (salle.status === "Libre") {
        badge.innerText = "Libre";
        badge.className = "status badge-libre";
        details.classList.add("hidden");
        btnCancel.classList.add("hidden");
    } else {
        badge.innerText = salle.status;
        badge.className = "status " + (salle.status === "Occupée" ? "badge-occupee" : "badge-maintenance");

        const minRestantes = Math.max(0, Math.round((salle.endTime - Date.now()) / 60000));
        details.innerHTML = `<strong>Auteur:</strong> ${salle.author}<br><strong>Motif:</strong> ${salle.purpose}<br><strong>Temps restant:</strong> ~${minRestantes} min`;
        details.classList.remove("hidden");
        btnCancel.classList.remove("hidden");
    }
}

function rafraichirToutesLesSalles() {
    rafraichirSalleUI("SALLE A");
    rafraichirSalleUI("SALLE B");
    rafraichirSalleUI("SALLE C");
}

function rafraichirHistoriqueUI() {
    const liste = document.getElementById("historique-liste");
    liste.innerHTML = "";
    historiqueGlobal.forEach(item => {
        const li = document.createElement("li");
        li.innerText = `[${item.date}] ${item.salle} | ${item.type} par ${item.author} (${item.duree} min)`;
        liste.appendChild(li);
    });
}

// Génération du Rapport PDF Hebdomadaire
function genererPDFHebdomadaire() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(2, 16, 104);
    doc.text("BOKUTANI - Compte-Rendu Hebdomadaire", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Rapport édité le : ${new Date().toLocaleString()}`, 14, 28);
    doc.text("--------------------------------------------------------------------------------------------------", 14, 33);

    let y = 42;
    if (historiqueGlobal.length === 0) {
        doc.text("Aucun enregistrement disponible pour cette période.", 14, y);
    } else {
        historiqueGlobal.forEach((item, i) => {
            doc.text(`${i + 1}. ${item.salle} - ${item.type} | Responsable: ${item.author}`, 14, y);
            doc.text(`   Motif: ${item.purpose} | Durée: ${item.duree} min | Date: ${item.date}`, 14, y + 6);
            y += 14;
        });
    }

    doc.save("Bokutani_Rapport_Hebdomadaire.pdf");
}