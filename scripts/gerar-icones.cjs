/**
 * Gera os ícones PNG do app a partir dos SVG em public/.
 *   - icon-192.png / icon-512.png: ícone com cantos arredondados (propósito "any")
 *   - icon-maskable-512.png: quadrado cheio com o "K" na zona segura (propósito "maskable")
 *   - apple-touch-icon.png: 180x180 quadrado, sem transparência (o iPhone aplica a própria máscara)
 *
 * Uso: node scripts/gerar-icones.cjs   (precisa do Playwright instalado)
 */
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const pub = path.join(__dirname, '..', 'public')
const svg = (f) => fs.readFileSync(path.join(pub, f), 'utf8')

async function png(browser, svgText, tamanho, saida, fundoCheio = false) {
  const page = await browser.newPage({ viewport: { width: tamanho, height: tamanho } })
  const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svgText).toString('base64')
  await page.setContent(
    `<html><body style="margin:0;background:${fundoCheio ? '#ff8c1a' : 'transparent'}">` +
      `<img src="${dataUrl}" width="${tamanho}" height="${tamanho}" style="display:block"></body></html>`,
  )
  await page.waitForTimeout(150)
  await page.screenshot({ path: path.join(pub, saida), omitBackground: !fundoCheio, clip: { x: 0, y: 0, width: tamanho, height: tamanho } })
  await page.close()
  console.log('gerado', saida, tamanho + 'px')
}

;(async () => {
  const browser = await chromium.launch()
  await png(browser, svg('icon.svg'), 192, 'icon-192.png')
  await png(browser, svg('icon.svg'), 512, 'icon-512.png')
  await png(browser, svg('icon-maskable.svg'), 512, 'icon-maskable-512.png', true)
  await png(browser, svg('icon.svg'), 180, 'apple-touch-icon.png', true)
  await browser.close()
})()
