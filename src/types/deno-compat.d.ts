declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export type SupabaseClient = any
  export function createClient<Database = any>(...args: any[]): SupabaseClient
}

declare module 'https://esm.sh/@supabase/supabase-js@2.39.3' {
  export type SupabaseClient = any
  export function createClient<Database = any>(...args: any[]): SupabaseClient
}

declare module 'https://esm.sh/@supabase/supabase-js@2.49.1' {
  export type SupabaseClient = any
  export function createClient<Database = any>(...args: any[]): SupabaseClient
}

declare module 'https://esm.sh/pdf-lib@1.17.1' {
  export const PDFDocument: unknown
  export const StandardFonts: unknown
  export const rgb: unknown
}
