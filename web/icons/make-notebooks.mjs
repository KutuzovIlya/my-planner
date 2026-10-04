// Варианты расцветки «Ежедневника»
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const dir = fileURLToPath(new URL('.', import.meta.url))
const tpl = readFileSync(dir + 'notebook-template.svg', 'utf8')

const GOLD = ['#FFF3C4', '#F5C55A', '#C98B2A', '#FBE29A']
const SILVER = ['#FFFFFF', '#D9DEE8', '#9AA3B5', '#F2F4F8']
const ROSE = ['#FFE3D6', '#F2A98A', '#C26A4A', '#FFD2BF']

const palettes = {
  'nb1-ivory': { bg: ['#26262B', '#0E0E11'], cover: ['#FFFDF7', '#F1EADB', '#DCD1BC'], spine: '#C9BCA2', foil: GOLD, ribbon: '#B8862F', shadow: '#000000', pages: ['#F3EAD8', '#D9CBB0'] },
  'nb2-classicred': { bg: ['#FFFFFF', '#E9E9EE'], cover: ['#F0453A', '#D12A22', '#A81B16'], spine: '#7E120E', foil: ['#FFFFFF', '#FFF3F2', '#F2D6D4', '#FFFFFF'], ribbon: '#1F1F24', shadow: '#5A1410', pages: ['#FBF6EC', '#DCD0BC'] },
  'nb3-navyrose': { bg: ['#FFE9DE', '#FFC9B5'], cover: ['#24305E', '#18214A', '#0F1533'], spine: '#0A0F26', foil: ROSE, ribbon: '#F28C6A', shadow: '#6E2E1E', pages: ['#FFF7EF', '#E3D2C2'] },
  'nb4-forest': { bg: ['#E8F0E2', '#C5D8BC'], cover: ['#2F5D44', '#234A35', '#173426'], spine: '#10261B', foil: ['#FFF8E7', '#F1E3C2', '#CDB991', '#FFF4DA'], ribbon: '#D9A441', shadow: '#24402F', pages: ['#F8F3E6', '#D8CDB5'] },
  'nb5-mustard': { bg: ['#2E2E33', '#141417'], cover: ['#FFC83D', '#F2AE12', '#D18F00'], spine: '#A86F00', foil: ['#3A3A40', '#1E1E22', '#0A0A0C', '#2E2E33'], ribbon: '#E0284E', shadow: '#000000', pages: ['#FFF8EA', '#E3D3B5'] },
  'nb6-graphite': { bg: ['#0D0D10', '#000000'], cover: ['#4A4D55', '#33363C', '#222428'], spine: '#16171A', foil: ['#E9FF8A', '#C6FF3D', '#8FD400', '#E2FF6B'], ribbon: '#C6FF3D', shadow: '#000000', pages: ['#EDEDED', '#BDBDBD'] },
  'nb7-royal': { bg: ['#DCE8FF', '#A9C4FF'], cover: ['#3B6CFF', '#2453E8', '#1A3CC0'], spine: '#132E96', foil: ['#FFFFFF', '#F1F5FF', '#CCDAFF', '#FFFFFF'], ribbon: '#FF5A5F', shadow: '#1A2E80', pages: ['#FFFFFF', '#D3DBEF'] },
  'nb8-pink': { bg: ['#FFE3EC', '#FFC1D6'], cover: ['#FF6FA3', '#F0447F', '#D12A64'], spine: '#A81B4C', foil: GOLD, ribbon: '#7B2CBF', shadow: '#8E1F4A', pages: ['#FFF8F2', '#EBD4CB'] },
}

for (const [name, p] of Object.entries(palettes)) {
  let s = tpl
  s = s.replace('stop-color="#F7EEDF"/><stop offset="1" stop-color="#E6CFAE"', `stop-color="${p.bg[0]}"/><stop offset="1" stop-color="${p.bg[1]}"`)
  s = s.replace('stop-color="#2B4FC9"/><stop offset="0.6" stop-color="#1B3496"/><stop offset="1" stop-color="#132570"', `stop-color="${p.cover[0]}"/><stop offset="0.6" stop-color="${p.cover[1]}"/><stop offset="1" stop-color="${p.cover[2]}"`)
  s = s.replace('stop-color="#0E1C55"/><stop offset="1" stop-color="#1B3496"', `stop-color="${p.spine}"/><stop offset="1" stop-color="${p.cover[1]}"`)
  s = s.replace('stop-color="#FFF3C4"/><stop offset="0.4" stop-color="#F5C55A"/><stop offset="0.75" stop-color="#C98B2A"/><stop offset="1" stop-color="#FBE29A"',
    `stop-color="${p.foil[0]}"/><stop offset="0.4" stop-color="${p.foil[1]}"/><stop offset="0.75" stop-color="${p.foil[2]}"/><stop offset="1" stop-color="${p.foil[3]}"`)
  s = s.replace('fill="#E0284E"', `fill="${p.ribbon}"`)
  s = s.replace('flood-color="#5C3B12"', `flood-color="${p.shadow}"`)
  s = s.replace('fill="#F3EAD8"', `fill="${p.pages[0]}"`).replace('stroke="#D9CBB0"', `stroke="${p.pages[1]}"`)
  writeFileSync(dir + name + '.svg', s)
}
