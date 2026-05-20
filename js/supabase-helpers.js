// ============================================================
// EXAM PORTAL — supabase-helpers.js
// All database functions. Import after config.js.
// Pages call these functions — no raw SQL in HTML files.
// ============================================================

// ── Initialize Supabase client ───────────────────────────────
const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// ============================================================
// AUTH
// ============================================================

// Login with email + password. Returns { user, role, branch_id }
async function authLogin(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // Fetch user profile (role + branch)
  const profile = await getMyProfile();
  return { user: data.user, ...profile };
}

// Logout
async function authLogout() {
  const { error } = await db.auth.signOut();
  if (error) throw error;
  window.location.href = 'login.html';
}

// Get current session
async function getSession() {
  const { data } = await db.auth.getSession();
  return data.session;
}

// Get current user's profile from users table

async function getMyProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await db
    .from('users')
    .select('id, name, email, role, branch_id, branches(name, code)')
    .eq('id', session.user.id)
    .single();
  if (error) throw error;
  return data;
}

// Guard: redirect to login if not authenticated
async function requireAuth() {
  const session = await getSession();
  if (!session) { window.location.href = 'login.html'; return null; }
  const profile = await getMyProfile();
  return profile;
}

// Guard: redirect if wrong role
async function requireRole(...allowedRoles) {
  const profile = await requireAuth();
  if (!profile) return null;
  if (!allowedRoles.includes(profile.role)) {
    window.location.href = CONFIG.ROLE_HOME[profile.role] || 'login.html';
    return null;
  }
  return profile;
}

// ============================================================
// BRANCHES
// ============================================================

async function getBranches() {
  const { data, error } = await db
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data;
}

async function saveBranch(branch) {
  if (branch.id) {
    const { data, error } = await db
      .from('branches')
      .update({ name: branch.name, code: branch.code, is_active: branch.is_active })
      .eq('id', branch.id)
      .select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await db
      .from('branches')
      .insert({ name: branch.name, code: branch.code })
      .select().single();
    if (error) throw error;
    return data;
  }
}

// ============================================================
// USERS
// ============================================================

async function getUsers() {
  const { data, error } = await db
    .from('users')
    .select('*, branches(name)')
    .order('name');
  if (error) throw error;
  return data;
}

async function createUser(userData) {
  // Step 1: Create auth account via Supabase Admin (done via edge function or manually in dashboard)
  // Step 2: Insert into users table
  const { data, error } = await db
    .from('users')
    .insert({
      id:        userData.auth_id,
      name:      userData.name,
      email:     userData.email,
      role:      userData.role,
      branch_id: userData.branch_id || null,
    })
    .select().single();
  if (error) throw error;
  return data;
}

async function updateUser(id, updates) {
  const { data, error } = await db
    .from('users')
    .update(updates)
    .eq('id', id)
    .select().single();
  if (error) throw error;
  return data;
}

async function toggleUserActive(id, is_active) {
  return updateUser(id, { is_active });
}

// ============================================================
// SUPERVISORS
// ============================================================

async function getSupervisors(activeOnly = true) {
  let query = db
    .from('supervisors')
    .select('*, branches(name)')
    .order('name');
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function saveSupervisor(sup) {
  const payload = {
    name:          sup.name,
    phone:         sup.phone || null,
    branch_id:     sup.branch_id || null,
    rate_per_hour: parseFloat(sup.rate_per_hour) || 0,
    is_active:     sup.is_active !== false,
  };
  if (sup.id) {
    const { data, error } = await db
      .from('supervisors')
      .update(payload)
      .eq('id', sup.id)
      .select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await db
      .from('supervisors')
      .insert(payload)
      .select().single();
    if (error) throw error;
    return data;
  }
}

async function deleteSupervisor(id) {
  const { error } = await db
    .from('supervisors')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
// CORRECTORS
// ============================================================

async function getCorrectors(activeOnly = true) {
  let query = db
    .from('correctors')
    .select('*')
    .order('name');
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function saveCorrector(cor) {
  const payload = {
    name:      cor.name,
    phone:     cor.phone || null,
    is_active: cor.is_active !== false,
  };
  if (cor.id) {
    const { data, error } = await db
      .from('correctors')
      .update(payload)
      .eq('id', cor.id)
      .select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await db
      .from('correctors')
      .insert(payload)
      .select().single();
    if (error) throw error;
    return data;
  }
}

async function deleteCorrector(id) {
  const { error } = await db
    .from('correctors')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
// RATE CARDS
// ============================================================

async function getRateCards() {
  const { data, error } = await db
    .from('rate_cards')
    .select('*')
    .order('board_type, marks_upto');
  if (error) throw error;
  return data;
}

async function updateRateCard(id, rate_per_mark) {
  const { data, error } = await db
    .from('rate_cards')
    .update({ rate_per_mark: parseFloat(rate_per_mark) })
    .eq('id', id)
    .select().single();
  if (error) throw error;
  return data;
}

// ============================================================
// ERP CSV IMPORT
// ============================================================

// Import rows parsed from CSV into exams table.
// Skips duplicates based on (exam_ref, branch_id, batch).
// Returns { imported, skipped }
async function importERPRows(rows, filename, uploadedById) {
  // Get branches map: name → id
  const branches = await getBranches();
  const branchMap = {};
  branches.forEach(b => { branchMap[b.name.toUpperCase()] = b.id; });

  let imported = 0;
  let skipped  = 0;
  const errors = [];

  for (const row of rows) {
    try {
      // Resolve branch
      const branchName = (row.branch_name || '').toUpperCase().trim();
      const branch_id  = branchMap[branchName];
      if (!branch_id) { skipped++; continue; }

      // Parse exam date
      const exam_date = parseERPDate(row.exam_date);
      if (!exam_date) { skipped++; continue; }

      // Convert times (minutes → HH:MM)
      const from_time = minsToTime(parseInt(row.from_time) || 0);
      const to_time   = minsToTime(parseInt(row.to_time)   || 0);
      
      // Auto-calculate actual hours from CSV times
      const actual_hours = ((parseInt(row.to_time) || 0) - (parseInt(row.from_time) || 0)) / 60;
      // Parse marks (mandatory)
      const marks = parseInt(row.marks);
      if (!marks || marks < 1) { skipped++; continue; }
 
      // Parse students present
      const students_present = parseInt(row.students_present) || 0;

      // Parse exam type from exam_ref prefix
      const exam_type = parseExamType(row.exam_ref);

      const examRow = {
        branch_id,
        exam_ref:         row.exam_ref,
        batch:            row.batch,
        standard:         parseInt(row.standard),
        medium:           row.medium,
        subject:          row.subject,
        exam_date,
        from_time,
        to_time,
        exam_type,
        erp_status:       row.erp_status || null,
        students_present: students_present > 0 ? students_present : null,
        actual_hours:     actual_hours > 0 ? actual_hours : null,
        marks,
      };

      // Upsert — skip if duplicate (unique key: exam_ref + branch_id + batch)
      const { error } = await db
        .from('exams')
        .insert(examRow);

      if (error) {
        // Duplicate key error → skip
        if (error.code === '23505') { skipped++; }
        else { errors.push(error.message); skipped++; }
      } else {
        imported++;
      }

    } catch (e) {
      errors.push(e.message);
      skipped++;
    }
  }

  // Log the import
  await db.from('erp_imports').insert({
    uploaded_by:   uploadedById,
    filename:      filename,
    rows_imported: imported,
    rows_skipped:  skipped,
    notes:         errors.length ? errors.slice(0,5).join('; ') : null,
  });

  return { imported, skipped, errors };
}

// Parse ERP date format "3 Apr 2026, 00:00:00" → "2026-04-03"
function parseERPDate(str) {
  if (!str) return null;
  try {
    const clean = str.split(',')[0].trim();
    const d = new Date(clean);
    if (isNaN(d)) return null;
    return d.toISOString().split('T')[0];
  } catch { return null; }
}

async function getImportHistory() {
  const { data, error } = await db
    .from('erp_imports')
    .select('*, users(name)')
    .order('imported_on', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

// ============================================================
// EXAMS
// ============================================================

// Get exams for branch admin (own branch only — RLS enforces this)
async function getExams(filters = {}) {
  let query = db
    .from('exams')
    .select('*, branches(name, code)')
    .order('exam_date', { ascending: false });

  if (filters.branch_id)  query = query.eq('branch_id',  filters.branch_id);
  if (filters.standard)   query = query.eq('standard',   filters.standard);
  if (filters.medium)     query = query.eq('medium',     filters.medium);
  if (filters.exam_type)  query = query.eq('exam_type',  filters.exam_type);
  if (filters.date_from)  query = query.gte('exam_date', filters.date_from);
  if (filters.date_to)    query = query.lte('exam_date', filters.date_to);
  if (filters.search) {
    query = query.or(`subject.ilike.%${filters.search}%,exam_ref.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Get single exam with all related data
async function getExamDetail(examId) {
  const { data, error } = await db
    .from('exams')
    .select(`
      *,
      branches(name, code),
      exam_supervisors(id, supervisors(id, name, phone, rate_per_hour)),
      corrector_batches(
        *,
        correctors(id, name, phone),
        distributions(*)
      )
    `)
    .eq('id', examId)
    .single();
  if (error) throw error;
  return data;
}

// Update manual fields on exam (marks, classroom, syllabus, actual_hours, students_present)
async function updateExam(examId, updates) {
  const { data, error } = await db
    .from('exams')
    .update(updates)
    .eq('id', examId)
    .select().single();
  if (error) throw error;
  return data;
}

// ============================================================
// EXAM SUPERVISORS
// ============================================================

async function addExamSupervisor(examId, supervisorId) {
  const { data, error } = await db
    .from('exam_supervisors')
    .insert({ exam_id: examId, supervisor_id: supervisorId })
    .select('*, supervisors(id, name, phone, rate_per_hour)')
    .single();
  if (error) throw error;
  return data;
}

async function removeExamSupervisor(examSupervisorId) {
  const { error } = await db
    .from('exam_supervisors')
    .delete()
    .eq('id', examSupervisorId);
  if (error) throw error;
}

// ============================================================
// CORRECTOR BATCHES
// ============================================================

async function saveCorrectorBatch(batch) {
  const payload = {
    exam_id:        batch.exam_id,
    corrector_id:   batch.corrector_id,
    split_type:     batch.split_type,
    papers_sent:    parseInt(batch.papers_sent),
    section_marks:  parseInt(batch.section_marks),
    sent_date:      batch.sent_date,
    delivered_by:   batch.delivered_by || null,
    delivered_on:   batch.delivered_on,
    return_date:    batch.return_date   || null,
    papers_received:batch.papers_received ? parseInt(batch.papers_received) : null,
  };

  if (batch.id) {
    const { data, error } = await db
      .from('corrector_batches')
      .update(payload)
      .eq('id', batch.id)
      .select('*, correctors(name)').single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await db
      .from('corrector_batches')
      .insert(payload)
      .select('*, correctors(name)').single();
    if (error) throw error;
    return data;
  }
}

async function deleteCorrectorBatch(batchId) {
  const { error } = await db
    .from('corrector_batches')
    .delete()
    .eq('id', batchId);
  if (error) throw error;
}

// Validate Type A: sum of papers_sent = students_present
function validateTypeA(batches, studentsPresent) {
  const total = batches
    .filter(b => b.split_type === 'A')
    .reduce((s, b) => s + parseInt(b.papers_sent || 0), 0);
  return total === parseInt(studentsPresent);
}

// Validate Type B: sum of section_marks = total exam marks
function validateTypeB(batches, totalMarks) {
  const total = batches
    .filter(b => b.split_type === 'B')
    .reduce((s, b) => s + parseInt(b.section_marks || 0), 0);
  return total === parseInt(totalMarks);
}

// ============================================================
// DISTRIBUTIONS
// ============================================================

async function saveDistribution(dist) {
  const payload = {
    batch_id:           dist.batch_id,
    papers_distributed: parseInt(dist.papers_distributed),
    distribution_date:  dist.distribution_date,
  };

  if (dist.id) {
    const { data, error } = await db
      .from('distributions')
      .update(payload)
      .eq('id', dist.id)
      .select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await db
      .from('distributions')
      .insert(payload)
      .select().single();
    if (error) throw error;
    return data;
  }
}

async function deleteDistribution(distId) {
  const { error } = await db
    .from('distributions')
    .delete()
    .eq('id', distId);
  if (error) throw error;
}

// ============================================================
// REPORTS (queries on views — for Looker Studio + app)
// ============================================================

async function getOverdueBatches(branchId = null) {
  let query = db
    .from('overdue_batches')
    .select('*')
    .order('days_overdue', { ascending: false });
  if (branchId) query = query.eq('branch_id', branchId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function getCorrectorRemuneration(filters = {}) {
  let query = db
    .from('corrector_remuneration')
    .select('*');
  if (filters.corrector_id) query = query.eq('corrector_id', filters.corrector_id);
  if (filters.branch_id)    query = query.eq('branch_id',    filters.branch_id);
  if (filters.date_from)    query = query.gte('exam_date',   filters.date_from);
  if (filters.date_to)      query = query.lte('exam_date',   filters.date_to);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function getSupervisorRemuneration(filters = {}) {
  let query = db
    .from('supervisor_remuneration')
    .select('*');
  if (filters.supervisor_id) query = query.eq('supervisor_id', filters.supervisor_id);
  if (filters.branch_id)     query = query.eq('branch_id',     filters.branch_id);
  if (filters.date_from)     query = query.gte('exam_date',    filters.date_from);
  if (filters.date_to)       query = query.lte('exam_date',    filters.date_to);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ============================================================
// DATE VALIDATION HELPERS
// ============================================================

// Validate papers_sent_date: must be between exam_date and exam_date + 5
function validateSentDate(examDateStr, sentDateStr) {
  const exam = new Date(examDateStr);
  const sent = new Date(sentDateStr);
  const max  = new Date(examDateStr);
  max.setDate(max.getDate() + CONFIG.DATE_RULES.PAPERS_SENT_MAX_DAYS);
  return sent >= exam && sent <= max;
}

// Validate delivered_on: must be between sent_date and sent_date + 2
function validateDeliveredDate(sentDateStr, deliveredDateStr) {
  const sent      = new Date(sentDateStr);
  const delivered = new Date(deliveredDateStr);
  const max       = new Date(sentDateStr);
  max.setDate(max.getDate() + CONFIG.DATE_RULES.DELIVERED_MAX_DAYS);
  return delivered >= sent && delivered <= max;
}

// Validate return_date: must be >= delivered_on
function validateReturnDate(deliveredDateStr, returnDateStr) {
  if (!returnDateStr) return true; // optional until papers come back
  return new Date(returnDateStr) >= new Date(deliveredDateStr);
}

// Get min/max date strings for input[type=date] constraints
function getDateConstraints(examDateStr, sentDateStr) {
  const examDate = new Date(examDateStr);
  const sentMax  = new Date(examDateStr);
  sentMax.setDate(sentMax.getDate() + CONFIG.DATE_RULES.PAPERS_SENT_MAX_DAYS);

  let deliveredMin = null, deliveredMax = null;
  if (sentDateStr) {
    deliveredMin = sentDateStr;
    const dm = new Date(sentDateStr);
    dm.setDate(dm.getDate() + CONFIG.DATE_RULES.DELIVERED_MAX_DAYS);
    deliveredMax = dm.toISOString().split('T')[0];
  }

  return {
    sentMin:      examDateStr,
    sentMax:      sentMax.toISOString().split('T')[0],
    deliveredMin,
    deliveredMax,
  };
}
