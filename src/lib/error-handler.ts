/**
 * Centralized Error Handler for KRAFLO
 * Provides consistent error handling across the application
 */

import { toast } from '@/components/ui/sonner'

// Error codes for the application
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  CREDITS_EXHAUSTED: 'CREDITS_EXHAUSTED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const

export type AppErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export interface AppError {
  code: AppErrorCode
  message: string
  details?: string
  statusCode?: number
}

// User-friendly error messages in Portuguese
const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  [ERROR_CODES.NETWORK_ERROR]:
    'Erro de conexão. Verifique sua internet e tente novamente.',
  [ERROR_CODES.RATE_LIMIT]:
    'Limite de requisições excedido. Aguarde alguns minutos e tente novamente.',
  [ERROR_CODES.CREDITS_EXHAUSTED]:
    'Créditos de IA esgotados. Entre em contato com o administrador.',
  [ERROR_CODES.VALIDATION_ERROR]:
    'Dados inválidos. Verifique os campos e tente novamente.',
  [ERROR_CODES.AUTH_ERROR]: 'Erro de autenticação. Faça login novamente.',
  [ERROR_CODES.PERMISSION_DENIED]:
    'Acesso não autorizado. Você não tem permissão para esta ação.',
  [ERROR_CODES.NOT_FOUND]: 'Recurso não encontrado.',
  [ERROR_CODES.SERVER_ERROR]:
    'Erro no servidor. Tente novamente em alguns instantes.',
  [ERROR_CODES.UNKNOWN]: 'Ocorreu um erro inesperado. Tente novamente.',
}

/**
 * Parses an error and returns a standardized AppError
 */
export function parseError(error: unknown): AppError {
  // Handle Supabase/fetch errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Network errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('failed to fetch')
    ) {
      return {
        code: ERROR_CODES.NETWORK_ERROR,
        message: ERROR_MESSAGES[ERROR_CODES.NETWORK_ERROR],
      }
    }

    // Rate limiting
    if (
      message.includes('rate') ||
      message.includes('limit') ||
      message.includes('429')
    ) {
      return {
        code: ERROR_CODES.RATE_LIMIT,
        message: ERROR_MESSAGES[ERROR_CODES.RATE_LIMIT],
        statusCode: 429,
      }
    }

    // Credits exhausted
    if (message.includes('credit') || message.includes('402')) {
      return {
        code: ERROR_CODES.CREDITS_EXHAUSTED,
        message: ERROR_MESSAGES[ERROR_CODES.CREDITS_EXHAUSTED],
        statusCode: 402,
      }
    }

    // Auth errors
    if (
      message.includes('auth') ||
      message.includes('token') ||
      message.includes('unauthorized') ||
      message.includes('401')
    ) {
      return {
        code: ERROR_CODES.AUTH_ERROR,
        message: ERROR_MESSAGES[ERROR_CODES.AUTH_ERROR],
        statusCode: 401,
      }
    }

    // Permission denied
    if (
      message.includes('permission') ||
      message.includes('forbidden') ||
      message.includes('403')
    ) {
      return {
        code: ERROR_CODES.PERMISSION_DENIED,
        message: ERROR_MESSAGES[ERROR_CODES.PERMISSION_DENIED],
        statusCode: 403,
      }
    }

    // Not found
    if (message.includes('not found') || message.includes('404')) {
      return {
        code: ERROR_CODES.NOT_FOUND,
        message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND],
        statusCode: 404,
      }
    }

    // Server error
    if (message.includes('500') || message.includes('server')) {
      return {
        code: ERROR_CODES.SERVER_ERROR,
        message: ERROR_MESSAGES[ERROR_CODES.SERVER_ERROR],
        statusCode: 500,
      }
    }

    // Return the original message if it's user-friendly
    return {
      code: ERROR_CODES.UNKNOWN,
      message: error.message,
      details: error.stack,
    }
  }

  // Handle object errors with 'error' property
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const errObj = error as { error: string; status?: number }
    return parseError(new Error(errObj.error))
  }

  // Handle string errors
  if (typeof error === 'string') {
    return parseError(new Error(error))
  }

  return {
    code: ERROR_CODES.UNKNOWN,
    message: ERROR_MESSAGES[ERROR_CODES.UNKNOWN],
  }
}

/**
 * Handles an error by showing a toast and optionally logging to console
 */
export function handleError(
  error: unknown,
  options?: { showToast?: boolean; logToConsole?: boolean },
): AppError {
  const { showToast = true, logToConsole = true } = options || {}
  const appError = parseError(error)

  if (showToast) {
    toast.error(appError.message)
  }

  if (logToConsole && import.meta.env.DEV) {
    console.error(
      '[KRAFLO Error]',
      appError.code,
      appError.message,
      appError.details,
    )
  }

  return appError
}

/**
 * Type guard for checking if an error is a rate limit error
 */
export function isRateLimitError(error: AppError): boolean {
  return error.code === ERROR_CODES.RATE_LIMIT || error.statusCode === 429
}

/**
 * Type guard for checking if an error is an auth error
 */
export function isAuthError(error: AppError): boolean {
  return error.code === ERROR_CODES.AUTH_ERROR || error.statusCode === 401
}

/**
 * Type guard for checking if an error requires user action
 */
export function requiresUserAction(error: AppError): boolean {
  const codesRequiringUserAction: AppErrorCode[] = [
    ERROR_CODES.AUTH_ERROR,
    ERROR_CODES.PERMISSION_DENIED,
    ERROR_CODES.CREDITS_EXHAUSTED,
  ]
  return codesRequiringUserAction.includes(error.code)
}
