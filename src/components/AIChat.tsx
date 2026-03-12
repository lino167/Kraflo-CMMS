import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send,
  Bot,
  User,
  Loader2,
  Wrench,
  FileText,
  AlertTriangle,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { supabase } from '@/integrations/supabase/client'
import { handleError, isRateLimitError, isAuthError } from '@/lib/error-handler'
import DOMPurify from 'dompurify'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  fontes?: {
    manuais_consultados: number
    os_similares: number
  }
  timestamp: Date
}

interface AIChatProps {
  empresaId?: string
  tecnicoId?: number
  initialQuestion?: string | null
  onQuestionHandled?: () => void
}

const STORAGE_KEY = 'kraflo_ai_chat'

interface StoredChat {
  messages: Message[]
  conversaId: string | null
  timestamp: number
}

export function AIChat({
  empresaId,
  tecnicoId,
  initialQuestion,
  onQuestionHandled,
}: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversaId, setConversaId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load messages from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const data: StoredChat = JSON.parse(stored)
        // Only restore if less than 24 hours old
        const isRecent = Date.now() - data.timestamp < 24 * 60 * 60 * 1000
        if (isRecent && data.messages.length > 0) {
          // Convert timestamp strings back to Date objects
          const restoredMessages = data.messages.map((m) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }))
          setMessages(restoredMessages)
          setConversaId(data.conversaId)
        }
      } catch (e) {
        console.error('Failed to restore chat:', e)
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  // Save messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0) {
      const data: StoredChat = {
        messages,
        conversaId,
        timestamp: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  }, [messages, conversaId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (initialQuestion && !isLoading) {
      setInput(initialQuestion)
      onQuestionHandled?.()
    }
  }, [initialQuestion, isLoading, onQuestionHandled])

  const clearChat = useCallback(() => {
    setMessages([])
    setConversaId(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const { data, error } = await supabase.functions.invoke('assistente-ia', {
        body: {
          mensagem: userMessage.content,
          empresa_id: empresaId,
          conversa_id: conversaId,
          tecnico_id: tecnicoId,
        },
      })

      if (error) throw error

      if (data.error) {
        throw new Error(data.error)
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.resposta,
        fontes: data.fontes,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])

      if (data.conversa_id && !conversaId) {
        setConversaId(data.conversa_id)
      }
    } catch (error) {
      const appError = handleError(error, {
        showToast: true,
        logToConsole: true,
      })

      if (isRateLimitError(appError)) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content:
              '⚠️ Limite de requisições atingido. Por favor, aguarde alguns minutos antes de enviar novas mensagens.',
            timestamp: new Date(),
          },
        ])
      } else if (isAuthError(appError)) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '⚠️ Sua sessão expirou. Por favor, faça login novamente.',
            timestamp: new Date(),
          },
        ])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const renderMarkdown = (content: string) => {
    const lines = content.split('\n')
    return lines.map((line, index) => {
      if (line.startsWith('### ')) {
        return (
          <h3
            key={index}
            className="text-lg font-semibold text-primary mt-4 mb-2"
          >
            {line.slice(4)}
          </h3>
        )
      }
      if (line.startsWith('## ')) {
        return (
          <h2 key={index} className="text-xl font-bold text-primary mt-4 mb-2">
            {line.slice(3)}
          </h2>
        )
      }
      if (line.startsWith('# ')) {
        return (
          <h1 key={index} className="text-2xl font-bold text-primary mt-4 mb-2">
            {line.slice(2)}
          </h1>
        )
      }

      if (line.match(/^\d+\.\s/)) {
        return (
          <li key={index} className="ml-6 list-decimal">
            {formatInlineMarkdown(line.replace(/^\d+\.\s/, ''))}
          </li>
        )
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={index} className="ml-6 list-disc">
            {formatInlineMarkdown(line.slice(2))}
          </li>
        )
      }

      if (!line.trim()) {
        return <br key={index} />
      }

      return (
        <p key={index} className="mb-2">
          {formatInlineMarkdown(line)}
        </p>
      )
    })
  }

  const formatInlineMarkdown = (text: string) => {
    text = text.replace(
      /\*\*(.*?)\*\*/g,
      "<strong class='text-primary'>$1</strong>",
    )
    text = text.replace(
      /`([^`]+)`/g,
      "<code class='bg-secondary px-1 py-0.5 rounded text-sm'>$1</code>",
    )

    const sanitizedHtml = DOMPurify.sanitize(text, {
      ALLOWED_TAGS: ['strong', 'code'],
      ALLOWED_ATTR: ['class'],
    })

    return <span dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border bg-secondary/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-mono font-semibold text-foreground">
              Assistente de Manutenção
            </h2>
            <p className="text-sm text-muted-foreground">
              IA treinada com manuais e histórico de OS
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearChat}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="p-4 bg-primary/10 rounded-full mb-4">
              <Wrench className="h-12 w-12 text-primary" />
            </div>
            <h3 className="font-mono text-lg font-semibold mb-2">
              Como posso ajudar?
            </h3>
            <p className="text-muted-foreground max-w-md">
              Pergunte sobre diagnósticos, procedimentos de manutenção, ou
              consulte informações dos manuais técnicos.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {[
                'Como ajustar a tensão do tear Picanol?',
                'Problema de ruído no motor',
                'Verificar sensor de proximidade',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-lg transition-colors text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 animate-slide-up ${
                  message.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    message.role === 'user' ? 'bg-primary/20' : 'bg-secondary'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="h-5 w-5 text-primary" />
                  ) : (
                    <Bot className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div
                  className={`flex-1 p-4 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-primary/10 border border-primary/20'
                      : 'bg-secondary/50 border border-border'
                  }`}
                >
                  <div className="prose-industrial text-sm">
                    {message.role === 'assistant'
                      ? renderMarkdown(message.content)
                      : message.content}
                  </div>

                  {message.fontes &&
                    (message.fontes.manuais_consultados > 0 ||
                      message.fontes.os_similares > 0) && (
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                        {message.fontes.manuais_consultados > 0 && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {message.fontes.manuais_consultados} trecho(s) de
                            manuais
                          </div>
                        )}
                        {message.fontes.os_similares > 0 && (
                          <div className="flex items-center gap-1">
                            <Wrench className="h-3 w-3" />
                            {message.fontes.os_similares} OS similar(es)
                          </div>
                        )}
                      </div>
                    )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 animate-slide-up">
                <div className="p-2 rounded-lg bg-secondary shrink-0">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 p-4 rounded-lg bg-secondary/50 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Analisando...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border bg-secondary/30">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Descreva o problema ou faça uma pergunta..."
            className="min-h-[60px] resize-none bg-background border-border focus:border-primary"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="h-auto px-4 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          <AlertTriangle className="h-3 w-3 inline mr-1" />A IA pode cometer
          erros. Sempre verifique procedimentos críticos nos manuais oficiais.
        </p>
      </div>
    </div>
  )
}
