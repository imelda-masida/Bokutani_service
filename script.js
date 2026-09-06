const ADMIN_PASSWORD_CORRECT = "1234";
let roleActuel = "UTILISATEUR";

// 1. Chargement de l'état initial depuis le localStorage
let etatSalles = JSON.parse(localStorage.getItem('bokutani_salles')) || {
    "SALLE A": { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, pin: "" },
    "SALLE B": { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, pin: "" },
    "SALLE C": { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, pin: "" }
};

let historiqueGlobal = JSON.parse(localStorage.getItem('bokutani_historique')) || [];

// 2. Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    verifierEtRafraichir();
    setInterval(verifierEtRafraichir, 5000); // Mise à jour dynamique toutes les 5 secondes
});

function sauvegarderDonnees() {
    localStorage.setItem('bokutani_salles', JSON.stringify(etatSalles));
    localStorage.setItem('bokutani_historique', JSON.stringify(historiqueGlobal));
}

// 3. Gestion des Rôles
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

// 4. Modale (Ouverture / Fermeture)
function ouvrirFormulaire(nomSalle) {
    const salle = etatSalles[nomSalle];

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

// 5. Validation par Heures (Debut / Fin)
document.getElementById("booking-form").addEventListener("submit", function (e) {
    e.preventDefault();

    const nomSalle = document.getElementById("salle-nom").value;
    const author = document.getElementById("auteur").value.trim();
    const purpose = document.getElementById("motif").value.trim();
    const heureDebutStr = document.getElementById("heure-debut").value; // ex: "14:00"
    const heureFinStr = document.getElementById("heure-fin").value;     // ex: "15:30"
    const pin = document.getElementById("pin-code").value.trim();
    const deptSelect = document.getElementById("dept-select");
    const dept = deptSelect ? deptSelect.value : "N/A";

    // Convertir les heures "HH:MM" de la journée actuelle en horodatage ms
    const aujourdhui = new Date();
    const [hDebut, mDebut] = heureDebutStr.split(":").map(Number);
    const [hFin, mFin] = heureFinStr.split(":").map(Number);

    const start = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate(), hDebut, mDebut).getTime();
    const end = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate(), hFin, mFin).getTime();

    // Contrôles de validité des horaires
    if (end <= start) {
        alert("L'heure de fin doit être supérieure à l'heure de début.");
        return;
    }

    const dureeMin = Math.round((end - start) / (1000 * 60));

    // Détection de conflit d'occupation
    const salleActuelle = etatSalles[nomSalle];
    if (salleActuelle.status !== "Libre" && Date.now() < salleActuelle.endTime) {
        alert("Conflit ! La salle est déjà occupée sur cette période.");
        return;
    }

    const maintenanceMode = (roleActuel === "MAINTENANCE");
    const statusText = maintenanceMode ? "Maintenance" : "Occupée";
    const typeAction = maintenanceMode ? "MAINTENANCE" : "REUNION";

    // Mise à jour de l'état
    etatSalles[nomSalle] = {
        status: statusText,
        author: maintenanceMode ? `[${dept}] ${author}` : author,
        purpose: purpose,
        type: typeAction,
        dept: maintenanceMode ? dept : "N/A",
        startTime: start,
        endTime: end,
        horaire: `${heureDebutStr} - ${heureFinStr}`,
        pin: pin
    };

    // Historique
    historiqueGlobal.push({
        salle: nomSalle,
        type: statusText,
        author: etatSalles[nomSalle].author,
        purpose: purpose,
        duree: dureeMin,
        horaire: `${heureDebutStr} - ${heureFinStr}`,
        date: new Date().toLocaleDateString('fr-FR')
    });

    programmerAlertes(nomSalle, end);

    sauvegarderDonnees();
    verifierEtRafraichir();
    if (roleActuel === "ADMIN") rafraichirHistoriqueUI();
    fermerFormulaire();
});

// 6. Alertes basées sur le temps absolu jusqu'à l'heure de fin
function programmerAlertes(nomSalle, endTime) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const msAvantFin = endTime - Date.now();

    // Alerte -10 min
    const delay10 = msAvantFin - (10 * 60 * 1000);
    if (delay10 > 0) {
        setTimeout(() => {
            new Notification("Bokutani - Rappel", {
                body: `La session dans la ${nomSalle} se termine dans 10 minutes.`
            });
        }, delay10);
    }

    // Alerte -5 min
    const delay5 = msAvantFin - (5 * 60 * 1000);
    if (delay5 > 0) {
        setTimeout(() => {
            new Notification("Bokutani - Libération Imminente", {
                body: `Attention : la ${nomSalle} doit être libérée dans 5 minutes !`
            });
        }, delay5);
    }
}

// 7. Annulation par Code PIN
function demanderAnnulation(nomSalle) {
    const salle = etatSalles[nomSalle];
    const pinSaisi = prompt(`Entrez votre code PIN à 4 chiffres pour annuler la réservation de ${nomSalle} :`);

    if (pinSaisi === salle.pin || roleActuel === "ADMIN") {
        etatSalles[nomSalle] = { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, pin: "" };
        sauvegarderDonnees();
        verifierEtRafraichir();
        alert(`${nomSalle} a été libérée avec succès.`);
    } else if (pinSaisi !== null) {
        alert("Code PIN incorrect. Opération refusée.");
    }
}

// 8. Nettoyage et Affichage UI
function verifierEtRafraichir() {
    const maintenant = Date.now();

    Object.keys(etatSalles).forEach(nomSalle => {
        const salle = etatSalles[nomSalle];

        // Libération automatique à la fin du créneau
        if (salle.endTime && maintenant >= salle.endTime) {
            etatSalles[nomSalle] = { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, pin: "" };
            sauvegarderDonnees();
        }

        rafraichirSalleUI(nomSalle);
    });
}

function rafraichirSalleUI(nomSalle) {
    const key = nomSalle.toLowerCase().replace(" ", "-");
    const salle = etatSalles[nomSalle];

    const badge = document.getElementById(`status-${key}`);
    const details = document.getElementById(`details-${key}`);
    const btnCancel = document.getElementById(`btn-cancel-${key}`);

    if (!badge || !details || !btnCancel) return;

    if (salle.status === "Libre") {
        badge.innerText = "Libre";
        badge.className = "status badge-libre";
        details.classList.add("hidden");
        btnCancel.classList.add("hidden");
    } else {
        badge.innerText = salle.status;
        badge.className = "status " + (salle.status === "Occupée" ? "badge-occupee" : "badge-maintenance");

        const msRestants = salle.endTime - Date.now();
        const minRestantes = Math.max(0, Math.ceil(msRestants / 60000));

        details.innerHTML = `
            <strong>Auteur :</strong> ${salle.author}<br>
            <strong>Motif :</strong> ${salle.purpose}<br>
            <strong>Horaire :</strong> ${salle.horaire}<br>
            <strong>Temps restant :</strong> ~${minRestantes} min
        `;
        details.classList.remove("hidden");
        btnCancel.classList.remove("hidden");
    }
}

function rafraichirHistoriqueUI() {
    const liste = document.getElementById("historique-liste");
    if (!liste) return;

    liste.innerHTML = "";
    historiqueGlobal.forEach(item => {
        const li = document.createElement("li");
        li.innerText = `[${item.date}] ${item.salle} | ${item.type} par ${item.author} (${item.horaire}) - ${item.purpose}`;
        liste.appendChild(li);
    });
}

// 9. Génération du PDF
function genererPDFHebdomadaire() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(2, 16, 104);
    doc.text("BOKUTANI - Compte-Rendu Hebdomadaire", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Rapport édité le : ${new Date().toLocaleString('fr-FR')}`, 14, 28);
    doc.text("--------------------------------------------------------------------------------------------------", 14, 33);

    let y = 42;
    if (historiqueGlobal.length === 0) {
        doc.text("Aucun enregistrement disponible pour cette période.", 14, y);
    } else {
        historiqueGlobal.forEach((item, i) => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(`${i + 1}. ${item.salle} - ${item.type} | Responsable: ${item.author}`, 14, y);
            doc.text(`   Motif: ${item.purpose} | Plage: ${item.horaire} (${item.duree} min) | Date: ${item.date}`, 14, y + 6);
            y += 14;
        });
    }

    doc.save("Bokutani_Rapport_Hebdomadaire.pdf");
}