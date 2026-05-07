// ============================================================
// EXAM PORTAL — config.js
// Central configuration. Import in every HTML page.
// Replace YOUR_PROJECT_URL and YOUR_ANON_KEY with your values.
// ============================================================

const CONFIG = {

  // ── Supabase credentials ──────────────────────────────────
  // Replace these two values with your own from Supabase
  // Settings → API → Project URL and anon/public key
  SUPABASE_URL:      'https://bxdwliykrkxayqgoonjd.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4ZHdsaXlrcmt4YXlxZ29vbmpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzg4MTEsImV4cCI6MjA5MTkxNDgxMX0.FouzJOGjtGuud9bFHByvJ5WJItmo1USF7Ojiqm-2_70',

  // ── App info ──────────────────────────────────────────────
  APP_NAME:    'Exam Portal',
  APP_VERSION: '1.0.0',

  // ── Roles ────────────────────────────────────────────────
  ROLES: {
    SUPER_ADMIN:   'super_admin',
    BRANCH_ADMIN:  'branch_admin',
    MANAGEMENT:    'management',
  },

  // ── Role → page redirect map ─────────────────────────────
  ROLE_HOME: {
    super_admin:  'super-admin.html',
    branch_admin: 'branch-admin.html',
    management:   'dashboard.html',
  },

  // ── Mediums ───────────────────────────────────────────────
  MEDIUMS: [
    { code: 'CB', label: 'CBSE' },
    { code: 'IC', label: 'ICSE' },
    { code: 'EM', label: 'SSC English Medium' },
    { code: 'SE', label: 'SSC Semi-English' },
  ],

  // ── Board type lookup (for rate card) ────────────────────
  MEDIUM_TO_BOARD: {
    CB: 'CBSE_ICSE',
    IC: 'CBSE_ICSE',
    EM: 'SSC',
    SE: 'SSC',
  },

  // ── Standards ────────────────────────────────────────────
  STANDARDS: [7, 8, 9, 10],

  // ── Exam types (parsed from ExamName prefix in CSV) ───────
  EXAM_TYPES: [
    { code: 'BT',  label: 'Basic Test' },
    { code: 'WT',  label: 'Weekly Test' },
    { code: 'UT',  label: 'Unit Test' },
    { code: 'SEM', label: 'Semester Exam' },
    { code: 'PRE', label: 'Prelim' },
    { code: 'SA',  label: 'Subject Assessment' },
    { code: 'RTY', label: 'Retry' },
    { code: 'MCQ', label: 'MCQ' },
  ],

  // ── Split types ───────────────────────────────────────────
  SPLIT_TYPES: [
    { code: 'A', label: 'Type A — Papers split between correctors' },
    { code: 'B', label: 'Type B — Same papers, different sections' },
  ],

  // ── Date rules ────────────────────────────────────────────
  DATE_RULES: {
    // Papers sent date: exam_date to exam_date + 5 days
    PAPERS_SENT_MAX_DAYS:    5,
    // Delivered on: papers_sent_date to papers_sent_date + 2 days
    DELIVERED_MAX_DAYS:      2,
    // Due date (auto): based on section_marks
    DUE_DATE_BRACKETS: [
      { max_marks: 20,  days: 4  },
      { max_marks: 50,  days: 8  },
      { max_marks: 999, days: 10 },
    ],
  },

  // ── ERP CSV column mapping ────────────────────────────────
  // Maps CSV column headers to our DB field names
  CSV_MAP: {
    ExamName:        'exam_ref',
    Batch:           'batch',
    Branch:          'branch_name',     // matched to branches table by name
    SubjectOnly:     'subject',
    examDate:        'exam_date',
    startTime:       'from_time',       // minutes since midnight → HH:MM
    toTime:          'to_time',         // minutes since midnight → HH:MM
    AcStatus:        'erp_status',
    Standard:        'standard',
    Medium:          'medium',
    numberOfStudent: 'students_present', // pre-fill if > 0
  },

  // ── ERP status display labels ─────────────────────────────
  ERP_STATUS_LABELS: {
    'completed':               'Completed',
    'Exam Without Result':     'No Result',
    'Exam Without Attendance': 'No Attendance',
  },

  // ── Exam status badges ────────────────────────────────────
  // Derived from corrector_batches state
  EXAM_STATUS: {
    PENDING:    { label: 'Pending',     class: 'badge-pending'  },
    IN_PROGRESS:{ label: 'In Progress', class: 'badge-progress' },
    OVERDUE:    { label: 'Overdue',     class: 'badge-overdue'  },
    COMPLETE:   { label: 'Complete',    class: 'badge-complete' },
  },

};

// ── Helper: minutes since midnight → HH:MM string ────────────
function minsToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// ── Helper: parse exam type from ExamName prefix ─────────────
function parseExamType(examName) {
  if (!examName) return '';
  const match = examName.match(/^([A-Za-z]+)/);
  if (!match) return examName;
  const prefix = match[1].toUpperCase();
  const found = CONFIG.EXAM_TYPES.find(e => e.code === prefix);
  return found ? found.label : prefix;
}

// ── Helper: auto-calculate due date ─────────────────────────
function calcDueDate(deliveredOnStr, sectionMarks) {
  if (!deliveredOnStr || !sectionMarks) return '';
  const d = new Date(deliveredOnStr);
  let days = 10;
  for (const bracket of CONFIG.DATE_RULES.DUE_DATE_BRACKETS) {
    if (sectionMarks <= bracket.max_marks) { days = bracket.days; break; }
  }
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Helper: format date DD/MM/YYYY ───────────────────────────
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Helper: days overdue (positive = overdue) ─────────────────
function daysOverdue(dueDateStr) {
  if (!dueDateStr) return 0;
  const today = new Date(); today.setHours(0,0,0,0);
  const due   = new Date(dueDateStr);
  return Math.floor((today - due) / 86400000);
}

// ── Helper: get medium label ─────────────────────────────────
function getMediumLabel(code) {
  const m = CONFIG.MEDIUMS.find(x => x.code === code);
  return m ? m.label : code;
}

// ── Helper: get exam type label ──────────────────────────────
function getExamTypeLabel(code) {
  const e = CONFIG.EXAM_TYPES.find(x => x.code === code);
  return e ? e.label : code;
}

// ── Toast notification ───────────────────────────────────────
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Set button loading state ─────────────────────────────────
function setLoading(btn, loading, label = 'Save') {
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Saving...`;
  } else {
    btn.disabled = false;
    btn.innerHTML = label;
  }
}
