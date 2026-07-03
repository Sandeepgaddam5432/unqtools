'use client'

import React, { useState, useCallback } from 'react'
import { ChevronDown, Plus, Trash2, Check, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type APIMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

interface Parameter {
  id: string
  key: string
  value: string
  enabled?: boolean
}

interface APIConfig {
  url: string
  method: APIMethod
  headers: Parameter[]
  query: Parameter[]
  body: Parameter[]
}

type TabType = 'headers' | 'query' | 'body'

const methodColors: Record<APIMethod, string> = {
  GET: 'text-green-500',
  POST: 'text-yellow-500',
  PUT: 'text-blue-500',
  DELETE: 'text-red-500',
  PATCH: 'text-purple-500',
}

function APIPlayground() {
  const [config, setConfig] = useState<APIConfig>({
    url: 'https://api.example.com/users',
    method: 'GET',
    headers: [{ id: '1', key: 'Content-Type', value: 'application/json', enabled: true }],
    query: [{ id: '2', key: 'page', value: '1', enabled: true }],
    body: [],
  })
  const [activeTab, setActiveTab] = useState<TabType>('headers')
  const [response, setResponse] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [responseTime, setResponseTime] = useState<number | null>(null)

  const updateConfig = (key: keyof APIConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const addParameter = (tab: TabType) => {
    const newParam: Parameter = { id: crypto.randomUUID(), key: '', value: '', enabled: true }
    updateConfig(tab, [...(config[tab] as Parameter[]), newParam])
  }

  const removeParameter = (tab: TabType, id: string) => {
    updateConfig(tab, (config[tab] as Parameter[]).filter(p => p.id !== id))
  }

  const updateParameter = (tab: TabType, id: string, field: keyof Parameter, value: string | boolean) => {
    updateConfig(tab, (config[tab] as Parameter[]).map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const handleSend = useCallback(async () => {
    setLoading(true)
    setResponse(null)
    const startTime = performance.now()
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800))
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: {
          users: [
            { id: 1, name: 'John Doe', email: 'john@example.com' },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
            { id: 3, name: 'Bob Wilson', email: 'bob@example.com' },
          ],
          total: 3,
          page: 1,
        }
      }
      setResponseTime(Math.round(performance.now() - startTime))
      setResponse(JSON.stringify(mockResponse, null, 2))
    } catch (error) {
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }, [config])

  const activeParams = config[activeTab] as Parameter[]

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4">
      {/* URL Bar */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className={cn('w-24 justify-between font-mono text-sm', methodColors[config.method])}>
              {config.method}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as APIMethod[]).map(method => (
              <DropdownMenuItem key={method} onClick={() => updateConfig('method', method)} className={cn('font-mono', methodColors[method])}>
                {method}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Input
          value={config.url}
          onChange={(e) => updateConfig('url', e.target.value)}
          placeholder="Enter API URL..."
          className="flex-1 font-mono text-sm"
        />
        <Button onClick={handleSend} disabled={loading} className="gap-2">
          {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Send className="h-4 w-4" />}
          Send
        </Button>
      </div>

      {/* Tabs */}
      <div className="border rounded-lg overflow-hidden">
        <div className="flex border-b bg-muted/30">
          {(['headers', 'query', 'body'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors cursor-pointer',
                activeTab === tab ? 'bg-background text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {(config[tab] as Parameter[]).length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-muted">{(config[tab] as Parameter[]).length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-2">
          {activeParams.map(param => (
            <div key={param.id} className="flex items-center gap-2">
              <Input
                value={param.key}
                onChange={(e) => updateParameter(activeTab, param.id, 'key', e.target.value)}
                placeholder="Key"
                className="flex-1 font-mono text-sm"
              />
              <Input
                value={param.value}
                onChange={(e) => updateParameter(activeTab, param.id, 'value', e.target.value)}
                placeholder="Value"
                className="flex-1 font-mono text-sm"
              />
              <Button variant="ghost" size="icon" onClick={() => removeParameter(activeTab, param.id)} className="cursor-pointer">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addParameter(activeTab)} className="gap-1 cursor-pointer">
            <Plus className="h-3 w-3" /> Add {activeTab.slice(0, -1)}
          </Button>
        </div>
      </div>

      {/* Response */}
      {response && (
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
            <span className="text-sm font-medium">Response</span>
            {responseTime && <span className="text-xs text-muted-foreground">{responseTime}ms</span>}
          </div>
          <pre className="p-4 text-sm font-mono overflow-auto max-h-80 bg-background">
            <code>{response}</code>
          </pre>
        </div>
      )}
    </div>
  )
}

export { APIPlayground }
