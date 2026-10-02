'use strict';

function ok(command, data, warnings) {
  const r = { ok: true, command };
  if (data !== undefined) r.data = data;
  if (warnings && warnings.length > 0) r.warnings = warnings;
  return r;
}

function fail(command, error, hint, data, warnings) {
  const r = { ok: false, command, error };
  if (hint) r.hint = hint;
  if (data !== undefined) r.data = data;
  if (warnings && warnings.length > 0) r.warnings = warnings;
  return r;
}

function output(result) {
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { ok, fail, output };
