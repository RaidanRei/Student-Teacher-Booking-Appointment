console.log("rules.js loaded");

// ======================================================
// 🔧 GLOBAL HELPER FUNCTIONS
// ======================================================
const el = (id) => document.getElementById(id);
const page = window.location.pathname.split("/").pop();

// Utility function to show a simple alert/toast
const showToast = (message) => {
  alert(message);
};

// ======================================================
// 🛑 FIREBASE VARIABLES
// The variables 'auth' (Firebase Auth) and 'db' (Firestore)
// are assumed to be defined globally in all HTML files.
// Realtime Database is explicitly NOT used in this project.
// ======================================================

// The user data stored in Session Storage after login
let user = sessionStorage.getItem("currentUser")
  ? JSON.parse(sessionStorage.getItem("currentUser"))
  : null;

/**
 * Handles user logout across all pages. 🚪
 */
function handleLogout() {
  // 'auth' is assumed to be defined globally in the HTML script tag
  auth
    .signOut()
    .then(() => {
      sessionStorage.removeItem("currentUser");
      window.location.href = "index.html";
    })
    .catch((error) => {
      showToast("Error logging out: " + error.message);
    });
}

/**
 * Checks if the user is authenticated and redirects if not.
 * Also handles routing based on user role after a successful login.
 */
function checkAuth() {
  // If the page is a dashboard but no user is logged in, redirect to index
  if (page !== "index.html" && !user) {
    window.location.href = "index.html";
    return;
  }

  // Set the logout button event listener for all dashboard pages
  if (el("btn-logout")) {
    el("btn-logout").addEventListener("click", handleLogout);
  }

  // Handle routing based on user role
  if (page !== "index.html" && user) {
    if (user.role === "Admin" && page !== "admin.html") {
      window.location.href = "admin.html";
    } else if (user.role === "Teacher" && page !== "teacher.html") {
      window.location.href = "teacher.html";
    } else if (user.role === "Student" && page !== "student.html") {
      window.location.href = "student.html";
    }

    // Initialize dashboard-specific data
    if (page === "admin.html") initAdmin();
    if (page === "teacher.html") initTeacher();
    if (page === "student.html") initStudent();
  }

  // If on the index page, set up login/register listeners
  if (page === "index.html") {
    setupAuthListeners();
  }
}

/**
 * Finds and updates the copyright year in the footer.
 */
function updateFooterYear() {
  const yearElement = el("year");
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
}

// ======================================================
// 👨‍💻 USER AUTHENTICATION & REGISTRATION (index.html)
// ======================================================

/**
 * Sets up event listeners for login and register buttons.
 */
function setupAuthListeners() {
  el("btn-login")?.addEventListener("click", handleLogin);
  el("btn-register")?.addEventListener("click", handleRegister);
}

/**
 * Handles the login process. 🔑
 */
function handleLogin() {
  const email = el("login-email").value;
  const password = el("login-password").value;

  if (!email || !password) {
    showToast("Please enter both email and password.");
    return;
  }

  // 1. Authenticate with Firebase Auth
  auth
    .signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const firebaseUser = userCredential.user;

      // 2. Fetch user data from Firestore
      db.collection("users")
        .doc(firebaseUser.uid)
        .get()
        .then((doc) => {
          if (doc.exists) {
            // Save user data to session storage
            const userData = { uid: firebaseUser.uid, ...doc.data() };
            sessionStorage.setItem("currentUser", JSON.stringify(userData));

            // Redirect based on role
            if (userData.role === "Admin") {
              window.location.href = "admin.html";
            } else if (userData.role === "Teacher") {
              window.location.href = "teacher.html";
            } else if (userData.role === "Student") {
              window.location.href = "student.html";
            } else {
              showToast("Error: Unknown user role.");
              auth.signOut(); // Log out unrecognized user
            }
          } else {
            showToast("User data not found in Firestore.");
            auth.signOut();
          }
        })
        .catch((error) => {
          showToast("Error fetching user data: " + error.message);
          auth.signOut();
        });
    })
    .catch((error) => {
      showToast("Login failed: " + error.message);
    });
}

/**
 * Handles the user registration process. 📝
 */
function handleRegister() {
  const name = el("reg-name").value;
  const email = el("reg-email").value;
  const password = el("reg-password").value;
  const role = el("reg-role").value;

  if (!name || !email || !password || !role) {
    showToast("Please fill in all registration fields.");
    return;
  }

  // 1. Create user in Firebase Auth
  auth
    .createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const firebaseUser = userCredential.user;

      // 2. Save additional user data to Firestore
      db.collection("users")
        .doc(firebaseUser.uid)
        .set({
          name: name,
          email: email,
          role: role,
          department: role === "Teacher" ? "N/A" : null, // Default value for Teacher/Student
          subject: role === "Teacher" ? "N/A" : null,
        })
        .then(() => {
          showToast(
            `Registration successful! You are registered as a ${role}. Please login.`
          );
          // Auto-logout after registration to force a clean login
          auth.signOut();
        });
    })
    .catch((error) => {
      showToast("Registration failed: " + error.message);
    });
}

// ======================================================
// 👑 ADMIN DASHBOARD LOGIC (admin.html)
// ======================================================

/**
 * Initializes the Admin dashboard data and listeners.
 */
function initAdmin() {
  el("admin-name").textContent = user?.name || "Admin";
  el("admin-email").textContent = user?.email || "admin@school.com";

  el("btn-add-teacher")?.addEventListener("click", addTeacher);
  loadAllTeachers();
  loadAllAppointments();
}

/**
 * Adds a new teacher user and saves their role/details to Firestore. ➕
 */
function addTeacher() {
  const name = el("t-name").value;
  const dept = el("t-dept").value;
  const subject = el("t-subject").value;
  const email = el("t-email").value;
  const password = el("t-password").value;

  if (!name || !dept || !subject || !email || !password) {
    showToast("Please fill in all teacher details.");
    return;
  }

  // 1. Create user in Firebase Auth
  auth
    .createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const firebaseUser = userCredential.user;

      // 2. Save teacher data to Firestore
      db.collection("users")
        .doc(firebaseUser.uid)
        .set({
          name: name,
          email: email,
          role: "Teacher",
          department: dept,
          subject: subject,
        })
        .then(() => {
          showToast(`Teacher ${name} added successfully!`);
          el("t-name").value =
            el("t-dept").value =
            el("t-subject").value =
            el("t-email").value =
            el("t-password").value =
              "";
          loadAllTeachers(); // Refresh list
        });
    })
    .catch((error) => {
      showToast("Error adding teacher: " + error.message);
    });
}

/**
 * Loads and displays all teacher data from Firestore.
 */
function loadAllTeachers() {
  const teacherList = el("teacher-list");
  if (!teacherList) return;

  teacherList.innerHTML = "Loading teachers...";

  db.collection("users")
    .where("role", "==", "Teacher")
    .get()
    .then((querySnapshot) => {
      let html = "";
      querySnapshot.forEach((doc) => {
        const t = doc.data();
        html += `
                    <div class="teacher-item">
                        <p><strong>👨‍🏫|👩‍🏫 ${t.name}</strong></p>
                        <p>📧 ${t.email}</p>
                        <p>🏫 Dept: ${t.department}</p>
                        <p>📚 Subject: ${t.subject}</p>
                    </div>
                `;
      });
      teacherList.innerHTML = html || "<p>No teachers found.</p>";
    })
    .catch((error) => {
      teacherList.innerHTML = `<p>Error loading teachers: ${error.message}</p>`;
    });
}

/**
 * Loads and displays all appointments for admin view.
 */
function loadAllAppointments() {
  const apptList = el("all-appointments");
  if (!apptList) return;

  apptList.innerHTML = "Loading appointments...";

  db.collection("appointments")
    .orderBy("date", "asc")
    .orderBy("time", "asc")
    .get()
    .then((querySnapshot) => {
      let html = "";
      querySnapshot.forEach((doc) => {
        const appt = doc.data();
        const docId = doc.id;
        const statusClass =
          appt.status === "Approved"
            ? "approved"
            : appt.status === "Rejected"
            ? "rejected"
            : "pending";

        html += `
                    <div class="appointment-item ${statusClass}">
                        <p>🧑‍🎓|👩‍🎓 Student: <strong>${appt.studentName}</strong> (${appt.studentEmail})</p>
                        <p>👨‍🏫|👩‍🏫 Teacher: <strong>${appt.teacherName}</strong> (${appt.teacherSubject})</p>
                        <p>📅 Date/Time: ${appt.date} @ ${appt.time}</p>
                        <p>➡️ Status: <strong>${appt.status}</strong></p>
                    </div>
                `;
      });
      apptList.innerHTML = html || "<p>No appointments found.</p>";
    })
    .catch((error) => {
      apptList.innerHTML = `<p>Error loading appointments: ${error.message}</p>`;
    });
}

// ======================================================
// 👨‍🏫 TEACHER DASHBOARD LOGIC (teacher.html)
// ======================================================

/**
 * Initializes the Teacher dashboard data and listeners.
 */
function initTeacher() {
  el("teacher-name").textContent = user?.name || "Teacher";
  el("teacher-email").textContent = user?.email || "teacher@school.com";
  el("teacher-dept").textContent = user?.department || "N/A";
  el("teacher-subject").textContent = user?.subject || "N/A";

  loadTeacherAppointments();
}

/**
 * Loads appointments specifically for the logged-in teacher.
 */
function loadTeacherAppointments() {
  const apptList = el("teacher-appointments");
  if (!apptList) return;

  apptList.innerHTML = "Loading appointments...";

  db.collection("appointments")
    .where("teacherEmail", "==", user.email)
    .orderBy("date", "asc")
    .orderBy("time", "asc")
    .onSnapshot(
      (querySnapshot) => {
        let html = "";
        querySnapshot.forEach((doc) => {
          const appt = doc.data();
          const docId = doc.id;
          const statusClass =
            appt.status === "Approved"
              ? "approved"
              : appt.status === "Rejected"
              ? "rejected"
              : "pending";

          html += `
                        <div class="appointment-item ${statusClass}">
                            <p>🧑‍🎓|👩‍🎓 Student: <strong>${
                              appt.studentName
                            }</strong> (${appt.studentEmail})</p>
                            <p>📅 Date/Time: ${appt.date} @ ${appt.time}</p>
                            <p>➡️ Status: <strong>${appt.status}</strong></p>
                            ${
                              appt.status === "Pending"
                                ? `
                                <button onclick="updateAppointmentStatus('${docId}', 'Approved')" class="approve">✅ Approve</button>
                                <button onclick="updateAppointmentStatus('${docId}', 'Rejected')" class="reject">❌ Reject</button>
                                `
                                : ""
                            }
                        </div>
                    `;
        });
        apptList.innerHTML =
          html || "<p>You have no appointments requests.</p>";
      },
      (error) => {
        apptList.innerHTML = `<p>Error loading appointments: ${error.message}</p>`;
      }
    );
}

/**
 * Updates the status of an appointment (Approved/Rejected).
 * This function needs to be global because it's called directly from the HTML onclick.
 */
window.updateAppointmentStatus = function (docId, newStatus) {
  if (
    !confirm(
      `Are you sure you want to change this appointment status to ${newStatus}?`
    )
  )
    return;

  db.collection("appointments")
    .doc(docId)
    .update({ status: newStatus })
    .then(() => {
      showToast(`Appointment successfully ${newStatus.toLowerCase()}.`);
      // The loadTeacherAppointments() uses onSnapshot, so it will refresh automatically
    })
    .catch((error) => {
      showToast(`Error updating appointment: ${error.message}`);
    });
};

// ======================================================
// 🧑‍🎓 STUDENT DASHBOARD LOGIC (student.html)
// ======================================================

/**
 * Initializes the Student dashboard data and listeners.
 */
function initStudent() {
  el("student-name").textContent = user?.name || "Student";
  el("student-email").textContent = user?.email || "student@school.com";

  el("btn-request-appt")?.addEventListener("click", requestAppointment);

  // Initialize Student dashboard data loads
  loadTeachers();
  loadMyAppointments();
  // loadMyMessages(); // ⚠️ DELETED: Removed Realtime Database message logic
}

/**
 * Loads all available teachers to populate the dropdown list.
 */
function loadTeachers() {
  const teacherSelect = el("teacher-select");
  if (!teacherSelect) return;

  teacherSelect.innerHTML = '<option value="">Loading teachers...</option>';

  db.collection("users")
    .where("role", "==", "Teacher")
    .get()
    .then((querySnapshot) => {
      let options =
        '<option value="" disabled selected>-- Select Teacher --</option>';
      querySnapshot.forEach((doc) => {
        const t = doc.data();
        options += `<option value="${t.email}" data-name="${t.name}" data-subject="${t.subject}">${t.name} (${t.subject})</option>`;
      });
      teacherSelect.innerHTML = options;
    })
    .catch((error) => {
      teacherSelect.innerHTML =
        '<option value="">Error loading teachers</option>';
      console.error("Error loading teachers: ", error);
    });
}

/**
 * Handles the student requesting a new appointment. 🙋‍♀️
 */
function requestAppointment() {
  const teacherSelect = el("teacher-select");
  const teacherEmail = teacherSelect.value;
  const date = el("appt-date").value;
  const time = el("appt-time").value;
  const reason = el("appt-reason").value;

  if (!teacherEmail || !date || !time || !reason) {
    showToast("Please fill in all appointment details.");
    return;
  }

  // Get selected teacher's full name and subject from the dropdown options
  const selectedOption = teacherSelect.options[teacherSelect.selectedIndex];
  const teacherName = selectedOption.getAttribute("data-name");
  const teacherSubject = selectedOption.getAttribute("data-subject");

  // Save appointment request to Firestore
  db.collection("appointments")
    .add({
      studentUid: user.uid,
      studentName: user.name,
      studentEmail: user.email,
      teacherEmail: teacherEmail,
      teacherName: teacherName,
      teacherSubject: teacherSubject,
      date: date,
      time: time,
      reason: reason,
      status: "Pending", // Default status
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => {
      showToast(
        "Appointment request sent successfully! Awaiting teacher approval."
      );
      loadMyAppointments(); // Refresh the list
    })
    .catch((error) => {
      showToast("Error sending appointment request: " + error.message);
    });
}

/**
 * Loads and displays the logged-in student's appointments.
 */
function loadMyAppointments() {
  const apptList = el("my-appointments");
  if (!apptList) return;

  apptList.innerHTML = "Loading appointments...";

  db.collection("appointments")
    .where("studentEmail", "==", user.email)
    .orderBy("date", "asc")
    .orderBy("time", "asc")
    .onSnapshot(
      (querySnapshot) => {
        let html = "";
        querySnapshot.forEach((doc) => {
          const appt = doc.data();
          const docId = doc.id;
          const statusClass =
            appt.status === "Approved"
              ? "approved"
              : appt.status === "Rejected"
              ? "rejected"
              : "pending";

          html += `
                        <div class="appointment-item ${statusClass}">
                            <p>👨‍🏫|👩‍🏫 Teacher: <strong>${
                              appt.teacherName
                            }</strong> (${appt.teacherSubject})</p>
                            <p>📅 Date/Time: ${appt.date} @ ${appt.time}</p>
                            <p>➡️ Status: <strong>${appt.status}</strong></p>
                            <p>📝 Reason: ${appt.reason}</p>
                            ${
                              appt.status === "Pending"
                                ? `<button onclick="cancelAppointment('${docId}')" class="reject">❌ Cancel Request</button>`
                                : ""
                            }
                        </div>
                    `;
        });
        apptList.innerHTML =
          html || "<p>You have no scheduled appointments.</p>";
      },
      (error) => {
        apptList.innerHTML = `<p>Error loading appointments: ${error.message}</p>`;
      }
    );
}

/**
 * Allows the student to cancel a pending appointment request. ❌
 * This function needs to be global because it's called directly from the HTML onclick.
 */
window.cancelAppointment = function (docId) {
  if (!confirm("Are you sure you want to cancel this appointment request?"))
    return;

  db.collection("appointments")
    .doc(docId)
    .delete()
    .then(() => {
      showToast("Appointment successfully canceled.");
      // The loadMyAppointments() uses onSnapshot, so it will refresh automatically
    })
    .catch((error) => {
      showToast(`Error cancelling appointment: ${error.message}`);
    });
};

// ======================================================
// 🚀 INITIALIZATION
// ======================================================
checkAuth();
updateFooterYear();
