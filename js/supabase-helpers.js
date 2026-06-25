// ============================================================
// EXAM PORTAL — supabase-helpers.js
// All database functions. Import after config.js.
// ============================================================

// ── Initialize Supabase client ───────────────────────────────
const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// ============================================================
// AUTH
// ============================================================

async function authLogin(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const profile = await getMyProfile();
  return { user: data.user, ...profile };
}

async function authLogout() {
  const { error } = await db.auth.signOut();
  if (error) throw error;
  window.location.href = 'login.html';
}

async function getSession() {
  const { data } = await db.auth.getSession();
  return data.session;
}

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

async function requireAuth() {
  const session = await getSession();
  if (!session) { window.location.href = 'login.html'; return null; }
  const profile = await getMyProfile();
  return profile;
}

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

// Get supervisors with their branch assignments.
// If branchId is provided — returns only supervisors assigned to that branch.
// Used by branch admin to see only their branch supervisors.
async function getSupervisors(activeOnly = true, branchId = null) {
  let query = db
    .from('supervisors')
    .select('*, supervisor_branches(branch_id, branches(name))')
    .order('name');
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;

  // Filter to only supervisors assigned to the given branch
  if (branchId) {
    return (data || []).filter(s =>
      (s.supervisor_branches || []).some(sb => sb.branch_id === branchId)
    );
  }
  return data || [];
}

// Get all branches assigned to a specific supervisor (for edit form pre-fill)
async function getSupervisorBranches(supervisorId) {
  const { data, error } = await db
    .from('supervisor_branches')
    .select('branch_id, branches(name)')
    .eq('supervisor_id', supervisorId);
  if (error) throw error;
  return data || [];
}

// Save supervisor + their branch assignments
async function saveSupervisor(sup) {
  const payload = {
    name:          sup.name,
    phone:         sup.phone || null,
    rate_per_hour: parseFloat(sup.rate_per_hour) || 0,
    is_active:     sup.is_active !== false,
  };

  let savedSup;
  if (sup.id) {
    const { data, error } = await db
      .from('supervisors')
      .update(payload)
      .eq('id', sup.id)
      .select().single();
    if (error) throw error;
    savedSup = data;
  } else {
    const { data, error } = await db
      .from('supervisors')
      .insert(payload)
      .select().single();
    if (error) throw error;
    savedSup = data;
  }

  // Save branch assignments — delete old ones first then insert new
  await db.from('supervisor_branches').delete().eq('supervisor_id', savedSup.id);
  if (sup.branch_ids && sup.branch_ids.length > 0) {
    const rows = sup.branch_ids.map(bid => ({
      supervisor_id: savedSup.id,
      branch_id:     bid,
    }));
    const { error: brErr } = await db.from('supervisor_branches').insert(rows);
    if (brErr) throw brErr;
  }

  return savedSup;
}

async function deleteSupervisor(id) {
  // supervisor_branches rows auto-deleted via cascade
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

async function importERPRows(rows, filename, uploadedById) {
  const branches = await getBranches();
  const branchMap = {};
  branches.forEach(b => { branchMap[b.name.toUpperCase()] = b.id; });

  let imported = 0;
  let skipped  = 0;
  const errors = [];

  for (const row of rows) {
    try {
      const branchName = (row.branch_name || '').toUpperCase().trim();
      const branch_id  = branchMap[branchName];
      if (!branch_id) { skipped++; continue; }

      const exam_date = parseERPDate(row.exam_date);
      if (!exam_date) { skipped++; continue; }

      const from_time    = minsToTime(parseInt(row.from_time) || 0);
      const to_time      = minsToTime(parseInt(row.to_time)   || 0);
      const actual_hours = ((parseInt(row.to_time) || 0) - (parseInt(row.from_time) || 0)) / 60;

      const marks = parseInt(row.marks);
      if (!marks || marks < 1) { skipped++; continue; }

      const students_present = parseInt(row.students_present) || 0;
      const exam_type        = parseExamType(row.exam_ref);

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
        status:           'pending',
      };

      const { error } = await db
        .from('exams')
        .insert(examRow);

      if (error) {
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

  await db.from('erp_imports').insert({
    uploaded_by:   uploadedById,
    filename:      filename,
    rows_imported: imported,
    rows_skipped:  skipped,
    notes:         errors.length ? errors.slice(0, 5).join('; ') : null,
  });

  return { imported, skipped, errors };
}

function parseERPDate(str) {
  if (!str) return null;
  try {
    const clean = str.split(',')[0].trim();
    const d = new Date(clean);
    if (isNaN(d)) return null;
    // Use LOCAL date parts, NOT toISOString() — toISOString() converts to UTC
    // and shifts the day back by one for IST (and any timezone ahead of UTC).
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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

async function getExams(filters = {}) {
  let query = db
    .from('exams')
    .select('*, branches(name, code)')
    .order('exam_date', { ascending: false });

  if (filters.branch_id) query = query.eq('branch_id',  filters.branch_id);
  if (filters.standard)  query = query.eq('standard',   filters.standard);
  if (filters.medium)    query = query.eq('medium',     filters.medium);
  if (filters.exam_type) query = query.eq('exam_type',  filters.exam_type);
  if (filters.date_from) query = query.gte('exam_date', filters.date_from);
  if (filters.date_to)   query = query.lte('exam_date', filters.date_to);
  if (filters.search) {
    query = query.or(`subject.ilike.%${filters.search}%,exam_ref.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function getExamDetail(examId) {
  const { data, error } = await db
    .from('exams')
    .select(`
      *,
      branches(name, code),
      exam_supervisors(id, classroom, supervisors(id, name, phone, rate_per_hour)),
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
// EXAM STATUS — recalculate and save
// ============================================================
// Status priority (first match wins):
//   1. no corrector batches                          → pending
//   2. students_present = sum(papers_distributed)    → complete
//   3. any batch returned                            → not_distributed
//   4. any batch past its due date (due_date < today)→ overdue
//   5. otherwise                                     → progress
// Note: does NOT use the is_overdue column (which stays true after a late
// return). Overdue is decided by comparing due_date to today, live.

async function recalcExamStatus(examId) {
  // Fetch this exam's batches (due + return dates) and its students_present
  const [{ data: batches }, { data: exam }] = await Promise.all([
    db.from('corrector_batches')
      .select('id, due_date, return_date')
      .eq('exam_id', examId),
    db.from('exams')
      .select('students_present')
      .eq('id', examId)
      .single(),
  ]);

  let status = 'pending';

  if (batches && batches.length > 0) {
    // Sum papers distributed across all of this exam's batches
    const batchIds = batches.map(b => b.id);
    const { data: dists } = await db
      .from('distributions')
      .select('papers_distributed')
      .in('batch_id', batchIds);
    const totalDistributed = (dists || [])
      .reduce((sum, d) => sum + (d.papers_distributed || 0), 0);

    const studentsPresent = exam?.students_present || 0;

    // Today as local YYYY-MM-DD, to compare against batch due_date strings
    const t        = new Date();
    const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

    const anyReturned = batches.some(b => b.return_date);
    const anyPastDue  = batches.some(b => b.due_date && b.due_date < todayStr);

    if (studentsPresent > 0 && totalDistributed === studentsPresent) status = 'complete';
    else if (anyReturned)                                            status = 'not_distributed';
    else if (anyPastDue)                                             status = 'overdue';
    else                                                             status = 'progress';
  }

  await db.from('exams').update({ status }).eq('id', examId);
  return status;
}

// ============================================================
// EXAM SUPERVISORS
// ============================================================

async function addExamSupervisor(examId, supervisorId, classroom) {
  const { data, error } = await db
    .from('exam_supervisors')
    .insert({
      exam_id:       examId,
      supervisor_id: supervisorId,
      classroom:     classroom || null,
    })
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
    exam_id:         batch.exam_id,
    corrector_id:    batch.corrector_id,
    split_type:      batch.split_type,
    papers_sent:     parseInt(batch.papers_sent),
    section_marks:   parseInt(batch.section_marks),
    sent_date:       batch.sent_date,
    delivered_by:    batch.delivered_by || null,
    delivered_on:    batch.delivered_on,
    return_date:     batch.return_date  || null,
    papers_received: batch.papers_received ? parseInt(batch.papers_received) : null,
  };

  let data;
  if (batch.id) {
    const { data: d, error } = await db
      .from('corrector_batches')
      .update(payload)
      .eq('id', batch.id)
      .select('*, correctors(name)').single();
    if (error) throw error;
    data = d;
  } else {
    const { data: d, error } = await db
      .from('corrector_batches')
      .insert(payload)
      .select('*, correctors(name)').single();
    if (error) throw error;
    data = d;
  }

  await recalcExamStatus(batch.exam_id);
  return data;
}

async function deleteCorrectorBatch(batchId, examId) {
  const { error } = await db
    .from('corrector_batches')
    .delete()
    .eq('id', batchId);
  if (error) throw error;
  if (examId) await recalcExamStatus(examId);
}

function validateTypeA(batches, studentsPresent) {
  const total = batches
    .filter(b => b.split_type === 'A')
    .reduce((s, b) => s + parseInt(b.papers_sent || 0), 0);
  return total === parseInt(studentsPresent);
}

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

  let data;
  if (dist.id) {
    const { data: d, error } = await db
      .from('distributions')
      .update(payload)
      .eq('id', dist.id)
      .select().single();
    if (error) throw error;
    data = d;
  } else {
    const { data: d, error } = await db
      .from('distributions')
      .insert(payload)
      .select().single();
    if (error) throw error;
    data = d;
  }

  const { data: batch } = await db
    .from('corrector_batches')
    .select('exam_id')
    .eq('id', dist.batch_id)
    .single();
  if (batch) await recalcExamStatus(batch.exam_id);

  return data;
}

async function deleteDistribution(distId, examId) {
  const { error } = await db
    .from('distributions')
    .delete()
    .eq('id', distId);
  if (error) throw error;
  if (examId) await recalcExamStatus(examId);
}

// ============================================================
// REPORTS
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
  let query = db.from('corrector_remuneration').select('*');
  if (filters.corrector_id) query = query.eq('corrector_id', filters.corrector_id);
  if (filters.branch_id)    query = query.eq('branch_id',    filters.branch_id);
  if (filters.date_from)    query = query.gte('exam_date',   filters.date_from);
  if (filters.date_to)      query = query.lte('exam_date',   filters.date_to);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function getSupervisorRemuneration(filters = {}) {
  let query = db.from('supervisor_remuneration').select('*');
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

function validateSentDate(examDateStr, sentDateStr) {
  const exam = new Date(examDateStr);
  const sent = new Date(sentDateStr);
  const max  = new Date(examDateStr);
  max.setDate(max.getDate() + CONFIG.DATE_RULES.PAPERS_SENT_MAX_DAYS);
  return sent >= exam && sent <= max;
}

function validateDeliveredDate(sentDateStr, deliveredDateStr) {
  const sent      = new Date(sentDateStr);
  const delivered = new Date(deliveredDateStr);
  const max       = new Date(sentDateStr);
  max.setDate(max.getDate() + CONFIG.DATE_RULES.DELIVERED_MAX_DAYS);
  return delivered >= sent && delivered <= max;
}

function validateReturnDate(deliveredDateStr, returnDateStr) {
  if (!returnDateStr) return true;
  return new Date(returnDateStr) >= new Date(deliveredDateStr);
}

function getDateConstraints(examDateStr, sentDateStr) {
  const sentMax = new Date(examDateStr);
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
