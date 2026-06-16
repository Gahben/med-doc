import { describe, it, expect } from 'vitest'
import dataset from './dataset.json'

describe('AI Triage Evaluation Dataset', () => {
  it('should contain exactly 50 test cases', () => {
    expect(dataset.length).toBe(50)
  })

  it('should have valid fields in every case', () => {
    dataset.forEach((item) => {
      expect(item).toHaveProperty('id')
      expect(item).toHaveProperty('requester_name')
      expect(item).toHaveProperty('request_reason')
      expect(item).toHaveProperty('hospital_period')
      expect(item).toHaveProperty('expected_urgency')
      
      // Valida que o nível de urgência esperado é um dos quatro níveis oficiais
      expect(['low', 'medium', 'high', 'critical']).toContain(item.expected_urgency)
      
      // Valida preenchimento dos campos principais
      expect(item.requester_name.length).toBeGreaterThan(0)
      expect(item.request_reason.length).toBeGreaterThan(0)
    })
  })
})
