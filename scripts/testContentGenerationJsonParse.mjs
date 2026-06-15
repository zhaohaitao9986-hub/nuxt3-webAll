import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractJsonObject,
  removeTrailingCommas,
  repairTruncatedJson,
  safeJsonParse,
  stripMarkdownFences,
} from '../server/services/contentGeneration/jsonParse.js'

test('stripMarkdownFences removes json code fence', () => {
  const input = '```json\n{"a":1}\n```'
  assert.equal(stripMarkdownFences(input), '{"a":1}')
})

test('removeTrailingCommas fixes object tail comma', () => {
  const input = '{"a":1,}'
  assert.equal(removeTrailingCommas(input), '{"a":1}')
})

test('repairTruncatedJson closes truncated object', () => {
  const input = '{"items":[{"id":1,"name":"x"'
  const repaired = repairTruncatedJson(input)
  assert.doesNotThrow(() => JSON.parse(repaired))
})

test('safeJsonParse parses strict JSON', () => {
  const result = safeJsonParse('{"contentPage":{"title":"x"},"bodyJson":{"blocks":[]},"sources":[]}')
  assert.equal(result.ok, true)
  assert.equal(result.repaired, false)
})

test('safeJsonParse repairs truncated tail comma object', () => {
  const input = [
    '{',
    '  "contentPage": {"title":"x"},',
    '  "bodyJson": {"blocks": []},',
    '  "sources": [',
    '    {"url":"https://example.com","factType": "features",',
  ].join('\n')
  const result = safeJsonParse(input)
  assert.equal(result.ok, true)
  assert.equal(result.repaired, true)
})
