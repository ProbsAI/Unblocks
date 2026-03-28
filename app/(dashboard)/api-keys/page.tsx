'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { CopyButton } from '@/components/ui/CopyButton'
import { Toast } from '@/components/ui/Toast'

interface ApiKeyRow {
  id: string
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt: string | null
  createdAt: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetchKeys = useCallback(async () => {
    const res = await fetch('/api/api-keys')
    if (res.ok) {
      const json = await res.json()
      setKeys(json.data ?? [])
    }
  }, [])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  async function handleCreate() {
    if (!newKeyName.trim()) return
    setLoading(true)
    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName }),
    })
    setLoading(false)

    if (res.ok) {
      const json = await res.json()
      setCreatedKey(json.data.key)
      setNewKeyName('')
      fetchKeys()
    } else {
      setToast({ message: 'Failed to create API key', type: 'error' })
    }
  }

  async function handleRevoke(id: string) {
    const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setToast({ message: 'API key revoked', type: 'success' })
      fetchKeys()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage API keys for programmatic access
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Create API Key</Button>
      </div>

      <Card>
        {keys.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No API keys yet. Create one to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Name</th>
                  <th className="pb-3 pr-4 font-medium">Key</th>
                  <th className="pb-3 pr-4 font-medium">Last Used</th>
                  <th className="pb-3 pr-4 font-medium">Created</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 font-medium text-foreground">{k.name}</td>
                    <td className="py-3 pr-4 font-mono text-muted-foreground">
                      {k.prefix}...
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => handleRevoke(k.id)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Modal */}
      <Modal open={showCreate && !createdKey} onClose={() => setShowCreate(false)} title="Create API Key">
        <div className="space-y-4">
          <Input
            label="Key Name"
            placeholder="e.g., Production, Staging"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={loading}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Key Display Modal (shown once after creation) */}
      <Modal
        open={!!createdKey}
        onClose={() => { setCreatedKey(null); setShowCreate(false) }}
        title="API Key Created"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Copy this key now. You won&apos;t be able to see it again.
          </p>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted p-3">
            <code className="flex-1 break-all text-sm">{createdKey}</code>
            <CopyButton value={createdKey ?? ''} />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => { setCreatedKey(null); setShowCreate(false) }}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
