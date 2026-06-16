import { describe, it, expect } from 'vitest'
import { cpfHelpers } from './storage.js'

describe('cpfHelpers', () => {
  describe('strip', () => {
    it('should remove all non-digit characters', () => {
      expect(cpfHelpers.strip('529.982.247-25')).toBe('52998224725')
      expect(cpfHelpers.strip('52998224725')).toBe('52998224725')
      expect(cpfHelpers.strip('abc')).toBe('')
      expect(cpfHelpers.strip('')).toBe('')
      expect(cpfHelpers.strip(null)).toBe('')
      expect(cpfHelpers.strip(undefined)).toBe('')
    })
  })

  describe('format', () => {
    it('should format CPF to 000.000.000-00', () => {
      expect(cpfHelpers.format('52998224725')).toBe('529.982.247-25')
      expect(cpfHelpers.format('529.982.247-25')).toBe('529.982.247-25')
    })

    it('should return original if not 11 digits', () => {
      expect(cpfHelpers.format('123')).toBe('123')
      expect(cpfHelpers.format('123456789012')).toBe('123456789012')
    })
  })

  describe('isValid', () => {
    it('should validate correct CPFs', () => {
      expect(cpfHelpers.isValid('529.982.247-25')).toBe(true)
      expect(cpfHelpers.isValid('52998224725')).toBe(true)
      expect(cpfHelpers.isValid('111.444.777-35')).toBe(true)
    })

    it('should reject invalid CPFs', () => {
      expect(cpfHelpers.isValid('111.111.111-11')).toBe(false) // all same digits
      expect(cpfHelpers.isValid('123.456.789-00')).toBe(false)
      expect(cpfHelpers.isValid('123.456.789-01')).toBe(false)
      expect(cpfHelpers.isValid('')).toBe(false)
      expect(cpfHelpers.isValid('123')).toBe(false)
      expect(cpfHelpers.isValid('123456789012')).toBe(false)
    })
  })

  describe('mask', () => {
    it('should apply mask while typing', () => {
      expect(cpfHelpers.mask('5')).toBe('5')
      expect(cpfHelpers.mask('52')).toBe('52')
      expect(cpfHelpers.mask('529')).toBe('529')
      expect(cpfHelpers.mask('5299')).toBe('529.9')
      expect(cpfHelpers.mask('52998')).toBe('529.98')
      expect(cpfHelpers.mask('529982')).toBe('529.982')
      expect(cpfHelpers.mask('5299822')).toBe('529.982.2')
      expect(cpfHelpers.mask('52998224')).toBe('529.982.24')
      expect(cpfHelpers.mask('529982247')).toBe('529.982.247')
      expect(cpfHelpers.mask('5299822472')).toBe('529.982.247-2')
      expect(cpfHelpers.mask('52998224725')).toBe('529.982.247-25')
    })

    it('should limit to 11 digits', () => {
      expect(cpfHelpers.mask('52998224725123')).toBe('529.982.247-25')
    })
  })
})
