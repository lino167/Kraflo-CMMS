/**
 * Telegram API service for sending messages and handling files
 */

import { TELEGRAM_TOKEN } from '../infra/config.ts';
import { logger } from '../infra/logger.ts';

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

/**
 * Send a text message to a chat
 */
export async function sendMessage(
  chatId: number,
  text: string,
  keyboard?: any,
  parseMode?: string
): Promise<void> {
  const body: any = {
    chat_id: chatId,
    text: text,
  };

  if (keyboard) {
    body.reply_markup = keyboard.inline_keyboard ? keyboard : keyboard;
  }

  if (parseMode) {
    body.parse_mode = parseMode;
  }

  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const result = await response.json();
    
    // If markdown parsing failed, retry without parse_mode
    if (!result.ok && parseMode && result.description?.includes('parse')) {
      logger.warn('Markdown parse error, retrying without parse_mode', { 
        chatId, 
        error: result.description 
      });
      
      const retryBody = { ...body };
      delete retryBody.parse_mode;
      
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retryBody),
      });
    } else if (!result.ok) {
      logger.error('Telegram API error', null, { 
        chatId, 
        error: result.description,
        errorCode: result.error_code 
      });
    }
  } catch (error) {
    logger.error('Error sending message', error, { chatId });
  }
}

/**
 * Send a chat action (typing, upload_photo, etc.)
 */
export async function sendChatAction(
  chatId: number,
  action: string
): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (error) {
    logger.error('Error sending chat action', error, { chatId });
  }
}

/**
 * Answer a callback query to remove loading state
 */
export async function answerCallback(callbackQueryId: string): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  } catch (error) {
    logger.error('Error answering callback', error);
  }
}

/**
 * Send a document (PDF, etc.) to a chat
 */
export async function sendDocument(
  chatId: number,
  fileUrl: string,
  caption?: string
): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/sendDocument`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        document: fileUrl, 
        caption 
      }),
    });
  } catch (error) {
    logger.error('Error sending document', error, { chatId });
  }
}

/**
 * Download a file from Telegram servers
 */
export async function downloadTelegramFile(
  fileId: string
): Promise<{ buffer: ArrayBuffer; mimeType: string } | null> {
  try {
    // Get file path from Telegram
    const fileResponse = await fetch(
      `${TELEGRAM_API}/getFile?file_id=${fileId}`
    );
    const fileData = await fileResponse.json();

    if (!fileData.ok || !fileData.result.file_path) {
      logger.error('Failed to get file path', fileData);
      return null;
    }

    const filePath = fileData.result.file_path;

    // Download file
    const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      logger.error('Failed to download file', null, { status: response.status });
      return null;
    }

    const buffer = await response.arrayBuffer();
    const mimeType =
      filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')
        ? 'image/jpeg'
        : 'image/png';

    return { buffer, mimeType };
  } catch (error) {
    logger.error('Error downloading Telegram file', error);
    return null;
  }
}
