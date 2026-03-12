/**
 * Storage service for uploading and managing files in Supabase Storage
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logger } from '../infra/logger.ts';

const BUCKET_NAME = 'anexos-os';

/**
 * Upload a photo to storage
 */
export async function uploadPhoto(
  supabase: SupabaseClient,
  buffer: ArrayBuffer,
  empresaId: string,
  osId: number,
  type: 'abertura' | 'fechamento'
): Promise<string | null> {
  try {
    const fileName = `${empresaId}/${osId}_${type}_${Date.now()}.jpg`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      logger.error('Storage upload error', error, { osId, type });
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    logger.info('Photo uploaded successfully', { osId, type, fileName });
    return urlData.publicUrl;
  } catch (error) {
    logger.error('Error uploading to storage', error);
    return null;
  }
}

/**
 * Upload a PDF report to storage
 */
export async function uploadPdfReport(
  supabase: SupabaseClient,
  pdfBytes: Uint8Array,
  empresaId: string,
  startDate: string,
  endDate: string
): Promise<string | null> {
  try {
    const fileName = `relatorios/${empresaId}/relatorio_${startDate}_${endDate}.pdf`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      logger.error('PDF upload error', error, { empresaId });
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    logger.error('Error uploading PDF', error);
    return null;
  }
}
