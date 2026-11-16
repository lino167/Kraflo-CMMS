/** Reduz a foto para no máximo 1280 px e JPEG ~70%: cabe na fila e sobe rápido em conexão ruim. */
export async function compressPhoto(file: File, maxSide = 1280, quality = 0.7): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a foto')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}
