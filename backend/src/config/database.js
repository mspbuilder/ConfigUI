const sql = require('mssql');
require('dotenv').config();
const { createLogger } = require('../utils/logger');

const log = createLogger(__filename);

// Read-only mode flag - when true, SQL statements are logged/echoed
const READ_ONLY_MODE = process.env.DB_READ_ONLY === 'true';

// Helper to format SQL with parameters for logging
function formatSqlForLog(queryString, params) {
  let formatted = queryString;
  Object.keys(params).forEach(key => {
    const param = params[key];
    const value = param && typeof param === 'object' && param.value !== undefined
      ? param.value
      : param;
    // Escape single quotes and wrap strings in quotes for display
    const displayValue = typeof value === 'string'
      ? `'${value.replace(/'/g, "''")}'`
      : value;
    formatted = formatted.replace(new RegExp(`@${key}\\b`, 'g'), String(displayValue));
  });
  return formatted;
}

// Log SQL statement when in read-only mode
function logSqlStatement(operation, queryString, params, reqLog = null) {
  if (!READ_ONLY_MODE) return;

  const formatted = formatSqlForLog(queryString, params);
  const logData = {
    operation,
    sql: queryString,
    params,
    formattedSql: formatted
  };

  if (reqLog) {
    reqLog.info('SQL_ECHO (read-only mode)', logData);
  } else {
    log.info('SQL_ECHO (read-only mode)', logData);
  }

  return { sql: queryString, params, formattedSql: formatted };
}

// MojoPortal database connection (for user/role queries)
const mojoConfig = {
  server: process.env.MOJO_DB_SERVER,
  database: process.env.MOJO_DB_DATABASE,
  user: process.env.MOJO_DB_USER,
  password: process.env.MOJO_DB_PASSWORD,
  port: parseInt(process.env.MOJO_DB_PORT || '1433'),
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Configurations database connection (for config/MFA data)
const configDbConfig = {
  server: process.env.CONFIG_DB_SERVER,
  database: process.env.CONFIG_DB_DATABASE,
  user: process.env.CONFIG_DB_USER,
  password: process.env.CONFIG_DB_PASSWORD,
  port: parseInt(process.env.CONFIG_DB_PORT || '1433'),
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let mojoPool;
let configPool;

async function getMojoConnection() {
  if (!mojoPool) {
    mojoPool = await sql.connect(mojoConfig);
  }
  return mojoPool;
}

async function getConfigConnection() {
  if (!configPool) {
    configPool = await new sql.ConnectionPool(configDbConfig).connect();
  }
  return configPool;
}

// Query MojoPortal database (users, roles)
async function queryMojo(queryString, params = {}) {
  try {
    const connection = await getMojoConnection();
    const request = connection.request();

    Object.keys(params).forEach(key => {
      request.input(key, params[key]);
    });

    const result = await request.query(queryString);
    return result;
  } catch (error) {
    log.error('MojoPortal query error', { err: error.message, code: error.code });
    throw error;
  }
}

// Query Configurations database (configs, MFA)
// Params can be either simple values (type inferred) or objects with { type, value }
// Options: { reqLog, isAdmin } - for SQL logging in read-only mode
async function queryConfig(queryString, params = {}, options = {}) {
  const { reqLog, isAdmin } = options;

  // Log SQL when in read-only mode and admin is logged in
  let sqlEcho = null;
  if (READ_ONLY_MODE && isAdmin) {
    sqlEcho = logSqlStatement('QUERY_CONFIG', queryString, params, reqLog);
  }

  try {
    const connection = await getConfigConnection();
    const request = connection.request();

    Object.keys(params).forEach(key => {
      const param = params[key];
      if (param && typeof param === 'object' && param.type !== undefined) {
        // Typed parameter: { type: sql.VarChar(100), value: 'string' }
        request.input(key, param.type, param.value);
      } else {
        // Simple value - let driver infer type
        request.input(key, param);
      }
    });

    const result = await request.query(queryString);

    // Attach SQL echo data to result for API response
    if (sqlEcho) {
      result.sqlEcho = sqlEcho;
    }

    return result;
  } catch (error) {
    log.error('Configurations database query error', { err: error.message, code: error.code });
    throw error;
  }
}

// Legacy query function - defaults to config DB
async function query(queryString, params = {}) {
  return queryConfig(queryString, params);
}

// Execute stored procedure
// Options: { reqLog, isAdmin } - for SQL logging in read-only mode
async function execute(procedureName, params = {}, options = {}) {
  const { reqLog, isAdmin } = options;

  // Log SQL when in read-only mode and admin is logged in
  let sqlEcho = null;
  if (READ_ONLY_MODE && isAdmin) {
    sqlEcho = logSqlStatement('EXECUTE_SP', `EXEC ${procedureName}`, params, reqLog);
  }

  try {
    const connection = await getConfigConnection();
    const request = connection.request();

    Object.keys(params).forEach(key => {
      request.input(key, params[key]);
    });

    const result = await request.execute(procedureName);

    // Attach SQL echo data to result for API response
    if (sqlEcho) {
      result.sqlEcho = sqlEcho;
    }

    return result;
  } catch (error) {
    log.error('Stored procedure execution error', { procedure: procedureName, err: error.message, code: error.code });
    throw error;
  }
}

module.exports = {
  getMojoConnection,
  getConfigConnection,
  queryMojo,
  queryConfig,
  query,
  execute,
  sql,
  READ_ONLY_MODE,
  formatSqlForLog
};
