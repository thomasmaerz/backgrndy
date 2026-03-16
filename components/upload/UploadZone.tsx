'use client'

import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { UploadCloud, X, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error'
  error?: string
  stats?: {
    experience: number
    skills: number
    degrees: number
    trainings: number
    certifications: number
    duplicatesSkipped: number
  }
}

export function UploadZone() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase()
      return ['pdf', 'docx', 'csv'].includes(ext || '')
    })

    addFiles(droppedFiles)
  }

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      addFiles(selectedFiles)
    }
  }

  const addFiles = (newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'pending',
    }))

    setFiles((prev) => [...prev, ...uploadFiles])
    processFiles([...files, ...uploadFiles])
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const processFiles = async (allFiles: UploadFile[]) => {
    for (const uploadFile of allFiles) {
      if (uploadFile.status !== 'pending') continue

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
        )
      )

      try {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, status: 'processing' } : f
          )
        )

        const formData = new FormData()
        formData.append('file', uploadFile.file)

        const response = await fetch('/api/ingest', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Upload failed')
        }

        const data = await response.json()

        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? {
                  ...f,
                  status: 'done',
                  stats: data.stats,
                }
              : f
          )
        )
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? {
                  ...f,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Upload failed',
                }
              : f
          )
        )
      }
    }
  }

  const handleUpload = () => {
    const pendingFiles = files.filter((f) => f.status === 'pending')
    if (pendingFiles.length > 0) {
      processFiles(pendingFiles)
    }
  }

  const hasPending = files.some((f) => f.status === 'pending')

  return (
    <div className="space-y-6">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all duration-200
          ${
            isDragging
              ? 'border-accent bg-accent-muted'
              : 'border-bg-border hover:border-accent/50 hover:bg-bg-surface'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.csv"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-4">
          <UploadCloud className="h-12 w-12 text-text-muted" />
          <div>
            <p className="text-text-base font-medium">
              Drop resumes here or click to browse
            </p>
            <p className="text-sm text-text-muted mt-1">
              Supports PDF, DOCX, and CSV files
            </p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            {files.map((uploadFile) => (
              <div
                key={uploadFile.id}
                className="flex items-center justify-between rounded-lg bg-bg-surface p-4 border border-bg-border"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-text-muted" />
                  <div>
                    <p className="text-sm font-medium text-text-base">
                      {uploadFile.file.name}
                    </p>
                    {uploadFile.status === 'done' && uploadFile.stats && (
                      <div className="flex gap-3 mt-1 text-xs text-text-muted">
                        <span>Exp: {uploadFile.stats.experience}</span>
                        <span>Skills: {uploadFile.stats.skills}</span>
                        <span>Degrees: {uploadFile.stats.degrees}</span>
                        <span>Certs: {uploadFile.stats.certifications}</span>
                      </div>
                    )}
                    {uploadFile.status === 'error' && (
                      <p className="text-xs text-red-500 mt-1">
                        {uploadFile.error}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {uploadFile.status === 'pending' && (
                    <span className="w-2 h-2 rounded-full bg-text-muted" />
                  )}
                  {uploadFile.status === 'uploading' && <Spinner size="sm" />}
                  {uploadFile.status === 'processing' && (
                    <span className="text-xs text-accent animate-pulse">
                      Processing...
                    </span>
                  )}
                  {uploadFile.status === 'done' && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {uploadFile.status === 'error' && (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(uploadFile.id)
                    }}
                    className="p-1 hover:bg-bg-border rounded"
                  >
                    <X className="h-4 w-4 text-text-muted" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {hasPending && (
            <Button onClick={handleUpload} disabled={!hasPending}>
              Upload {files.filter((f) => f.status === 'pending').length} files
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
