import { describe, it, expect } from 'vitest'
import { esc, escJson, escLike, SAFE_IDENT, SAFE_PATH } from '../sql-escape.js'

describe('esc', () => {
  it('should escape single quotes', () => {
    expect(esc("it's")).toBe("it''s")
  })

  it('should escape backslashes', () => {
    expect(esc('path\\to\\file')).toBe('path\\\\to\\\\file')
  })

  it('should escape both single quotes and backslashes', () => {
    expect(esc("it\\'s")).toBe("it\\\\''s")
  })

  it('should handle empty string', () => {
    expect(esc('')).toBe('')
  })

  it('should pass through safe strings unchanged', () => {
    expect(esc('hello world 123')).toBe('hello world 123')
  })

  it('should handle multiple single quotes', () => {
    expect(esc("a'b'c")).toBe("a''b''c")
  })

  it('should handle multiple backslashes', () => {
    expect(esc('a\\b\\c')).toBe('a\\\\b\\\\c')
  })
})

describe('escJson', () => {
  it('only escapes single quotes', () => {
    expect(escJson("a'b")).toBe("a''b")
  })

  it('preserves backslash escapes so JSON survives the jsonb parser', () => {
    // JSON.stringify of a string containing a newline and a quote:
    //   input:  hello\nworld"
    //   JSON:   "hello\nworld\""
    // The JSON "\n" (two chars: \ + n) must reach the jsonb parser untouched.
    const jsonLiteral = JSON.stringify('hello\nworld"')
    const escaped = escJson(jsonLiteral)
    expect(escaped).toBe(jsonLiteral)
    expect(escaped.includes('\\n')).toBe(true)
    expect(escaped.includes('\\"')).toBe(true)
  })

  it('escapes quotes embedded inside JSON strings', () => {
    const jsonLiteral = JSON.stringify({ note: "it's fine" })
    const escaped = escJson(jsonLiteral)
    // JSON keeps the apostrophe literal; escJson doubles it for SQL.
    expect(escaped).toBe(jsonLiteral.replace(/'/g, "''"))
  })
})

describe('SAFE_IDENT', () => {
  it('accepts standard agent/kind names', () => {
    expect(SAFE_IDENT.test('ceo')).toBe(true)
    expect(SAFE_IDENT.test('market_data')).toBe(true)
    expect(SAFE_IDENT.test('finance-v2')).toBe(true)
  })

  it('rejects hostile or malformed names', () => {
    expect(SAFE_IDENT.test("agent'; DROP TABLE")).toBe(false)
    expect(SAFE_IDENT.test('研究员')).toBe(false)
    expect(SAFE_IDENT.test('')).toBe(false)
    expect(SAFE_IDENT.test('1leading-digit')).toBe(false)
    expect(SAFE_IDENT.test('a'.repeat(65))).toBe(false)
  })
})

describe('SAFE_PATH', () => {
  it('accepts domain/category/item style paths', () => {
    expect(SAFE_PATH.test('costs/opex/rent')).toBe(true)
    expect(SAFE_PATH.test('brand/identity/logo-final.png')).toBe(true)
  })

  it('rejects paths with quotes or shell metachars', () => {
    expect(SAFE_PATH.test("costs/opex/'; DROP TABLE;--")).toBe(false)
    expect(SAFE_PATH.test('costs/opex/foo bar')).toBe(false)
    expect(SAFE_PATH.test('costs/$(whoami)')).toBe(false)
  })
})

describe('escLike', () => {
  it('should escape percent signs', () => {
    expect(escLike('100%')).toBe('100\\%')
  })

  it('should escape underscores', () => {
    expect(escLike('file_name')).toBe('file\\_name')
  })

  it('should escape all special characters together', () => {
    expect(escLike("it's 100% file_name\\path")).toBe("it''s 100\\% file\\_name\\\\path")
  })

  it('should handle empty string', () => {
    expect(escLike('')).toBe('')
  })

  it('should pass through safe strings unchanged', () => {
    expect(escLike('hello world')).toBe('hello world')
  })
})
