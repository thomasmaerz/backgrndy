'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface StagingBullet {
  id: string;
  raw_bullet: string;
  section: string;
}

interface Claim {
  id: string;
  enrichment_status: string;
  enrichment_notes: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function EnrichPage() {
  const [bullets, setBullets] = useState<StagingBullet[]>([]);
  const [selectedBullet, setSelectedBullet] = useState<StagingBullet | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    enriched: number;
    needInput: number;
    remaining: number;
  } | null>(null);

  const supabase = createClient();

  const fetchBullets = useCallback(async () => {
    // Get bullets that have no corresponding claim or have pending claims
    const { data: allBullets } = await supabase
      .from('rm_bullets_staging')
      .select('id, raw_bullet, section')
      .eq('is_duplicate', false)
      .order('created_at', { ascending: true });

    if (!allBullets) return;

    // Filter to only bullets without enriched claims
    const bulletsWithClaims = await Promise.all(
      allBullets.map(async (bullet) => {
        const { data: claim } = await supabase
          .from('rm_claims')
          .select('id, enrichment_status, enrichment_notes')
          .eq('staging_id', bullet.id)
          .in('enrichment_status', ['enriched', 'skipped'])
          .single();
        return { ...bullet, hasClaim: !!claim };
      })
    );

    setBullets(bulletsWithClaims.filter(b => !b.hasClaim).map(b => ({
      id: b.id,
      raw_bullet: b.raw_bullet,
      section: b.section,
    })));
  }, [supabase]);

  useEffect(() => {
    fetchBullets();
  }, [fetchBullets]);

  const selectBullet = useCallback(async (bullet: StagingBullet) => {
    setSelectedBullet(bullet);
    setError(null);
    setUserInput('');

    // Check for existing pending claim
    const { data: existingClaim } = await supabase
      .from('rm_claims')
      .select('id, enrichment_status, enrichment_notes')
      .eq('staging_id', bullet.id)
      .eq('enrichment_status', 'pending')
      .single();

    if (existingClaim) {
      setClaim(existingClaim);
      setConversationHistory([]);
    } else {
      setClaim(null);
      setConversationHistory([]);
    }
  }, [supabase]);

  const handleSubmit = async () => {
    if (!selectedBullet || (!userInput.trim() && !claim)) return;

    setIsTyping(true);
    setError(null);

    try {
      // Optimistically remove from queue
      setBullets(prev => prev.filter(b => b.id !== selectedBullet.id));

      const response = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stagingId: selectedBullet.id,
          conversationHistory,
          userMessage: userInput || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Rollback - add bullet back to queue
        setBullets(prev => [selectedBullet, ...prev]);
        setError(result.error || 'Enrichment failed');
        return;
      }

      if (result.status === 'complete') {
        // Move to next bullet
        const remaining = bullets.filter(b => b.id !== selectedBullet.id);
        if (remaining.length > 0) {
          selectBullet(remaining[0]);
        } else {
          setSelectedBullet(null);
        }
      } else if (result.status === 'needs_input') {
        setConversationHistory(result.conversationHistory || []);
        setClaim({ 
          id: result.claimId, 
          enrichment_status: 'pending', 
          enrichment_notes: JSON.stringify(result.partialClaim) 
        });
        setUserInput('');
      }
    } catch (err) {
      setBullets(prev => [selectedBullet, ...prev]);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsTyping(false);
    }
  };

  const handleSkip = async () => {
    if (!selectedBullet) return;

    setIsLoading(true);

    try {
      // Optimistic update
      setBullets(prev => prev.filter(b => b.id !== selectedBullet.id));

      const response = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stagingId: selectedBullet.id,
          action: 'skip',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setBullets(prev => [selectedBullet, ...prev]);
        setError(result.error || 'Skip failed');
        return;
      }

      // Move to next
      const remaining = bullets.filter(b => b.id !== selectedBullet.id);
      if (remaining.length > 0) {
        selectBullet(remaining[0]);
      } else {
        setSelectedBullet(null);
      }
    } catch (err) {
      setBullets(prev => [selectedBullet, ...prev]);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const runBatch = async (cursor?: string) => {
    setIsBatchRunning(true);
    
    try {
      const response = await fetch('/api/enrich/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursor, batchSize: 5 }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Batch enrichment failed');
        return;
      }

      setBatchProgress({
        enriched: result.enriched,
        needInput: result.needsInput,
        remaining: result.nextCursor ? -1 : 0,
      });

      if (result.nextCursor) {
        await runBatch(result.nextCursor);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch failed');
    } finally {
      setIsBatchRunning(false);
      fetchBullets();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Enrichment Agent</h1>
          <button
            onClick={() => runBatch()}
            disabled={isBatchRunning || bullets.length === 0}
            className={`
              px-4 py-2 rounded-lg font-medium
              ${isBatchRunning || bullets.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
              }
            `}
          >
            {isBatchRunning ? 'Batch Processing...' : 'Batch Enrich All'}
          </button>
        </div>

        {batchProgress && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800">
              Enriched: {batchProgress.enriched} | Need Input: {batchProgress.needInput}
              {batchProgress.remaining === 0 && ' | Complete!'}
            </p>
          </div>
        )}

        <div className="flex gap-6">
          {/* Queue list */}
          <div className="w-1/3 bg-white rounded-lg shadow p-4">
            <h2 className="font-medium text-gray-700 mb-4">
              Pending ({bullets.length})
            </h2>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {bullets.map(bullet => (
                <div
                  key={bullet.id}
                  onClick={() => selectBullet(bullet)}
                  className={`
                    p-3 rounded cursor-pointer text-sm truncate
                    ${selectedBullet?.id === bullet.id
                      ? 'bg-blue-100 border border-blue-300'
                      : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                    }
                  `}
                >
                  {bullet.raw_bullet}
                </div>
              ))}
              {bullets.length === 0 && (
                <p className="text-gray-400 text-sm">No bullets to enrich</p>
              )}
            </div>
          </div>

          {/* Chat panel */}
          <div className="w-2/3 bg-white rounded-lg shadow p-6">
            {selectedBullet ? (
              <>
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Raw Bullet:</p>
                  <p className="text-gray-900">{selectedBullet.raw_bullet}</p>
                </div>

                {/* Conversation */}
                <div className="mb-4 space-y-3 max-h-[40vh] overflow-y-auto">
                  {conversationHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`
                        p-3 rounded-lg
                        ${msg.role === 'user' 
                          ? 'bg-blue-100 ml-8' 
                          : 'bg-gray-100 mr-8'
                        }
                      `}
                    >
                      {msg.content}
                    </div>
                  ))}
                  {isTyping && (
                    <div className="bg-gray-100 mr-8 p-3 rounded-lg">
                      <span className="text-gray-500">Typing...</span>
                    </div>
                  )}
                </div>

                {/* Error display */}
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                {/* Input */}
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={userInput}
                    onChange={e => setUserInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    placeholder="Your answer..."
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    disabled={isTyping}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={isTyping || (!userInput.trim() && !claim)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isTyping ? '...' : 'Send'}
                  </button>
                </div>

                {/* Skip button */}
                <div className="mt-3">
                  <button
                    onClick={handleSkip}
                    disabled={isLoading}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Skip this bullet
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-400 py-12">
                Select a bullet from the queue to begin enrichment
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
