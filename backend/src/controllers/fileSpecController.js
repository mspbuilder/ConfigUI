const { queryConfig, sql, READ_ONLY_MODE, formatSqlForLog } = require('../config/database');
const { createLogger } = require('../utils/logger');

const log = createLogger(__filename);

// Admin roles that can manage file specs
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

// Get all file specs for admin UI
async function getFileSpecs(req, res) {
  const reqLog = req.log || log;
  try {
    const result = await queryConfig(
      `SELECT file_spec_id, f_name, file_desc, sort_order, custom_sections_allowed,
              last_reviewed, section_sort_used_by_client, legacy_category_name, updated_by
       FROM Config.File_Spec
       ORDER BY sort_order, f_name`,
      {},
      getQueryOptions(req)
    );

    res.json(buildResponse({
      success: true,
      fileSpecs: result.recordset
    }, result, req));
  } catch (error) {
    reqLog.error('Get file specs error', { err: error.message });
    res.status(500).json({ error: 'Failed to retrieve file specs' });
  }
}

// Update file spec - only editable fields
// Editable: file_desc, sort_order, custom_sections_allowed, section_sort_used_by_client
// Auto-updated: last_reviewed (on any change)
async function updateFileSpec(req, res) {
  const reqLog = req.log || log;
  try {
    const { fileSpecId } = req.params;
    const { file_desc, sort_order, custom_sections_allowed, section_sort_used_by_client } = req.body;

    if (!fileSpecId) {
      return res.status(400).json({ error: 'fileSpecId is required' });
    }

    const sqlQuery = `UPDATE Config.File_Spec
       SET file_desc = @p1,
           sort_order = @p2,
           custom_sections_allowed = @p3,
           section_sort_used_by_client = @p4,
           last_reviewed = GETDATE(),
           updated_by = @p5
       WHERE file_spec_id = @p6`;

    const params = {
      p1: { type: sql.NVarChar(150), value: file_desc || null },
      p2: { type: sql.Int, value: sort_order != null ? parseInt(sort_order) : null },
      p3: { type: sql.Bit, value: custom_sections_allowed != null ? (custom_sections_allowed ? 1 : 0) : null },
      p4: { type: sql.Bit, value: section_sort_used_by_client != null ? (section_sort_used_by_client ? 1 : 0) : null },
      p5: { type: sql.NVarChar(sql.MAX), value: req.user.username },
      p6: { type: sql.Int, value: parseInt(fileSpecId) }
    };

    if (READ_ONLY_MODE) {
      const sqlEcho = logBlockedWrite(reqLog, 'UPDATE_FILE_SPEC', sqlQuery, params);
      const response = { success: true, blocked: true, message: 'Write blocked (read-only mode)' };
      if (isAdmin(req)) {
        response.sqlEcho = sqlEcho;
      }
      return res.json(response);
    }

    await queryConfig(sqlQuery, params, getQueryOptions(req));

    reqLog.info('File spec updated', { fileSpecId, username: req.user.username });
    res.json({ success: true });
  } catch (error) {
    reqLog.error('Update file spec error', { err: error.message, fileSpecId: req.params.fileSpecId });
    res.status(500).json({ error: 'Failed to update file spec' });
  }
}

module.exports = {
  getFileSpecs,
  updateFileSpec
};
