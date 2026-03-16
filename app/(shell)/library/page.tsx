'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Claim {
  id: string
  raw_text: string
  rewritten_sentence: string | null
  tech_stack: string[]
  metric_type: string | null
  metric_value: string | null
  scope: string | null
  company: { name: string | null } | null
}

interface Skill {
  id: string
  skill: string
  category: string | null
}

interface Credential {
  id: string
  type: 'degree' | 'training' | 'certification'
  title: string
  institution: string | null
  year: string | null
}

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<'experience' | 'skills' | 'education'>('experience')
  const [claims, setClaims] = useState<Claim[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    rewritten_sentence: '',
    tech_stack: '',
    metric_type: '',
    metric_value: '',
    scope: '',
  })

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const [claimsRes, skillsRes, credsRes] = await Promise.all([
        supabase
          .from('rmc_claims')
          .select('*, company:rmc_companies(name)')
          .eq('enrichment_status', 'enriched'),
        supabase.from('rmc_skills').select('*').order('skill'),
        supabase.from('rmc_education_credentials').select('*'),
      ])

      setClaims((claimsRes.data || []) as Claim[])
      setSkills((skillsRes.data || []) as Skill[])
      setCredentials((credsRes.data || []) as Credential[])
      setLoading(false)
    }

    fetchData()
  }, [])

  const handleEdit = (claim: Claim) => {
    setEditingId(claim.id)
    setEditForm({
      rewritten_sentence: claim.rewritten_sentence || '',
      tech_stack: claim.tech_stack?.join(', ') || '',
      metric_type: claim.metric_type || '',
      metric_value: claim.metric_value || '',
      scope: claim.scope || '',
    })
  }

  const handleSave = async (id: string) => {
    const supabase = createClient()

    await supabase.from('rmc_claims').update({
      rewritten_sentence: editForm.rewritten_sentence,
      tech_stack: editForm.tech_stack.split(',').map((s) => s.trim()).filter(Boolean),
      metric_type: editForm.metric_type || null,
      metric_value: editForm.metric_value || null,
      scope: editForm.scope || null,
    }).eq('id', id)

    setClaims((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              rewritten_sentence: editForm.rewritten_sentence,
              tech_stack: editForm.tech_stack.split(',').map((s) => s.trim()).filter(Boolean),
              metric_type: editForm.metric_type || null,
              metric_value: editForm.metric_value || null,
              scope: editForm.scope || null,
            }
          : c
      )
    )

    setEditingId(null)
  }

  if (loading) {
    return <div className="p-8 text-text-muted">Loading...</div>
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-base">Library</h1>
        <p className="text-text-muted mt-2">Browse and manage your extracted data.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-bg-border mb-6">
        {(['experience', 'skills', 'education'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 px-1 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text-base'
            }`}
          >
            {tab === 'experience' && 'Experience'}
            {tab === 'skills' && 'Skills'}
            {tab === 'education' && 'Education & Credentials'}
          </button>
        ))}
      </div>

      {/* Experience Tab */}
      {activeTab === 'experience' && (
        <div>
          {claims.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-muted">No enriched claims yet.</p>
              <Link href="/enrich">
                <Button variant="ghost" className="mt-4">
                  Go to Enrichment
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {claims.map((claim) => (
                <Card key={claim.id} className="p-4">
                  {editingId === claim.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editForm.rewritten_sentence}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, rewritten_sentence: e.target.value }))
                        }
                        placeholder="Rewritten sentence"
                        className="w-full bg-bg-app border border-bg-border rounded px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        value={editForm.tech_stack}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, tech_stack: e.target.value }))
                        }
                        placeholder="Tech stack (comma-separated)"
                        className="w-full bg-bg-app border border-bg-border rounded px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editForm.metric_type}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, metric_type: e.target.value }))
                          }
                          placeholder="Metric type"
                          className="flex-1 bg-bg-app border border-bg-border rounded px-3 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={editForm.metric_value}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, metric_value: e.target.value }))
                          }
                          placeholder="Metric value"
                          className="flex-1 bg-bg-app border border-bg-border rounded px-3 py-2 text-sm"
                        />
                        <input
                          type="text"
                          value={editForm.scope}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, scope: e.target.value }))
                          }
                          placeholder="Scope"
                          className="flex-1 bg-bg-app border border-bg-border rounded px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSave(claim.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-accent">
                            {claim.company?.name || 'Unknown'}
                          </p>
                          <p className="text-sm text-text-base mt-1">
                            {claim.rewritten_sentence || claim.raw_text}
                          </p>
                          {claim.tech_stack && claim.tech_stack.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {claim.tech_stack.map((tech) => (
                                <Badge key={tech} variant="accent">
                                  {tech}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {(claim.metric_value || claim.scope) && (
                            <p className="text-xs text-text-muted mt-2">
                              {claim.metric_type}: {claim.metric_value} • {claim.scope}
                            </p>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(claim)}>
                          Edit
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Skills Tab */}
      {activeTab === 'skills' && (
        <div>
          {skills.length === 0 ? (
            <p className="text-text-muted text-center py-12">No skills extracted yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <Badge key={skill.id} variant="accent">
                  {skill.skill}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Education Tab */}
      {activeTab === 'education' && (
        <div className="space-y-8">
          {['degree', 'training', 'certification'].map((type) => {
            const filtered = credentials.filter((c) => c.type === type)
            if (filtered.length === 0) return null

            return (
              <div key={type}>
                <h3 className="text-lg font-medium text-text-base mb-4 capitalize">{type}s</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {filtered.map((cred) => (
                    <Card key={cred.id} className="p-4">
                      <p className="font-medium text-text-base">{cred.title}</p>
                      {cred.institution && (
                        <p className="text-sm text-text-muted">{cred.institution}</p>
                      )}
                      {cred.year && <p className="text-xs text-text-muted mt-1">{cred.year}</p>}
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}

          {credentials.length === 0 && (
            <p className="text-text-muted text-center py-12">
              No education or credentials extracted yet.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
