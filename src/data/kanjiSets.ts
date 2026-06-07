import { KanjiSet } from '../types/game';

export const KANJI_SETS: KanjiSet[] = [
  {
    id: 'elements',
    name: 'Elements',
    description: 'The classical Japanese elements',
    entries: [
      { char: '日', onyomi: 'にち', kunyomi: 'ひ', meaning: 'Sun', radicals: ['日'] },
      { char: '月', onyomi: 'げつ', kunyomi: 'つき', meaning: 'Moon', radicals: ['月'] },
      { char: '火', onyomi: 'か', kunyomi: 'ひ', meaning: 'Fire', radicals: ['火'] },
      { char: '水', onyomi: 'すい', kunyomi: 'みず', meaning: 'Water', radicals: ['水'] },
      { char: '木', onyomi: 'もく', kunyomi: 'き', meaning: 'Tree', radicals: ['木'] },
      { char: '金', onyomi: 'きん', kunyomi: 'かね', meaning: 'Gold', radicals: ['金'] },
      { char: '土', onyomi: 'ど', kunyomi: 'つち', meaning: 'Earth', radicals: ['土'] },
    ],
  },
  {
    id: 'numbers',
    name: 'Numbers',
    description: 'Count from one to ten thousand',
    entries: [
      { char: '一', onyomi: 'いち', kunyomi: 'ひと', meaning: 'One', radicals: ['一'] },
      { char: '二', onyomi: 'に', kunyomi: 'ふた', meaning: 'Two', radicals: ['二'] },
      { char: '三', onyomi: 'さん', kunyomi: 'み', meaning: 'Three', radicals: ['三'] },
      { char: '四', onyomi: 'し', kunyomi: 'よん', meaning: 'Four', radicals: ['囗', '儿'] },
      { char: '五', onyomi: 'ご', kunyomi: 'いつ', meaning: 'Five', radicals: ['五'] },
      { char: '六', onyomi: 'ろく', kunyomi: 'むっ', meaning: 'Six', radicals: ['六'] },
      { char: '七', onyomi: 'しち', kunyomi: 'なな', meaning: 'Seven', radicals: ['七'] },
    ],
  },
  {
    id: 'body',
    name: 'Body Parts',
    description: 'The human body in kanji',
    entries: [
      { char: '目', onyomi: 'もく', kunyomi: 'め', meaning: 'Eye', radicals: ['目'] },
      { char: '耳', onyomi: 'じ', kunyomi: 'みみ', meaning: 'Ear', radicals: ['耳'] },
      { char: '口', onyomi: 'こう', kunyomi: 'くち', meaning: 'Mouth', radicals: ['口'] },
      { char: '手', onyomi: 'しゅ', kunyomi: 'て', meaning: 'Hand', radicals: ['手'] },
      { char: '足', onyomi: 'そく', kunyomi: 'あし', meaning: 'Foot', radicals: ['足'] },
      { char: '頭', onyomi: 'とう', kunyomi: 'あたま', meaning: 'Head', radicals: ['頭'] },
      { char: '心', onyomi: 'しん', kunyomi: 'こころ', meaning: 'Heart', radicals: ['心'] },
    ],
  },
  {
    id: 'people',
    name: 'People',
    description: 'Characters for people and relationships',
    entries: [
      { char: '人', onyomi: 'じん', kunyomi: 'ひと', meaning: 'Person', radicals: ['人'] },
      { char: '女', onyomi: 'じょ', kunyomi: 'おんな', meaning: 'Woman', radicals: ['女'] },
      { char: '男', onyomi: 'だん', kunyomi: 'おとこ', meaning: 'Man', radicals: ['田', '力'] },
      { char: '子', onyomi: 'し', kunyomi: 'こ', meaning: 'Child', radicals: ['子'] },
      { char: '父', onyomi: 'ふ', kunyomi: 'ちち', meaning: 'Father', radicals: ['父'] },
      { char: '母', onyomi: 'ぼ', kunyomi: 'はは', meaning: 'Mother', radicals: ['母'] },
      { char: '友', onyomi: 'ゆう', kunyomi: 'とも', meaning: 'Friend', radicals: ['又'] },
    ],
  },
  {
    id: 'directions',
    name: 'Directions',
    description: 'Up, down, left, right and more',
    entries: [
      { char: '上', onyomi: 'じょう', kunyomi: 'うえ', meaning: 'Up', radicals: ['上'] },
      { char: '下', onyomi: 'か', kunyomi: 'した', meaning: 'Down', radicals: ['下'] },
      { char: '左', onyomi: 'さ', kunyomi: 'ひだり', meaning: 'Left', radicals: ['工', '又'] },
      { char: '右', onyomi: 'う', kunyomi: 'みぎ', meaning: 'Right', radicals: ['口', '又'] },
      { char: '中', onyomi: 'ちゅう', kunyomi: 'なか', meaning: 'Middle', radicals: ['中'] },
      { char: '外', onyomi: 'がい', kunyomi: 'そと', meaning: 'Outside', radicals: ['外'] },
      { char: '前', onyomi: 'ぜん', kunyomi: 'まえ', meaning: 'Front', radicals: ['前'] },
    ],
  },
  {
    id: 'compounds',
    name: 'Radicals',
    description: 'Assemble kanji from their components (Mode 3)',
    entries: [
      { char: '明', onyomi: 'めい', kunyomi: 'あかるい', meaning: 'Bright', radicals: ['日', '月'] },
      { char: '休', onyomi: 'きゅう', kunyomi: 'やすむ', meaning: 'Rest', radicals: ['人', '木'] },
      { char: '好', onyomi: 'こう', kunyomi: 'すき', meaning: 'Like', radicals: ['女', '子'] },
      { char: '岩', onyomi: 'がん', kunyomi: 'いわ', meaning: 'Rock', radicals: ['山', '石'] },
      { char: '森', onyomi: 'しん', kunyomi: 'もり', meaning: 'Forest', radicals: ['木', '木', '木'] },
      { char: '男', onyomi: 'だん', kunyomi: 'おとこ', meaning: 'Man', radicals: ['田', '力'] },
      { char: '字', onyomi: 'じ', kunyomi: 'もじ', meaning: 'Character', radicals: ['宀', '子'] },
    ],
  },
];

export const DEFAULT_SET_ID = 'elements';

export function getKanjiSet(id: string): KanjiSet {
  return KANJI_SETS.find(s => s.id === id) ?? KANJI_SETS[0];
}
