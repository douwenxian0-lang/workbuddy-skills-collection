'use strict';

const URL_BEARING_VERBS = new Map([
  ['open', 1],
  ['goto', 1],
  ['navigate', 1],
]);

function extractUrls(actionArgs) {
  if (!Array.isArray(actionArgs) || actionArgs.length < 2) return [];
  const verb = String(actionArgs[0]).toLowerCase();
  const idx = URL_BEARING_VERBS.get(verb);
  if (idx === undefined) return [];
  const url = actionArgs[idx];
  return url ? [String(url)] : [];
}

module.exports = { extractUrls, URL_BEARING_VERBS };
