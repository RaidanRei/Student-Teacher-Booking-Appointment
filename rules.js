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
// ======================================================

// ================= VALIDATION CHECK =================
if (!auth || !db) {
  console.error("Firebase Auth or Firestore failed to initialize!");
}

// The user data stored in Session Storage after login
let user = sessionStorage.getItem("currentUser")
  ? JSON.parse(sessionStorage.getItem("currentUser"))
  : null;

/**
 * Handles user logout across all pages. 🚪
 */
function handleLogout() {
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
  if (page !== "index.html" && !user) {
    window.location.href = "index.html";
    return;
  }

  if (el("btn-logout")) {
    el("btn-logout").addEventListener("click", handleLogout);
  }

  if (page !== "index.html" && user) {
    if (user.role === "Admin" && page !== "admin.html") {
      window.location.href = "admin.html";
    } else if (user.role === "Teacher" && page !== "teacher.html") {
      window.location.href = "teacher.html";
    } else if (user.role === "Student" && page !== "student.html") {
      window.location.href = "student.html";
    }

    if (page === "admin.html") initAdmin();
    if (page === "teacher.html") initTeacher();
    if (page === "student.html") initStudent();
  }

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
// 👨‍💻 USER AUTHENTICATION & REGISTRATION
// ======================================================
function setupAuthListeners() {
  el("btn-login")?.addEventListener("click", handleLogin);
  el("btn-register")?.addEventListener("click", handleRegister);
}

function handleLogin() {
  const email = el("login-email").value;
  const password = el("login-password").value;

  if (!email || !password) {
    showToast("Please enter both email and password.");
    return;
  }

  auth
    .signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const firebaseUser = userCredential.user;

      db.collection("users")
        .doc(firebaseUser.uid)
        .get()
        .then((doc) => {
          if (doc.exists) {
            const userData = { uid: firebaseUser.uid, ...doc.data() };
            sessionStorage.setItem("currentUser", JSON.stringify(userData));

            if (userData.role === "Admin") {
              window.location.href = "admin.html";
            } else if (userData.role === "Teacher") {
              window.location.href = "teacher.html";
            } else if (userData.role === "Student") {
              window.location.href = "student.html";
            } else {
              showToast("Error: Unknown user role.");
              auth.signOut();
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

function handleRegister() {
  const name = el("reg-name").value;
  const email = el("reg-email").value;
  const password = el("reg-password").value;
  const role = el("reg-role").value;

  if (!name || !email || !password || !role) {
    showToast("Please fill in all registration fields.");
    return;
  }

  auth
    .createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const firebaseUser = userCredential.user;

      db.collection("users")
        .doc(firebaseUser.uid)
        .set({
          name: name,
          email: email,
          role: role,
          department: role === "Teacher" ? "N/A" : null,
          subject: role === "Teacher" ? "N/A" : null,
          status: role === "Student" ? "Pending" : null,
        })
        .then(() => {
          showToast(
            `Registration successful! You are registered as a ${role}. Please login.`
          );
          auth.signOut();
        });
    })
    .catch((error) => {
      showToast("Registration failed: " + error.message);
    });
}

// ======================================================
// 👑 ADMIN DASHBOARD LOGIC
// ======================================================
function initAdmin() {
  if (el("admin-name")) el("admin-name").textContent = user?.name || "Admin";
  if (el("admin-email"))
    el("admin-email").textContent = user?.email || "admin@example.com";

  if (el("btn-add-teacher"))
    el("btn-add-teacher").addEventListener("click", addTeacher);
  if (el("teacher-list")) loadAllTeachers();
  if (el("student-list")) loadPendingStudents();
  if (el("all-appointments")) loadAllAppointments();
}

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

  auth
    .createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const firebaseUser = userCredential.user;

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
          loadAllTeachers();
        });
    })
    .catch((error) => {
      showToast("Error adding teacher: " + error.message);
    });
}

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
        const docId = doc.id;

        html += `
          <div class="teacher-item" id="teacher-${docId}">
            <p>📇Name: <strong>${t.name}</strong></p>
            <p>📧Email: ${t.email}</p>
            <p>🏫Department: ${t.department}</p>
            <p>📚Subject: ${t.subject}</p>
            <button onclick="updateTeacher('${docId}')" class="update">✏️ Update</button>
            <button onclick="deleteTeacher('${docId}')" class="delete">🗑️ Delete</button>
          </div>
        `;
      });

      teacherList.innerHTML = html || "<p>No teachers found.</p>";
    })
    .catch((error) => {
      teacherList.innerHTML = `<p>Error loading teachers: ${error.message}</p>`;
    });
}

function updateTeacher(docId) {
  const name = prompt("Enter new name:");
  if (!name) return;
  const dept = prompt("Enter new department:");
  if (!dept) return;
  const subject = prompt("Enter new subject:");
  if (!subject) return;

  db.collection("users")
    .doc(docId)
    .update({ name, department: dept, subject })
    .then(() => {
      showToast("Teacher updated successfully!");
      loadAllTeachers();
    })
    .catch((error) => {
      showToast("Error updating teacher: " + error.message);
    });
}

function deleteTeacher(docId) {
  if (!confirm("Are you sure you want to delete this teacher?")) return;

  db.collection("users")
    .doc(docId)
    .delete()
    .then(() => {
      showToast("Teacher deleted successfully!");
      loadAllTeachers();
    })
    .catch((error) => {
      showToast("Error deleting teacher: " + error.message);
    });
}

// ======================================================
// 🧑‍🎓 PENDING STUDENTS LOGIC
// ======================================================
function loadPendingStudents() {
  const studentList = el("student-list");
  if (!studentList) return;

  studentList.innerHTML = "Loading pending students...";

  db.collection("users")
    .where("role", "==", "Student")
    .where("status", "==", "Pending")
    .get()
    .then((querySnapshot) => {
      let html = "";
      querySnapshot.forEach((doc) => {
        const s = doc.data();
        const docId = doc.id;

        html += `
          <div class="student-item" id="student-${docId}">
            <p>📇Name: <strong>${s.name}</strong></p>
            <p>📧Email: ${s.email}</p>
            <button onclick="approveStudent('${docId}')" class="approve">✅ Approve Registration</button>
            <button onclick="rejectStudent('${docId}')" class="reject">❌ Reject Registration</button>
          </div>
        `;
      });

      studentList.innerHTML = html || "<p>No pending students found.</p>";
    })
    .catch((error) => {
      studentList.innerHTML = `<p>Error loading students: ${error.message}</p>`;
    });
}

function approveStudent(docId) {
  if (!confirm("Are you sure you want to approve this student?")) return;

  db.collection("users")
    .doc(docId)
    .update({ status: "Active" })
    .then(() => {
      showToast("Student registration approved!");
      loadPendingStudents();
    })
    .catch((error) => {
      showToast("Error approving student: " + error.message);
    });
}

function rejectStudent(docId) {
  if (!confirm("Are you sure you want to reject this student registration?"))
    return;

  db.collection("users")
    .doc(docId)
    .delete()
    .then(() => {
      showToast("Student registration rejected and removed.");
      loadPendingStudents();
    })
    .catch((error) => {
      showToast("Error rejecting student: " + error.message);
    });
}

// ======================================================
// LOAD ADMIN APPOINTMENTS
// ======================================================
function loadAllAppointments() {
  const apptList = el("all-appointments");
  if (!apptList) return;

  apptList.innerHTML = "Loading appointments...";

  db.collection("appointments")
    .orderBy("date", "asc")
    .orderBy("time", "asc")
    .onSnapshot(
      (querySnapshot) => {
        let html = "";
        querySnapshot.forEach((doc) => {
          const appt = doc.data();
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
      },
      (error) => {
        apptList.innerHTML = `<p style="color:red;">Failed to load appointments. Please try again later.</p>`;
      }
    );
}

// ======================================================
// 👨‍🏫 TEACHER DASHBOARD LOGIC
// ======================================================
function initTeacher() {
  el("teacher-name").textContent = user?.name || "Teacher";
  el("teacher-email").textContent = user?.email || "teacher@school.com";
  el("teacher-dept").textContent = user?.department || "N/A";
  el("teacher-subject").textContent = user?.subject || "N/A";

  loadTeacherAppointments();
  loadTeacherMessages();
}

function loadTeacherAppointments() {
  const apptList = el("pending-appointments");
  if (!apptList) return;

  apptList.innerHTML = "Loading appointments...";

  db.collection("appointments")
    .where("teacherEmail", "==", user.email)
    .where("status", "==", "Pending")
    .orderBy("date", "asc")
    .orderBy("time", "asc")
    .onSnapshot((querySnapshot) => {
      let html = "";
      querySnapshot.forEach((doc) => {
        const appt = doc.data();
        html += `
          <div class="appointment-item">
            <p>🧑‍🎓|👩‍🎓 Student: <strong>${appt.studentName}</strong> (${appt.studentEmail})</p>
            <p>📅 Date/Time: ${appt.date} @ ${appt.time}</p>
            <p>📝 Reason: ${appt.reason}</p>
            <button onclick="updateAppointmentStatus('${doc.id}', 'Approved')">✅ Approve</button>
            <button onclick="updateAppointmentStatus('${doc.id}', 'Rejected')">❌ Reject</button>
          </div>
        `;
      });
      apptList.innerHTML = html || "<p>No pending appointments.</p>";
    });
}

function loadTeacherMessages() {
  const msgList = el("message-list");
  if (!msgList) return;

  msgList.innerHTML = "Loading messages from students...";

  db.collection("messages")
    .where("teacherEmail", "==", user.email)
    .orderBy("createdAt", "desc")
    .onSnapshot((querySnapshot) => {
      let html = "";
      querySnapshot.forEach((doc) => {
        const msg = doc.data();
        html += `
          <div class="message-item">
            <p>🧑‍🎓|👩‍🎓 Student: <strong>${msg.studentName}</strong> (${
          msg.studentEmail
        })</p>
            <p>💬 Message: ${msg.content}</p>
            <p>🕒 Sent At: ${
              msg.createdAt?.toDate().toLocaleString() || "Unknown"
            }</p>
            <button onclick="replyToMessage('${doc.id}')">✉️ Reply</button>
          </div>
        `;
      });
      msgList.innerHTML = html || "<p>No messages from students.</p>";
    });
}

window.replyToMessage = function (docId) {
  const reply = prompt("Enter your reply message:");
  if (!reply) return;

  db.collection("messages")
    .doc(docId)
    .update({ teacherReply: reply })
    .then(() => {
      showToast("Reply sent successfully!");
    })
    .catch((error) => {
      showToast("Error sending reply: " + error.message);
    });
};

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
    })
    .catch((error) => {
      showToast(`Error updating appointment: ${error.message}`);
    });
};

// ======================================================
// 🧑‍🎓 STUDENT DASHBOARD LOGIC
// ======================================================
function initStudent() {
  el("student-name").textContent = user?.name || "Student";
  el("student-email").textContent = user?.email || "student@school.com";
  el("student-dept").textContent = user?.department || "N/A";
  el("student-subject").textContent = user?.subject || "N/A";

  el("btn-request-appt")?.addEventListener("click", requestAppointment);
  el("btn-send-msg")?.addEventListener("click", sendMessage);

  loadTeachers();
  loadMyAppointments();
  loadMyMessages();
}

function sendMessage() {
  const teacherSelect = el("teacher-select");
  const content = el("msg-content").value;

  if (!teacherSelect.value || !content) {
    showToast("Please select a teacher and enter a message.");
    return;
  }

  const selectedOption = teacherSelect.options[teacherSelect.selectedIndex];
  const teacherEmail = selectedOption.value;
  const teacherName = selectedOption.getAttribute("data-name");

  db.collection("messages")
    .add({
      studentUid: user.uid,
      studentName: user.name,
      studentEmail: user.email,
      teacherEmail: teacherEmail,
      teacherName: teacherName,
      content: content,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => {
      showToast("Message sent to teacher successfully!");
      el("msg-content").value = "";
    })
    .catch((error) => {
      showToast("Error sending message: " + error.message);
    });
}

function loadMyMessages() {
  const msgList = el("my-messages");
  if (!msgList) return;

  msgList.innerHTML = "Loading messages...";

  db.collection("messages")
    .where("studentEmail", "==", user.email)
    .orderBy("createdAt", "desc")
    .onSnapshot(
      (querySnapshot) => {
        let html = "";
        querySnapshot.forEach((doc) => {
          const msg = doc.data();
          const docId = doc.id;

          html += `
            <div class="message-item" id="msg-${docId}">
              <p>👨‍🏫|👩‍🏫 Teacher: <strong>${msg.teacherName}</strong> (${
            msg.teacherEmail
          })</p>
              <p>💬 Message: ${msg.content}</p>
              <p>🕒 Sent At: ${
                msg.createdAt?.toDate().toLocaleString() || "Unknown"
              }</p>
              ${
                msg.teacherReply
                  ? `<p>✉️ Reply: ${msg.teacherReply}</p>`
                  : `<p>✉️ Reply: Pending</p>`
              }
            </div>
          `;
        });

        msgList.innerHTML = html || "<p>No messages yet.</p>";
      },
      (error) => {
        msgList.innerHTML = `<p>Error loading messages: ${error.message}</p>`;
      }
    );
}

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
    })
    .catch((error) => {
      showToast(`Error updating appointment: ${error.message}`);
    });
};

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

function requestAppointment() {
  const teacherSelect = el("teacher-select");
  const teacherEmail = teacherSelect.value;
  const date = el("appt-date").value;
  const time = el("appt-time").value;
  const reason = el("appt-reason").value;

  // ================= FORM VALIDATION =================
  if (!teacherEmail || !date || !time || !reason) {
    showToast("Please fill in all appointment details.");
    return;
  }

  const selectedOption = teacherSelect.options[teacherSelect.selectedIndex];
  const teacherName = selectedOption.getAttribute("data-name");
  const teacherSubject = selectedOption.getAttribute("data-subject");
  const teacherUid = selectedOption.getAttribute("data-uid"); // <- UID

  db.collection("appointments")
    .add({
      studentUid: user.uid,
      studentName: user.name,
      studentEmail: user.email,
      teacherUid: teacherUid,
      teacherEmail: teacherEmail,
      teacherName: teacherName,
      teacherSubject: teacherSubject,
      date: date,
      time: time,
      reason: reason,
      status: "Pending",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })
    .then(() => {
      showToast(
        "Appointment request sent successfully! Awaiting teacher approval."
      );
      loadMyAppointments();
    })
    .catch((error) => {
      showToast("Error sending appointment request: " + error.message);
    });
}

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
        console.log("Appointments found:", querySnapshot.size);
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
                            <p>📇 Teacher: <strong>${
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

window.cancelAppointment = function (docId) {
  if (!confirm("Are you sure you want to cancel this appointment request?"))
    return;

  db.collection("appointments")
    .doc(docId)
    .delete()
    .then(() => {
      showToast("Appointment successfully canceled.");
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
