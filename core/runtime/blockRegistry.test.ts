import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerBlock,
  isBlockAvailable,
  tryRequireBlock,
  requireBlock,
  getBlockInfo,
  getRegisteredBlocks,
  getBlockSchemas,
  resetBlockRegistry,
} from './blockRegistry'
import type { BlockRegistration } from './blockRegistry'

const fakeBlock: BlockRegistration = {
  id: 'test-block',
  name: 'Test Block',
  version: '1.0.0',
  exports: { doSomething: () => 'result' },
}

const fakeBlockWithSchema: BlockRegistration = {
  id: 'schema-block',
  name: 'Schema Block',
  version: '0.1.0',
  exports: { query: () => [] },
  schemas: { schemaTable: {} },
}

describe('registerBlock', () => {
  beforeEach(() => resetBlockRegistry())

  it('registers a block so it can be retrieved', () => {
    registerBlock(fakeBlock)
    expect(isBlockAvailable('test-block')).toBe(true)
  })

  it('overwrites an already-registered block', () => {
    registerBlock(fakeBlock)
    const updated = { ...fakeBlock, version: '2.0.0' }
    registerBlock(updated)
    const info = getBlockInfo('test-block')
    expect(info?.version).toBe('2.0.0')
  })
})

describe('tryRequireBlock', () => {
  beforeEach(() => resetBlockRegistry())

  it('returns exports when block is registered', () => {
    registerBlock(fakeBlock)
    const exports = tryRequireBlock<{ doSomething: () => string }>('test-block')
    expect(exports).not.toBeNull()
    expect(exports!.doSomething()).toBe('result')
  })

  it('returns null when block is not registered and package is not installed', () => {
    const result = tryRequireBlock('nonexistent-block')
    expect(result).toBeNull()
  })
})

describe('requireBlock', () => {
  beforeEach(() => resetBlockRegistry())

  it('returns exports when block is registered', () => {
    registerBlock(fakeBlock)
    const exports = requireBlock<{ doSomething: () => string }>('test-block')
    expect(exports.doSomething()).toBe('result')
  })

  it('throws when block is not registered', () => {
    expect(() => requireBlock('missing-block')).toThrow(
      'Block "missing-block" is not installed'
    )
  })
})

describe('isBlockAvailable', () => {
  beforeEach(() => resetBlockRegistry())

  it('returns false for unregistered block', () => {
    expect(isBlockAvailable('nope')).toBe(false)
  })

  it('returns true after registration', () => {
    registerBlock(fakeBlock)
    expect(isBlockAvailable('test-block')).toBe(true)
  })
})

describe('getBlockInfo', () => {
  beforeEach(() => resetBlockRegistry())

  it('returns id, name, version without exports', () => {
    registerBlock(fakeBlock)
    const info = getBlockInfo('test-block')
    expect(info).toEqual({ id: 'test-block', name: 'Test Block', version: '1.0.0' })
    expect(info).not.toHaveProperty('exports')
  })

  it('returns null for unknown block', () => {
    expect(getBlockInfo('unknown')).toBeNull()
  })
})

describe('getRegisteredBlocks', () => {
  beforeEach(() => resetBlockRegistry())

  it('returns empty array when no blocks registered', () => {
    expect(getRegisteredBlocks()).toEqual([])
  })

  it('lists all registered blocks', () => {
    registerBlock(fakeBlock)
    registerBlock(fakeBlockWithSchema)
    const blocks = getRegisteredBlocks()
    expect(blocks).toHaveLength(2)
    expect(blocks.map((b) => b.id)).toContain('test-block')
    expect(blocks.map((b) => b.id)).toContain('schema-block')
  })
})

describe('getBlockSchemas', () => {
  beforeEach(() => resetBlockRegistry())

  it('returns schemas from blocks that have them', () => {
    registerBlock(fakeBlock)
    registerBlock(fakeBlockWithSchema)
    const schemas = getBlockSchemas()
    expect(schemas).toHaveLength(1)
    expect(schemas[0]).toEqual({ schemaTable: {} })
  })
})

describe('resetBlockRegistry', () => {
  beforeEach(() => resetBlockRegistry())

  it('clears all registered blocks', () => {
    registerBlock(fakeBlock)
    expect(getRegisteredBlocks()).toHaveLength(1)
    resetBlockRegistry()
    expect(getRegisteredBlocks()).toHaveLength(0)
  })
})
