const { queryConfig, sql, READ_ONLY_MODE, ADMIN_READ_ONLY, formatSqlForLog } = require('../config/database');
const { createLogger } = require('../utils/logger');

const log = createLogger(__filename);

// Admin roles that can manage section specs
const ADMIN_ROLES = ['MSPB_Employees'];

// Check if user has admin role
function isAdmin(req) {
  const userRoles = req.userRoles || [];
  return userRoles.some(role => ADMIN_ROLES.includes(role));
}

// Get query options for SQL logging
function getQueryOptions(req) {
  return {
    reqLog: req.log || log,
    isAdmin: isAdmin(req)
  };
}

// Build response with optional SQL echo
function buildResponse(baseResponse, result, req) {
  if (READ_ONLY_MODE && isAdmin(req) && result?.sqlEcho) {
    return {
      ...baseResponse,
      sqlEcho: result.sqlEcho
    };
  }
  return baseResponse;
}

function logBlockedWrite(reqLog, operation, sqlQuery, params) {
  const formatted = formatSqlForLog(sqlQuery, params);
  reqLog.warn('BLOCKED WRITE (read-only mode)', {
    operation,
    sql: sqlQuery,
    params,
    formattedSql: formatted
  });
  return { sql: sqlQuery, params, formattedSql: formatted };
}

// Get section specs using the Section_Spec_UI view, filtered by file_spec_id
async function getSectionSpecs(req, res) {
  const reqLog = req.log || log;
  try {
    const { fileSpecId } = req.query;

    if (!fileSpecId) {
      return res.status(400).json({ error: 'fileSpecId is required' });
    }

    const result = await queryConfig(
      `SELECT file_desc, file_spec_id, section_spec_id, section_name, section_desc,
              sort_order, is_global_default, is_optional, presense_enforced,
              last_reviewed, updated_by
       FROM Config.Section_Spec_UI
       WHERE file_spec_id = @p1
       ORDER BY sort_order, section_name`,
      {
        p1: { type: sql.Int, value: parseInt(fileSpecId) }
      },
      getQueryOptions(req)
    );

    res.json(buildResponse({
      success: true,
      sectionSpecs: result.recordset
    }, result, req));
  } catch (error) {
    reqLog.error('Get section specs error', { err: error.message, fileSpecId: req.query.fileSpecId });
    res.status(500).json({ error: 'Failed to retrieve section specs' });
  }
}

// Update section spec - only editable fields
// Editable: section_name, section_desc, sort_order, is_global_default, is_optional, presense_enforced
// Auto-updated: last_reviewed, updated_by
async function updateSectionSpec(req, res) {
  const reqLog = req.log || log;
  try {
    const { sectionSpecId } = req.params;
    const { section_name, section_desc, sort_order, is_global_default, is_optional, presense_enforced } = req.body;

    if (!sectionSpecId) {
      return res.status(400).json({ error: 'sectionSpecId is required' });
    }

    if (!section_name || !section_name.trim()) {
      return res.status(400).json({ error: 'section_name is required' });
    }

    const sqlQuery = `UPDATE Config.Section_Spec
       SET section_name = @p1,
           section_desc = @p2,
           sort_order = @p3,
           is_global_default = @p4,
           is_optional = @p5,
           presense_enforced = @p6,
           last_reviewed = GETDATE(),
           updated_by = @p7
       WHERE section_spec_id = @p8`;

    const params = {
      p1: { type: sql.NVarChar(150), value: section_name.trim() },
      p2: { type: sql.NVarChar(250), value: section_desc || null },
      p3: { type: sql.Int, value: sort_order != null ? parseInt(sort_order) : null },
      p4: { type: sql.Bit, value: is_global_default ? 1 : 0 },
      p5: { type: sql.Bit, value: is_optional != null ? (is_optional ? 1 : 0) : null },
      p6: { type: sql.Bit, value: presense_enforced != null ? (presense_enforced ? 1 : 0) : null },
      p7: { type: sql.NVarChar(sql.MAX), value: req.user.username },
      p8: { type: sql.Int, value: parseInt(sectionSpecId) }
    };

    // Admin pages bypass read-only mode unless ADMIN_READ_ONLY is also set
    if (READ_ONLY_MODE && ADMIN_READ_ONLY) {
      const sqlEcho = logBlockedWrite(reqLog, 'UPDATE_SECTION_SPEC', sqlQuery, params);
      const response = { success: true, blocked: true, message: 'Write blocked (read-only mode)' };
      if (isAdmin(req)) {
        response.sqlEcho = sqlEcho;
      }
      return res.json(response);
    }

    await queryConfig(sqlQuery, params, getQueryOptions(req));

    reqLog.info('Section spec updated', { sectionSpecId, username: req.user.username });
    res.json({ success: true });
  } catch (error) {
    reqLog.error('Update section spec error', { err: error.message, sectionSpecId: req.params.sectionSpecId });
    res.status(500).json({ error: 'Failed to update section spec' });
  }
}

module.exports = {
  getSectionSpecs,
  updateSectionSpec
};
