import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'

describe('CSV parsing', () => {
  it('handles escaped quotes, embedded commas and line breaks', () => {
    expect(parseCsv('name,description\r\n"Switch, 24-port","Includes ""uplink"" ports"\r\n"Item 2","Two\nlines"')).toEqual([
      ['name', 'description'],
      ['Switch, 24-port', 'Includes "uplink" ports'],
      ['Item 2', 'Two\nlines'],
    ])
  })

  it('rejects unterminated quoted fields', () => {
    expect(() => parseCsv('name,description\n"Switch,broken')).toThrow('unterminated quoted field')
  })
})
