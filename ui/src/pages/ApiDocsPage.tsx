import { useEffect, useState } from 'react'
import { loadRuntimeConfig } from '@/config/runtime'

const httpMethods = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
] as const

type HttpMethod = (typeof httpMethods)[number]

interface OpenAPIOperation {
  description?: string
  summary?: string
  tags?: string[]
  responses?: Record<string, { description?: string }>
}

interface OpenAPISpec {
  info?: {
    description?: string
    title?: string
    version?: string
  }
  paths?: Record<string, Partial<Record<HttpMethod, OpenAPIOperation>>>
}

const methodStyles: Record<HttpMethod, string> = {
  get: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  post: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  put: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  patch: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
  delete: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  options: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  head: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
}

export function ApiDocsPage() {
  const [specUrl, setSpecUrl] = useState<string | null>(null)
  const [spec, setSpec] = useState<OpenAPISpec | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadSpec() {
      try {
        const cfg = await loadRuntimeConfig()
        if (!cfg.api?.baseUrl) {
          return
        }

        const url = `${cfg.api.baseUrl}/api/v1/openapi.json`
        setSpecUrl(url)
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }
        setSpec((await response.json()) as OpenAPISpec)
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Failed to load API specification')
        }
      }
    }

    void loadSpec()
    return () => controller.abort()
  }, [])

  if (error) {
    return (
      <div className="flex min-h-64 items-center justify-center text-red-600 dark:text-red-400">
        Unable to load API documentation: {error}
      </div>
    )
  }

  if (!specUrl || !spec) {
    return (
      <div className="flex min-h-64 items-center justify-center text-gray-500 dark:text-gray-400">
        {specUrl ? 'Loading API documentation…' : 'API not configured'}
      </div>
    )
  }

  const operations = Object.entries(spec.paths ?? {}).flatMap(([path, pathItem]) =>
    httpMethods.flatMap((method) => {
      const operation = pathItem[method]
      return operation ? [{ method, operation, path }] : []
    }),
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <header className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-950 dark:text-white">
            {spec.info?.title ?? 'API reference'}
          </h1>
          {spec.info?.version && (
            <span className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {spec.info.version}
            </span>
          )}
        </div>
        {spec.info?.description && (
          <p className="mt-3 whitespace-pre-line text-sm text-gray-600 dark:text-gray-400">
            {spec.info.description}
          </p>
        )}
        <a
          className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
          href={specUrl}
          rel="noreferrer"
          target="_blank"
        >
          View OpenAPI JSON
        </a>
      </header>

      <div className="space-y-3">
        {operations.map(({ method, operation, path }) => (
          <details
            className="group overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
            key={`${method}:${path}`}
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
              <span
                className={`w-16 rounded px-2 py-1 text-center font-mono text-xs font-semibold uppercase ${methodStyles[method]}`}
              >
                {method}
              </span>
              <code className="min-w-0 flex-1 break-all text-sm text-gray-900 dark:text-gray-100">
                {path}
              </code>
              <span className="hidden text-sm text-gray-500 sm:block dark:text-gray-400">
                {operation.summary}
              </span>
            </summary>
            <div className="space-y-4 border-t border-gray-200 p-4 dark:border-gray-800">
              {(operation.summary || operation.description) && (
                <div>
                  {operation.summary && (
                    <h2 className="font-medium text-gray-950 dark:text-white">
                      {operation.summary}
                    </h2>
                  )}
                  {operation.description && (
                    <p className="mt-1 whitespace-pre-line text-sm text-gray-600 dark:text-gray-400">
                      {operation.description}
                    </p>
                  )}
                </div>
              )}
              {operation.responses && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Responses
                  </h3>
                  <div className="space-y-1">
                    {Object.entries(operation.responses).map(([status, response]) => (
                      <div className="flex gap-3 text-sm" key={status}>
                        <code className="w-12 font-semibold text-gray-900 dark:text-gray-100">
                          {status}
                        </code>
                        <span className="text-gray-600 dark:text-gray-400">
                          {response.description ?? 'No description'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
