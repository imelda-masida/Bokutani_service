// 1. Authentification Admin & Gestion du Rôle
let motDePasseAdmin = localStorage.getItem("bokutani_admin_pass") || "admin123";
let dernierRoleValide = "UTILISATEUR";
let roleActuel = "UTILISATEUR";

// 2. Chargement de l'état initial depuis le localStorage
let etatSalles = JSON.parse(localStorage.getItem('bokutani_salles')) || {
    "SALLE A": { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, horaire: "", pin: "" },
    "SALLE B": { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, horaire: "", pin: "" },
    "SALLE C": { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, horaire: "", pin: "" }
};

let historiqueGlobal = JSON.parse(localStorage.getItem('bokutani_historique')) || [];

// 3. Initialisation au chargement de la page
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

// 4. Gestion des Rôles et Espaces
function changerRole() {
    const select = document.getElementById("user-role");
    const nouveauRole = select.value;

    if (nouveauRole === "ADMIN") {
        const motDePasseSaisi = prompt("Accès Administrateur : Veuillez entrer le mot de passe de sécurité :");

        if (motDePasseSaisi !== motDePasseAdmin) {
            alert("Mot de passe incorrect ou accès annulé.");
            select.value = dernierRoleValide;
            return;
        }
    }

    roleActuel = nouveauRole;
    dernierRoleValide = nouveauRole;

    const userView = document.getElementById("user-view");
    const adminPanel = document.getElementById("admin-panel");

    if (roleActuel === "ADMIN") {
        if (userView) userView.classList.add("hidden");
        if (adminPanel) adminPanel.classList.remove("hidden");
        rafraichirDashboardAdmin();
    } else {
        if (adminPanel) adminPanel.classList.add("hidden");
        if (userView) userView.classList.remove("hidden");
        verifierEtRafraichir();
    }
}

// 5. Modale (Ouverture / Fermeture)
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

// 6. Soumission du Formulaire (Heure de début et de fin)
document.getElementById("booking-form").addEventListener("submit", function (e) {
    e.preventDefault();

    const nomSalle = document.getElementById("salle-nom").value;
    const author = document.getElementById("auteur").value.trim();
    const purpose = document.getElementById("motif").value.trim();
    const heureDebutStr = document.getElementById("heure-debut").value;
    const heureFinStr = document.getElementById("heure-fin").value;
    const pin = document.getElementById("pin-code").value.trim();
    const deptSelect = document.getElementById("dept-select");
    const dept = deptSelect ? deptSelect.value : "N/A";

    const aujourdhui = new Date();
    const [hDebut, mDebut] = heureDebutStr.split(":").map(Number);
    const [hFin, mFin] = heureFinStr.split(":").map(Number);

    const start = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate(), hDebut, mDebut).getTime();
    const end = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate(), hFin, mFin).getTime();

    if (end <= start) {
        alert("L'heure de fin doit être supérieure à l'heure de début.");
        return;
    }

    const dureeMin = Math.round((end - start) / (1000 * 60));

    const salleActuelle = etatSalles[nomSalle];
    if (salleActuelle.status !== "Libre" && Date.now() < salleActuelle.endTime) {
        alert("Conflit ! La salle est déjà occupée sur cette période.");
        return;
    }

    const maintenanceMode = (roleActuel === "MAINTENANCE");
    const statusText = maintenanceMode ? "Maintenance" : "Occupée";
    const typeAction = maintenanceMode ? "MAINTENANCE" : "REUNION";

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

    if (roleActuel === "ADMIN") rafraichirDashboardAdmin();
    fermerFormulaire();
});

// 7. Alertes de fin de session
function programmerAlertes(nomSalle, endTime) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const msAvantFin = endTime - Date.now();

    const delay10 = msAvantFin - (10 * 60 * 1000);
    if (delay10 > 0) {
        setTimeout(() => {
            new Notification("Bokutani - Rappel", {
                body: `La session dans la ${nomSalle} se termine dans 10 minutes.`
            });
        }, delay10);
    }

    const delay5 = msAvantFin - (5 * 60 * 1000);
    if (delay5 > 0) {
        setTimeout(() => {
            new Notification("Bokutani - Libération Imminente", {
                body: `Attention : la ${nomSalle} doit être libérée dans 5 minutes !`
            });
        }, delay5);
    }
}

// 8. Annulation de Réservation / Libération de Salle
function demanderAnnulation(nomSalle) {
    const salle = etatSalles[nomSalle];

    if (roleActuel === "ADMIN") {
        if (confirm(`Êtes-vous sûr de vouloir libérer immédiatement ${nomSalle} ?`)) {
            etatSalles[nomSalle] = { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, horaire: "", pin: "" };
            sauvegarderDonnees();
            verifierEtRafraichir();
            if (roleActuel === "ADMIN") rafraichirDashboardAdmin();
            alert(`${nomSalle} a été libérée.`);
        }
        return;
    }

    const pinSaisi = prompt(`Entrez votre code PIN à 4 chiffres pour annuler la réservation de ${nomSalle} :`);

    if (pinSaisi === salle.pin) {
        etatSalles[nomSalle] = { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, horaire: "", pin: "" };
        sauvegarderDonnees();
        verifierEtRafraichir();
        alert(`${nomSalle} a été libérée avec succès.`);
    } else if (pinSaisi !== null) {
        alert("Code PIN incorrect. Opération refusée.");
    }
}

// 9. Rafraîchissement de l'UI Utilisateur
function verifierEtRafraichir() {
    const maintenant = Date.now();

    Object.keys(etatSalles).forEach(nomSalle => {
        const salle = etatSalles[nomSalle];

        if (salle.endTime && maintenant >= salle.endTime) {
            etatSalles[nomSalle] = { status: "Libre", author: "", purpose: "", type: "", dept: "", startTime: null, endTime: null, horaire: "", pin: "" };
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

// 10. Dashboard Administrateur
function rafraichirDashboardAdmin() {
    document.getElementById("stat-total-res").innerText = historiqueGlobal.length;
    
    let occupesCount = 0;
    Object.keys(etatSalles).forEach(salle => {
        if (etatSalles[salle].status !== "Libre") occupesCount++;
    });
    document.getElementById("stat-salles-occupees").innerText = `${occupesCount} / 3`;

    const sallesControl = document.getElementById("admin-salles-list");
    sallesControl.innerHTML = "";

    Object.keys(etatSalles).forEach(nomSalle => {
        const salle = etatSalles[nomSalle];
        const card = document.createElement("div");
        card.className = "admin-salle-card";
        
        card.innerHTML = `
            <div>
                <strong>${nomSalle}</strong> - 
                <span class="status ${salle.status === 'Libre' ? 'badge-libre' : (salle.status === 'Occupée' ? 'badge-occupee' : 'badge-maintenance')}">${salle.status}</span>
                ${salle.status !== 'Libre' ? `<br><small>${salle.author} (${salle.horaire}) - ${salle.purpose}</small>` : ''}
            </div>
            ${salle.status !== 'Libre' ? `<button onclick="demanderAnnulation('${nomSalle}')" class="btn-cancel-sm">Forcer la libération</button>` : '<em>Aucune action requise</em>'}
        `;
        sallesControl.appendChild(card);
    });

    rafraichirHistoriqueUI();
}

function rafraichirHistoriqueUI() {
    const liste = document.getElementById("historique-liste");
    if (!liste) return;

    liste.innerHTML = "";
    historiqueGlobal.forEach((item, index) => {
        const li = document.createElement("li");
        li.className = "history-item";

        li.innerHTML = `
            <span>[${item.date}] <strong>${item.salle}</strong> | ${item.type} par ${item.author} (${item.horaire}) - ${item.purpose}</span>
            <button onclick="supprimerHistorique(${index})" class="btn-delete-item">Supprimer</button>
        `;
        liste.appendChild(li);
    });
}

function supprimerHistorique(index) {
    if (confirm("Voulez-vous supprimer cette ligne de l'historique ?")) {
        historiqueGlobal.splice(index, 1);
        sauvegarderDonnees();
        rafraichirDashboardAdmin();
    }
}

function viderToutLHistorique() {
    if (historiqueGlobal.length === 0) {
        alert("L'historique est déjà vide.");
        return;
    }

    if (confirm("Êtes-vous sûr de vouloir effacer TOUT l'historique ? Cette action est irréversible.")) {
        historiqueGlobal = [];
        sauvegarderDonnees();
        rafraichirDashboardAdmin();
        alert("L'historique a été entièrement effacé.");
    }
}

function modifierMotDePasseAdmin(event) {
    event.preventDefault();

    const newPass = document.getElementById("new-pass").value;
    const confirmPass = document.getElementById("confirm-pass").value;

    if (newPass.length < 4) {
        alert("Le mot de passe doit contenir au moins 4 caractères.");
        return;
    }

    if (newPass !== confirmPass) {
        alert("Les mots de passe ne correspondent pas.");
        return;
    }

    motDePasseAdmin = newPass;
    localStorage.setItem("bokutani_admin_pass", newPass);

    alert("Le mot de passe Administrateur a été modifié avec succès !");
    document.getElementById("form-change-password").reset();
}

// 11. Génération du PDF
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