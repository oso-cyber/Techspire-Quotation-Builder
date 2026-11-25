import { money, type CatalogueItem, type Package } from './domain'
import fortinetWordmark from './assets/fortinet-wordmark.png?inline'
import paperCutLogo from './assets/reference-printers/papercut-mf.svg?inline'

const photos = import.meta.glob<string>('./assets/reference-printers/*.jpg', { eager: true, query: '?inline', import: 'default' })

const printerBasePrices: Record<string, number> = {
  c3301i: 2595173, c3321i: 3068609, c4000i: 4044320, c3351i: 4133759, c257i: 4252438,
  c4051i: 4753111, c251i: 5543597,
  c301i: 6422988, c361i: 8920700, c451i: 13609030, c651i: 15606050,
  c751i: 22339572,
  b4000i: 490000, b4221i: 952580, b423: 1006720, b5020i: 1309058, b4051i: 1855879,
  b225i: 1905234, b4751i: 2332775, b227: 3351500,
  b287: 3442446, b367: 4029651,
  b300i: 4317276, b361i: 4892924, b451i: 7696757,
  b551i: 7925845,
  b651i: 12062572, b751i: 16078150, b951i: 18647200,
}
const paperFeed = [
  ['PF-P20', 'Paper Cassette', 420321], ['PF-P22', 'Height Adjustment Unit', 225045],
  ['ND3350i', 'Melamine Cabinet C3350i', 143830],
] as const
const commonAccessories = [
  ['FS-P04', 'Off-line Stapler', 428730], ['EK-P10', 'NFC Interface Kit', 367980],
  ['UK-221', 'Embedded Wi-Fi', 221383], ['EK-P08', 'USB Interface Kit', 119725],
  ['EK-P09', 'USB Interface Kit', 397899], ['AU-102', 'Biometric Authentication Unit', 824827],
  ['WT-P03', 'Working Table', 173813], ['KP-P03', 'Keypad', 47766], ['KH-P02', 'Keyboard Holder', 127298],
  ['CU-202', 'A4 Air Filter', 351291], ['12-00722', 'Data Line Surge Protector', 48047],
] as const

type PrinterAccessory = readonly [sku: string, name: string, priceCents: number, choiceGroup?: string, description?: string]

function iOptions(ocrFont: number, antivirus: number, unicodeFont = 616405, barcodeFont = 616405): PrinterAccessory[] {
  return [
    ['LK-105V4EU', 'Searchable PDF OCR', 616429],
    ['LK-106EU', 'Native Barcode Font', barcodeFont],
    ['LK-107EU', 'Native Unicode Font', unicodeFont],
    ['LK-108EU', 'Native OCR Font', ocrFont],
    ['LK-110V2EU', 'Additional File Formats and Functions', 517740],
    ['LK-111EU', 'Native ThinPrint', 118903],
    ['LK-114', 'Serverless Follow Me Printing', 332733],
    ['LK-116', 'Bitdefender Antivirus', antivirus],
  ]
}

const compactMfpAccessories: Record<string, readonly PrinterAccessory[]> = {
  'Paper Feed & Cabinets': [paperFeed[2], paperFeed[0], paperFeed[1]],
  Accessories: [
    ...commonAccessories.filter(([sku]) => !['EK-P10', 'KP-P03', 'KH-P02'].includes(sku)),
    ['FK-517', 'Fax Kit', 176591], ['KP-102', 'Keypad', 108236],
    ['KH-P02', 'Keyboard Holder', 124633], ['MK-P08', 'Card Reader Mount Kit', 100403],
    ['EK-P11', 'Interface Cable', 54061], ['UK-P19', 'Double Feed Detection Kit', 437678],
  ],
  'i-Option Accessories': iOptions(308213, 308126),
  Consumables: [
    ['AAJW1D0', 'Black Toner', 54337], ['AAJW2D0', 'Yellow Toner', 80834],
    ['AAJW3D0', 'Magenta Toner', 80834], ['AAJW4D0', 'Cyan Toner', 80834],
    ['AAJV11H', 'Black Imaging Unit', 404146], ['AAJV16H', 'Yellow Imaging Unit', 404146],
    ['AAJV1CH', 'Magenta Imaging Unit', 404146], ['AAJV1HH', 'Cyan Imaging Unit', 404145],
  ],
}

const c251iAccessories = {
  'Original Cover or Document Feeder': [
    ['OC-511', 'Original Cover', 129327, 'cover-or-feeder'],
    ['DF-632', 'Reverse Document Feeder', 927959, 'cover-or-feeder'],
    ['DF-714', 'Dual Scan Document Feeder', 1837978, 'cover-or-feeder'],
  ],
  'Paper Feed & Cabinets': [
    ['ND250i', 'Melamine Cabinet', 157810], ['DK-516X', 'Copier Desk', 147951],
    ['PC-116', 'Universal Tray', 577359], ['PC-216', 'Dual Universal Trays', 824833],
    ['PC-416', 'Large Capacity Tray', 824833], ['PC417', 'Large Capacity Tray (1500+)', 866059],
    ['LC-302', '3000-Sheet Large Capacity Tray', 1237297],
  ],
  'Output Options': [
    ['JS-506', 'Job Separator', 206217], ['FS533', 'Inner Staple Finisher', 1031057],
    ['PK-519', '2 & 4 Hole Punch Kit', 474289],
    ['RU-513', 'Relay Unit', 207282, undefined, 'Required for FS-536, FS-537 and FS-539 finishers'],
    ['FS-539', '50 Sheet Staple Finisher', 1835664], ['FS-539SD', '50 Sheet Stapler & Booklet Finisher', 3072926],
    ['PK-524', '2 & 4 Hole Punch Kit', 462265],
  ],
  Accessories: [
    ['FK-514', 'Fax Kit', 958860], ['MK-715', 'Banner Tray', 375812],
    ['UK-221', 'Embedded Wi-Fi', 221383], ['EM-908', '1 TB SSD', 1024438],
    ['SC-509', 'Security Kit', 1340364], ['AU-102', 'Biometric Authentication Unit', 824827],
    ['WT-506', 'Work Table for AU-102', 89979], ['MK-735', 'Mount Kit for IC Card', 67278],
    ['EK-608', 'Keyboard Interface Kit', 114122], ['EK-609', 'Keyboard Interface Kit', 170349],
    ['12-00722', 'Data Line Surge Protector', 48047],
  ],
  'Fiery Controller': [
    ['IC-420', 'Fiery Image Controller', 5052668], ['VI-516', 'Interface Kit for IC-420', 371165],
    ['UK-115', 'Upgrade Kit for IC-420', 465050],
  ],
  'i-Option Accessories': iOptions(308213, 304382, 622645),
  Consumables: [
    ['AAV81D0', 'Black Toner', 97018], ['AAV82D0', 'Yellow Toner', 145656],
    ['AAV83D0', 'Magenta Toner', 145656], ['AAV84D0', 'Cyan Toner', 145656],
    ['SK-602', 'Staple Cartridge (3 × 5000)', 108410],
  ],
} satisfies Record<string, readonly PrinterAccessory[]>

const highCapacityPaperFeed: PrinterAccessory[] = [
  ...c251iAccessories['Paper Feed & Cabinets'].map((row): PrinterAccessory =>
    row[0] === 'DK-516X' ? [row[0], row[1], 150031] : row),
  ['LU207', 'Large Capacity Unit', 1855894],
]
const highCapacityOutput: PrinterAccessory[] = [
  ['OT-513', 'Output Tray', 64929],
  ...c251iAccessories['Output Options'].slice(3),
  ['FS-540', '100 Sheet Staple Finisher', 3402480],
  ['FS-540SD', '100 Sheet Stapler & Booklet Finisher', 4239981],
  ['PK-526', '2 & 4 Hole Punch Kit', 682989],
  ['JS-602', 'Finisher Job Separator', 412435],
  ['ZU609', 'Z-fold Unit', 3093188],
  ['PI507', 'Post Inserter', 983613],
]
const highCapacityAccessories: PrinterAccessory[] = [
  ...c251iAccessories.Accessories.filter(([sku]) => sku !== 'MK-735'),
  ['UK-501', 'Double Feed Detection Kit', 430142],
]
const highCapacityConsumables: PrinterAccessory[] = [
  ['ACV11D0', 'TN626K Black Toner', 72542], ['ACV12D0', 'TN626Y Yellow Toner', 89325],
  ['ACV13D0', 'TN626M Magenta Toner', 89325], ['ACV14D0', 'TN626C Cyan Toner', 89325],
  ['SK-602', 'Staple Cartridge (3 × 5000)', 108410], ['SK-704', 'Staple Cartridge for FS-540', 171283],
]
const highCapacityOptions = iOptions(308213, 304382).filter(([sku]) => sku !== 'LK-114')

const monoTrays: PrinterAccessory[] = [
  ['PF-P23', '250-Sheet Paper Tray', 211869], ['PF-P24', '520-Sheet Paper Tray', 344001],
]
const monoCompactAccessories = {
  'Paper Feed & Cabinets': monoTrays,
  Accessories: [['12-00722', 'Data Line Surge Protector', 48047]],
  Consumables: [['ACF00D0', 'TNP78 Black Toner', 216595], ['SK-602', 'Staple Cartridge (3 × 5000)', 108410]],
} satisfies Record<string, readonly PrinterAccessory[]>
const monoCompactMfpAccessories = {
  ...monoCompactAccessories,
  'Paper Feed & Cabinets': [['ND4050', 'Melamine Cabinet B4050', 132808], ...monoTrays],
} satisfies Record<string, readonly PrinterAccessory[]>

const b227Accessories = {
  'Original Cover or Document Feeder': [
    ['OC-514', 'Original Cover', 85146, 'cover-or-feeder'],
    ['DF-628', 'Document Feeder', 768402, 'cover-or-feeder'],
  ],
  'Paper Feed & Cabinets': [
    ['ND227', 'Melamine Cabinet', 165740], ['PC-113', '500-Sheet Paper Feed', 577359],
    ['PC-213', 'Dual 500-Sheet Paper Feed Cabinet', 824833], ['PC-413', '2500-Sheet Paper Feed', 824833],
  ],
  'Output Options': [
    ['JS-506', 'Job Separator', 206217], ['FS533', 'Inner Staple Finisher', 1031057],
    ['MK-602', 'Mount Kit for FS533', 45285], ['PK-519', '2 & 4 Hole Punch Kit', 474289],
    ['RU-514', 'Relay Unit', 226461], ['FS-534', '50 Sheet Staple Finisher', 1835670],
    ['FS-534SD', '50 Sheet Stapler & Booklet Finisher', 3072964], ['PK-520', '2 & 4 Hole Punch Kit', 474289],
  ],
  Accessories: [
    ['FK-513', 'Fax Kit', 745296], ['UK-215', 'Embedded Wi-Fi', 253662],
    ...c251iAccessories.Accessories.filter(([sku]) =>
      ['EK-608', 'EK-609', 'AU-102', 'WT-506', '12-00722'].includes(sku)),
  ],
  'i-Option Accessories': [
    ['UK-211', 'i-Option License Upgrade Kit', 187814], ['LK-102V3EU', 'PDF/A Option', 657689],
    ...iOptions(308213, 304382).filter(([sku]) => sku !== 'LK-116'),
  ],
  Consumables: [['A87M0D0', 'TN-323 Black Toner', 80037], ['SK-602', 'Staple Cartridge (3 × 5000)', 108410]],
} satisfies Record<string, readonly PrinterAccessory[]>

function accessoryPrices(rows: readonly PrinterAccessory[], prices: Record<string, number>): PrinterAccessory[] {
  return rows.map(([sku, name, price, ...details]) => [sku, name, prices[sku] ?? price, ...details])
}

const monoPaperFeed = c251iAccessories['Paper Feed & Cabinets'].filter(([sku]) => sku !== 'DK-516X')
const monoTn330: PrinterAccessory[] = [
  ['AC7A0D0', 'TN330 Black Toner', 69780], ['SK-602', 'Staple Cartridge (3 × 5000)', 108410],
]
const monoTn628: PrinterAccessory[] = [
  ['AC790D0', 'TN628 Black Toner', 70434], ['SK-602', 'Staple Cartridge (3 × 5000)', 108410],
]
const mono751Trays: PrinterAccessory[] = [
  ['LU303', 'Large Capacity Tray (A4)', 1237297], ['LU205', 'Large Capacity Tray (SRA3)', 1855894],
]

const modelAccessories: Record<string, Record<string, readonly PrinterAccessory[]>> = {
  b300i: {
    'Original Cover or Document Feeder': accessoryPrices(c251iAccessories['Original Cover or Document Feeder'],
      { 'OC-511': 126618, 'DF-632': 908496, 'DF-714': 1799420 }),
    'Paper Feed & Cabinets': accessoryPrices(monoPaperFeed,
      { ND250i: 151647, 'PC-116': 565258, 'PC-216': 807513, 'PC-416': 807513, PC417: 847900, 'LC-302': 1211330 }),
    'Output Options': accessoryPrices(c251iAccessories['Output Options'],
      { 'JS-506': 201880, FS533: 1009427, 'PK-519': 464330, 'RU-513': 202936, 'FS-539': 1797154, 'FS-539SD': 3008461, 'PK-524': 452570 }),
    Accessories: accessoryPrices(c251iAccessories.Accessories,
      { 'FK-514': 938729, 'MK-715': 307224, 'UK-221': 216722, 'EM-908': 1002964, 'SC-509': 1312256,
        'AU-102': 807519, 'WT-506': 88111, 'MK-735': 65810, 'EK-608': 111724, 'EK-609': 166766 }),
    'i-Option Accessories': accessoryPrices(iOptions(301749, 298014, 603470, 603470),
      { 'LK-105V4EU': 603494, 'LK-110V2EU': 506872, 'LK-111EU': 116420, 'LK-114': 325753 }),
    Consumables: monoTn330,
  },
  b361i: {
    'Original Cover or Document Feeder': c251iAccessories['Original Cover or Document Feeder'],
    'Paper Feed & Cabinets': accessoryPrices(monoPaperFeed, { 'LC-302': 1235425 }),
    'Output Options': c251iAccessories['Output Options'],
    Accessories: accessoryPrices(c251iAccessories.Accessories, { 'MK-715': 376124, 'MK-735': 67225 }),
    'i-Option Accessories': iOptions(308213, 304382),
    Consumables: monoTn330,
  },
  b651i: {
    'Paper Feed & Cabinets': [
      ...accessoryPrices(monoPaperFeed, { 'PC-116': 577360, 'LC-302': 1211330 }),
      ['LU205', 'Large Capacity Tray (SRA3)', 1816970],
    ],
    'Output Options (one must be installed)': accessoryPrices(highCapacityOutput, { PI507: 98365, 'JS-602': 403787 }),
    Accessories: accessoryPrices(c251iAccessories.Accessories, { 'MK-735': 67225 }),
    'i-Option Accessories': iOptions(308213, 304382),
    Consumables: monoTn628,
  },
  b751i: {
    'Output Options (one must be installed)': [
      ['OT-514', 'Output Tray', 61887], ['RU-519', 'Relay Unit', 202936],
      ...accessoryPrices(highCapacityOutput.filter(([sku]) => sku !== 'OT-513' && sku !== 'RU-513'),
        { 'FS-539SD': 3072923 }),
    ],
    'Paper Feed & Cabinets': mono751Trays,
    Accessories: [
      ...accessoryPrices(c251iAccessories.Accessories.filter(([sku]) => !['MK-715', 'EM-908'].includes(sku)), { 'MK-735': 67225 }),
      ['WT-519', 'Upright Working Table', 1613823],
    ],
    'i-Option Accessories': iOptions(308213, 304382),
    Consumables: [
      ['ACYP0D0', 'TN714 Black Toner', 93486],
      ...highCapacityConsumables.filter(([sku]) => sku === 'SK-602' || sku === 'SK-704'),
    ],
  },
  b951i: {
    'Output Options (one must be installed)': [
      ['OT-508', 'Output Tray', 67600], ['RU-515', 'Relay Unit', 213304],
      ['FS-536SD', '50 Sheet Stapler & Booklet Finisher', 3073966], ['PK-520', '2 & 4 Hole Punch Kit', 464256],
      ['FS-537', '100 Sheet Floor Staple Finisher', 4239981], ['FS-537SD', '100 Sheet Stapler & Booklet Finisher', 4074096],
      ['PK-523', 'Punch Kit for FS-537', 650000], ['ZU609', 'Z-fold Unit', 3093188], ['PI507', 'Post Inserter', 983613],
    ],
    'Paper Feed & Cabinets': mono751Trays,
    Accessories: [
      ['FK-516', 'Fax Kit', 958860], ['EK-610', 'Second USB Keyboard Interface Kit', 247563],
      ['EK-611', 'USB Keyboard Interface Kit', 341572], ['SC-508', 'Security Chip', 1340364],
      ['UK-215', 'Embedded Wi-Fi', 248323],
      ...accessoryPrices(c251iAccessories.Accessories.filter(([sku]) =>
        ['AU-102', 'WT-506', 'MK-735', '12-00722'].includes(sku)), { 'MK-735': 67225 }),
    ],
    'i-Option Accessories': [
      ['LK-102V3EU', 'PDF/A Option', 631011],
      ...accessoryPrices(iOptions(308213, 304382).filter(([sku]) => sku !== 'LK-116'),
        { 'LK-105V4EU': 616494, 'LK-110V2EU': 506872, 'LK-111EU': 118862 }),
    ],
    Consumables: [['A8H50D1', 'TN912 Black Toner', 79218], ['SK-602', 'Staple Cartridge (3 × 5000)', 108410]],
  },
  b551i: {
    'Paper Feed & Cabinets': highCapacityPaperFeed.filter(([sku]) => sku !== 'DK-516X'),
    'Output Options (one must be installed)': [
      highCapacityOutput[0],
      ['JS-508', 'Job Separator', 215870], ['FS533', 'Inner Staple Finisher', 1031057],
      ['MK-607', 'Fan Kit for FS533', 51231], ['PK-519', '2 & 4 Hole Punch Kit', 474289],
      ...highCapacityOutput.slice(1),
    ],
    Accessories: highCapacityAccessories.filter(([sku]) => !['MK-715', 'EM-908'].includes(sku)),
    'i-Option Accessories': iOptions(308213, 304382, 616405, 616321).filter(([sku]) => sku !== 'LK-114'),
    Consumables: [['AC790D0', 'TN628 Black Toner', 70434], ['SK-602', 'Staple Cartridge (3 × 5000)', 108410]],
  },
  b451i: {
    'Paper Feed & Cabinets': accessoryPrices(highCapacityPaperFeed.filter(([sku]) => sku !== 'DK-516X'),
      { 'PC-216': 824927, 'PC-416': 824927 }),
    'Output Options (one must be installed)': [
      highCapacityOutput[0],
      ['JS-508', 'Job Separator', 215870], ['FS533', 'Inner Staple Finisher', 1031057],
      ['MK-607', 'Fan Kit for FS533', 51231], ['PK-519', '2 & 4 Hole Punch Kit', 474289],
      ...accessoryPrices(highCapacityOutput.slice(1), { 'FS-540SD': 4240036 }),
    ],
    Accessories: accessoryPrices(highCapacityAccessories.filter(([sku]) => !['MK-715', 'EM-908'].includes(sku)),
      { 'EK-609': 170351 }),
    'i-Option Accessories': [
      ...iOptions(308213, 304382, 616402, 616402).filter(([sku]) => !['LK-111EU', 'LK-114', 'LK-116'].includes(sku)),
      ['NFC-Card', 'NFC Card Reader', 700000], ['LK-116', 'Bitdefender Antivirus', 304382],
    ],
    Consumables: [['AC790D0', 'TN628 Black Toner', 70434], ['SK-602', 'Staple Cartridge (3 × 5000)', 108410]],
  },
  b4000i: monoCompactAccessories,
  b4221i: monoCompactMfpAccessories,
  b423: {},
  b5020i: monoCompactMfpAccessories,
  b4051i: {
    'Paper Feed & Cabinets': compactMfpAccessories['Paper Feed & Cabinets'],
    Accessories: [
      ['FK-517', 'Fax Kit', 204665],
      ...commonAccessories.filter(([sku]) => ['FS-P04', 'UK-221', 'AU-102', 'WT-P03', 'EK-P08', 'EK-P09', '12-00722'].includes(sku)),
      ['MK-P08', 'Card Reader Mount Kit', 100403], ['EK-P11', 'Interface Cable', 54061],
      ['UK-P19', 'Double Feed Detection Kit', 437678],
    ],
    'i-Option Accessories': [['LK-102V3EU', 'PDF/A Option', 631011], ...iOptions(308213, 304382)],
    Consumables: [['TNP90', 'TNP90 Black Toner Cartridge', 122077]],
  },
  b225i: {
    'Original Cover or Document Feeder': [
      ['OC-512', 'Original Cover', 99325, 'cover-or-feeder'],
      ['DF633', 'Reverse Document Feeder', 851757, 'cover-or-feeder'],
    ],
    'Paper Feed & Cabinets': [
      ['PF-507', 'Paper Feed Unit', 221895], ['ND225i', 'Melamine Cabinet', 166581],
      ['DK-706', 'Large Copy Desk', 333365], ['DK-707', 'Medium Copy Desk', 373720],
      ['DK-708', 'Small Copy Desk', 264844],
    ],
    Accessories: [
      ['AD-509', 'Duplex Unit', 168139], ['FK-510', 'Fax Kit', 672443],
      ['MK-750', 'Optional Panel', 51576], ['12-00722', 'Data Line Surge Protector', 48047],
    ],
    Consumables: [['A3VW0D0', 'Black Toner Cartridge', 76365]],
  },
  b4751i: {
    'Paper Feed & Cabinets': compactMfpAccessories['Paper Feed & Cabinets'],
    Accessories: [
      ...compactMfpAccessories.Accessories.filter(([sku]) =>
        ['FS-P04', 'FK-517', 'UK-221', 'WT-P03', 'MK-P08', 'EK-P08', 'EK-P09', 'EK-P11', 'UK-P19', '12-00722'].includes(sku)),
      ['AU-102', 'Biometric Authentication Unit', 814531],
    ],
    'i-Option Accessories': [['LK-102V3EU', 'PDF/A Option', 631011], ...iOptions(308213, 304382).slice(0, 3)],
  },
  b227: b227Accessories,
  b287: {
    ...b227Accessories,
    'Paper Feed & Cabinets': b227Accessories['Paper Feed & Cabinets'].map((row): PrinterAccessory =>
      row[0] === 'PC-413' ? [row[0], row[1], 824827] : row),
    Accessories: b227Accessories.Accessories.map((row): PrinterAccessory =>
      row[0] === '12-00722' ? [row[0], row[1], 47944] : row),
  },
  b367: b227Accessories,
  c3351i: compactMfpAccessories,
  c4051i: {
    ...compactMfpAccessories,
    Accessories: compactMfpAccessories.Accessories.map((row) => row[0] === 'FK-517'
      ? [row[0], row[1], row[2], undefined, 'Not required for the C4051i']
      : row),
    'i-Option Accessories': iOptions(308213, 304382),
  },
  c251i: c251iAccessories,
  c301i: {
    'Original Cover or Document Feeder': c251iAccessories['Original Cover or Document Feeder'],
    'Paper Feed & Cabinets': c251iAccessories['Paper Feed & Cabinets'].map((row): PrinterAccessory =>
      row[0] === 'ND250i' ? [row[0], row[1], 151647] : row),
    'Output Options': c251iAccessories['Output Options'],
    Accessories: c251iAccessories.Accessories.map((row): PrinterAccessory =>
      row[0] === 'MK-735' ? [row[0], row[1], 67225] : row),
    'Fiery Controller': c251iAccessories['Fiery Controller'],
    'i-Option Accessories': iOptions(308213, 304382, 616405, 606005).slice(0, 6),
  },
  c361i: {
    ...c251iAccessories,
    Accessories: c251iAccessories.Accessories.map((row): PrinterAccessory =>
      row[0] === 'MK-735' ? [row[0], row[1], 67225] : row),
    'i-Option Accessories': iOptions(308213, 304382),
  },
  c451i: {
    'Paper Feed & Cabinets': highCapacityPaperFeed,
    'Output Options (one must be installed)': [
      highCapacityOutput[0],
      ['JS-508', 'Job Separator', 215870], ['FS533', 'Inner Staple Finisher', 1031057],
      ['MK-607', 'Fan Kit for FS533', 51231], ['PK-519', '2 & 4 Hole Punch Kit', 474289],
      ...highCapacityOutput.slice(1),
    ],
    Accessories: highCapacityAccessories,
    'Fiery Controller': c251iAccessories['Fiery Controller'],
    'i-Option Accessories': [
      ...highCapacityOptions.filter(([sku]) => sku !== 'LK-111EU' && sku !== 'LK-116'),
      ['NFC-Card', 'NFC Card Reader', 700000], ['LK-116', 'Bitdefender Antivirus', 304382],
    ],
    Consumables: highCapacityConsumables,
  },
  c651i: {
    'Paper Feed & Cabinets': highCapacityPaperFeed,
    'Output Options (one must be installed)': highCapacityOutput,
    Accessories: highCapacityAccessories,
    'Fiery Controller': c251iAccessories['Fiery Controller'],
    'i-Option Accessories': highCapacityOptions,
    Consumables: highCapacityConsumables,
  },
  c751i: {
    'Output Options (one must be installed)': [
      ['OT-514', 'Output Tray', 61887], ['RU-519', 'Relay Unit', 202936],
      ...highCapacityOutput.filter(([sku]) => sku !== 'OT-513' && sku !== 'RU-513'),
    ],
    'Paper Feed & Cabinets': [
      ['LU303', 'Large Capacity Tray (A4)', 1237297], ['LU205', 'Large Capacity Tray (SRA3)', 1855894],
    ],
    Accessories: [
      ...c251iAccessories.Accessories.filter(([sku]) => !['MK-715', 'EM-908', 'MK-735'].includes(sku)),
      ['WT-519', 'Upright Working Table', 1613823], ['MK-735', 'Mount Kit for IC Card', 67225],
    ],
    'Fiery Controller': c251iAccessories['Fiery Controller'].filter(([sku]) => sku !== 'UK-115'),
    'i-Option Accessories': iOptions(308213, 304382),
    Consumables: [
      ['ACP81D2', 'TN715K Black Toner', 113202], ['ACP84D2', 'TN715C Cyan Toner', 177083],
      ['ACP83D2', 'TN715M Magenta Toner', 177083], ['ACP82D2', 'TN715Y Yellow Toner', 177083],
      ...highCapacityConsumables.filter(([sku]) => sku === 'SK-602' || sku === 'SK-704'),
    ],
  },
  c257i: {
    'Original Cover or Document Feeder': [
      ['DF633', 'Reverse Document Feeder', 851757, 'cover-or-feeder'],
      ['OC-513', 'Original Cover', 85146, 'cover-or-feeder'],
    ],
    'Paper Feed & Cabinets': [
      ['ND257i', 'Melamine Cabinet C257i', 193951], ['PC-118', 'Universal Tray', 577359],
      ['PC-218', 'Dual Universal Trays', 824833], ['PC-418', 'Large Capacity Tray', 824833],
    ],
    'Output Options': [
      ['JS-506', 'Job Separator', 206217], ['FS533', 'Inner Staple Finisher', 1031057],
      ['PK-519', '2 & 4 Hole Punch Kit', 474289], ['MK-602', 'Mount Kit for FS533', 45285],
      ['MK-603', 'Job Separator Attachment Kit', 56084], ['RU-514', 'Relay Unit', 226461],
      ['FS-539', '50 Sheet Staple Finisher', 1835664], ['FS-539SD', '50 Sheet Stapler & Booklet Finisher', 3072926],
      ['PK-524', '2 & 4 Hole Punch Kit', 462265],
    ],
    Accessories: [
      ['FK-513', 'Fax Kit', 745296], ['EK-608', 'Keyboard Interface Kit', 114122],
      ['EK-609', 'Keyboard Interface Kit', 170349], ['AU-102', 'Biometric Authentication Unit', 824827],
      ['WT-515', 'Working Table', 103092], ['UK-221', 'Embedded Wi-Fi', 221330],
      ['12-00722', 'Data Line Surge Protector', 48047],
    ],
    'i-Option Accessories': iOptions(308212, 304382),
    Consumables: [
      ['ACVH1D0', 'TN227K Black Toner', 94769], ['ACVH2D0', 'TN227Y Yellow Toner', 179448],
      ['ACVH3D0', 'TN227M Magenta Toner', 179448], ['ACVH4D0', 'TN227C Cyan Toner', 179448],
      ['SK-602', 'Staple Cartridge (3 × 5000)', 108410],
    ],
  },
}

export function productAccessories(product: CatalogueItem, catalogue: CatalogueItem[]): CatalogueItem[] {
  if (product.accessories) return product.accessories
  const defaults = referenceProductAccessories(product.id)
  if (defaults.length) return defaults
  return (product.featureItemIds ?? []).flatMap((id) => catalogue.find((entry) => entry.id === id) ?? [])
}

export function referenceProductAccessories(productId: string): CatalogueItem[] {
  if (productId === 'reference-mf-hive') {
    const licences = [
      ['embedded', 'PaperCut Embedded Licence (1 Device)', 'Device License', 531145],
      ['support-1', 'PaperCut Support (1 Device, 1 Year)', 'Support License', 106230],
      ['support-3', 'PaperCut Support (1 Device, 3 Years)', 'Support License', 239063],
      ['support-5', 'PaperCut Support (1 Device, 5 Years)', 'Support License', 398406],
    ] as const
    return licences.map(([code, name, productGroup, priceCents]) => ({
      id: `${productId}-${code}`, sku: '', name, productGroup, priceCents, costCents: priceCents,
      description: '', category: 'Office Automation', unit: 'each', vatApplicable: true, active: true,
    }))
  }
  const model = productId.replace(/^reference-printer-/, '')
  if (!productId.startsWith('reference-printer-') || !printerBasePrices[model]) return []
  const mfp = model === 'c3321i'
  const groups: Record<string, readonly PrinterAccessory[]> = modelAccessories[model] ?? {
    'Paper Feed & Cabinets': paperFeed,
    Accessories: [
      ...commonAccessories,
      ['MK-P08', 'Card Reader Mount Kit', mfp ? 101547 : 100403] as const,
      ...(mfp ? [
        ['FK-517', 'Fax Kit', 176591], ['EK-P11', 'Interface Cable', 54061],
        ['UK-P19', 'Double Feed Detection Kit', 437678],
      ] as const : []),
    ],
    Consumables: ['Black', 'Yellow', 'Magenta', 'Cyan'].slice(0, model === 'c4000i' ? 1 : 4).map((colour, index) =>
      [`AAJW${index + 1}D${mfp ? 4 : 2}`, `${colour} Toner`, mfp ? (index ? 111548 : 116225) : (index ? 220106 : 107550)] as const),
  }
  return Object.entries(groups).flatMap(([productGroup, products]) => products.map(([sku, name, priceCents, choiceGroup, description = '']) => ({
    id: `${productId}-${sku.toLowerCase()}`, sku, name, priceCents, costCents: priceCents, unit: 'each',
    productGroup, ...(choiceGroup ? { choiceGroup } : {}), description, category: 'Office Automation', vatApplicable: true, active: true,
  })))
}

export function withReferencePhotos(entry: Package): Package {
  if (!entry.imageDataUrl && (entry.id === 'reference-firewall' || entry.name.trim().toLowerCase() === 'firewall security')) {
    return { ...entry, imageDataUrl: fortinetWordmark }
  }
  if (entry.id === 'reference-papercut') return {
    ...entry,
    imageDataUrl: entry.imageDataUrl || paperCutLogo,
    items: entry.items.map((feature) => {
      const { product } = feature
      if (product?.id !== 'reference-mf-hive') return feature
      const pricing = product.pricingPending ? { pricingPending: false, active: true } : {}
      return { ...feature, product: { ...product, ...pricing, imageDataUrl: product.imageDataUrl || paperCutLogo } }
    }),
  }
  if (entry.id !== 'reference-ineo') return entry
  return {
    ...entry,
    imageDataUrl: entry.imageDataUrl || photos['./assets/reference-printers/c3301i.jpg'],
    items: entry.items.map((feature) => {
      const { product } = feature
      if (!product?.id.startsWith('reference-printer-')) return feature
      const model = product.id.slice('reference-printer-'.length)
      const priceCents = printerBasePrices[model]
      const pricing = priceCents && product.pricingPending ? { priceCents, costCents: priceCents, pricingPending: false, active: true } : {}
      return { ...feature, product: { ...product, ...pricing, imageDataUrl: product.imageDataUrl || photos[`./assets/reference-printers/${model}.jpg`] } }
    }),
  }
}

const printers = [
  ['C3301i', 'I+3301i', 'Digital colour printer'],
  ['C3321i', 'I+3321i', 'Digital colour MFP'],
  ['C4000i', 'I+4000i', 'Digital colour MFP'],
  ['C3351i', 'I+3351i', 'Digital colour MFP'],
  ['C257i', 'I+257i', 'Digital colour MFP'],
  ['C4051i', 'I+4051i', 'Digital colour MFP'],
  ['C251i', 'I+251i', 'Digital colour MFP'],
  ['C301i', 'I+301i', 'Digital colour MFP'],
  ['C361i', 'I+361i', 'Digital colour MFP'],
  ['C451i', 'I+451i', 'Digital colour MFP'],
  ['C551i', 'I+551i', 'Digital colour MFP'],
  ['C651i', 'I+651i', 'Digital colour MFP'],
  ['C751i', 'I+751i', 'Digital colour MFP'],
]

const lteGroups = [
  { id: 'vodacom', name: 'Vodacom Fixed LTE (SIM Only)', plans: [
    ['uncapped', 'Uncapped LTE PRO - FUP 6', 1099], ['50gb', '50GB Capped', 350],
    ['100gb', '100GB Capped', 455], ['200gb', '200GB Capped', 600],
  ] },
  { id: 'mtn', name: 'MTN Fixed LTE (SIM Only)', plans: [
    ['650gb', 'Uncapped FUP650GB', 1099], ['uncapped-pro', 'Uncapped LTE Pro', 1099],
    ['40gb', '40GB Capped', 250], ['90gb', '90GB Capped', 445],
    ['200gb', '200GB Capped', 699], ['400gb', '400GB Capped', 999],
  ] },
  { id: 'telkom', name: 'Telkom LTE (SIM Only)', plans: [
    ['uncapped', '20MB Uncapped - FUP 600', 1099], ['22gb', '22GB Capped', 250],
    ['40gb', '40GB Capped', 310], ['80gb', '80GB Capped', 340], ['120gb', '120GB Capped', 409],
    ['180gb', '180GB Capped', 525], ['2tb', '2TB Capped', 1099],
  ] },
] as const

function lteProduct(id: string, name: string, productGroup: string, cost: number, onceOff: number, monthly: number) {
  return { itemId: id, quantity: 1, product: {
    id, name, productGroup, sku: '', description: monthly ? productGroup : '', category: 'Connectivity', unit: 'each',
    costCents: cost * 100, priceCents: onceOff * 100, monthlyCents: monthly * 100, vatApplicable: true, active: true,
  } }
}

export const referenceLtePackage: Package = {
  id: 'reference-lte', name: 'LTE', category: 'Connectivity', description: '',
  items: [
    ...lteGroups.flatMap(({ id, name, plans }) => plans.map(([plan, label, rate]) =>
      lteProduct(`reference-lte-${id}-${plan}`, label, name, 0, 0, rate))),
    lteProduct('reference-lte-single-router', 'Single SIM LTE Router', 'LTE Routers', 2500, 650, 0),
    lteProduct('reference-lte-dual-router', 'Dual SIM LTE Router', 'LTE Routers', 2800, 650, 0),
  ],
}

export const referenceIctSlaPackage: Package = {
  id: 'reference-ict-sla', name: 'ICT SLA', category: 'Managed ICT Support', description: 'OneSource ICT support services.',
  items: ([
    ['desktop', 'Desktop Support', 'user', 375],
    ['network', 'Network Support', 'node', 50],
    ['firewall', 'Firewall Support', 'user', 100],
    ['server', 'Server Support', 'physical server', 650],
  ] as const).map(([key, name, unit, monthly]) => {
    const id = `reference-ict-sla-${key}`
    return { itemId: id, quantity: 1, product: {
      id, name, unit, description: `Per ${unit}`, sku: '', category: 'Managed ICT Support', productGroup: 'ICT SLA',
      priceCents: 0, costCents: 0, monthlyCents: monthly * 100, vatApplicable: true, active: true,
    } }
  }),
}

const firewallModels = [
  ['40F', '1-15', [1_888_700, 3_210_790, 4_415_070], 130_000, 260_000],
  ['60F', '10-25', [2_836_000, 4_506_700, 6_199_050], 195_000, 390_000],
  ['70F', '15-50', [3_311_770, 5_628_700, 7_741_800], 260_000, 520_000],
  ['80F', '50-100', [5_836_270, 9_922_220, 13_647_260], 260_000, 1_040_000],
  ['100F', '101-200', [10_299_960, 17_510_680, 24_083_730], 520_000, 2_080_000],
  ['200F', '200-300', [21_149_700, 38_566_880, 55_984_060], 520_000, 4_160_000],
] as const

export const referenceFirewallPackage: Package = {
  id: 'reference-firewall', name: 'Firewall Security', category: 'Networking', description: 'Fortinet FortiGate hardware, support and installation.',
  items: firewallModels.flatMap(([model, users, hardwarePrices, installation, configuration]) => {
    const productGroup = `FortiGate ${model} (${users} Users)`
    const prefix = `reference-fortigate-${model.toLowerCase()}`
    const common = { productGroup, category: 'Networking', unit: 'each', monthlyCents: 0, vatApplicable: true, active: true }
    const plans = hardwarePrices.map((hardware, index) => {
      const term = [1, 3, 5][index]
      const id = `${prefix}-${term}y`
      return { itemId: id, quantity: 1, product: {
        ...common, id, name: `${term} Year - Basic Installation`,
        sku: `FG-${model}-${model === '100F' || model === '200F' ? 'BD' : 'BDL'}`,
        description: `FortiGate ${model} hardware with FortiCare Premium. Base ${money(hardware)} plus installation ${money(installation)}.`,
        costCents: hardware, priceCents: hardware + installation, choiceGroup: prefix,
      } }
    })
    const id = `${prefix}-advanced`
    return [...plans, { itemId: id, quantity: 1, product: {
      ...common, id, name: 'Advanced Configuration', sku: 'Adv-Setup', description: `FortiGate ${model} advanced configuration.`,
      costCents: configuration, priceCents: configuration,
    } }]
  }),
}

const structuredNetworkItems = {
  Cabling: [
    ['C-50', 'Cat6 Data Point: Up to 50m', 104000],
    ['C-70', 'Cat6 Data Point: Up to 70m', 124800],
  ],
  'Cabling Accessories': [
    ['CA-24P', '24 Port Patch Panel', 218400],
    ['CA-BP', 'Brush Panel', 12480],
    ['CA-CONS', 'Consumables', 26000],
  ],
  Leads: [
    ['L-1M', '1m FlyLead', 4992],
    ['L-3M', '3m FlyLead', 7904],
    ['L-5M', '5m FlyLead', 13624],
    ['L-8M', '8m FlyLead', 21736],
    ['L-10M', '10m FlyLead', 34008],
  ],
  'Cabinets & Accessories': [
    ['CSW-6', '6U Swing Frame Wall Box', 204932],
    ['CSW-9', '9U Swing Frame Wall Box', 216788],
    ['CSW-12', '12U Swing Frame Wall Box', 239772],
    ['CSW-15', '15U Swing Frame Wall Box', 271700],
    ['CFS-27', '27U 1m Deep Cabinet', 743028],
    ['CFS-42', '42U 1m Deep Cabinet', 948948],
    ['CSW-6W', '6-Way Aluminium Moulded Unit', 33748],
    ['CSW-10W', '10-Way Aluminium Moulded Unit', 54340],
  ],
  'Wireless Access Points': [
    ['RG-RAP226', 'Reyee Dual Band WiFi 6 (RG-RAP226 series)', 192500, 'The full model suffix is cropped in the reference.'],
    ['RG-RAP220', 'Reyee Dual Band WiFi 5 (RG-RAP220 series)', 129500, 'The full model suffix is cropped in the reference.'],
    ['RG-RAP626', 'Reyee Dual Band WiFi 6 (RG-RAP626 series)', 251400, 'The full model suffix is cropped in the reference.'],
  ],
  Switching: [
    ['S-5P', '5 Port Gigabit with 4 PoE', 82940],
    ['S-8P', '9 Port Gigabit with 8 PoE', 148148],
    ['S-16P', '18 Port Gigabit with 16 PoE', 273988],
    ['S-24P', '26 Port Gigabit with 24 PoE', 376948],
  ],
  'Fibre Cable': [
    ['F-2CMM', '2 Core Fibre Uplink Cable', 2000],
    ['F-4CMM', '4 Core OM3 Multimode Fibre Cable', 2267],
    ['F-8CMM', '8 Core OM3 Multimode Fibre Cable', 2787],
  ],
  'Fibre Accessories': [
    ['FA-P', 'OM3 Multimode Pigtail', 3432],
    ['FA-M', 'OM3 Multimode Midcoupler', 2912],
    ['F-12P', '12 Port Fibre Panel', 66040],
    ['F-SC', 'Splice Cassette', 3276],
    ['F-SP', 'Splicing', 12480],
  ],
  Labour: [
    ['L10', 'Data Point Installation (L10)', 239200],
    ['L20', 'Data Point Installation (L20)', 374400],
    ['L50', 'Data Point Installation (L50)', 780000],
    ['HIC', 'Hardware Installation & Configuration', 3000000],
  ],
} as const

export const referenceStructuredNetworksPackage: Package = {
  id: 'reference-structured-networks', name: 'Structured Networks', category: 'Networking',
  description: 'Net-100',
  items: Object.entries(structuredNetworkItems).flatMap(([productGroup, products]) =>
    products.map(([sku, name, basePrice, description = '']) => {
      const id = `reference-net-100-${sku.toLowerCase()}`
      return { itemId: id, quantity: 1, product: {
        id, name, description, sku, productGroup, category: 'Networking', unit: 'each',
        costCents: basePrice, priceCents: basePrice, monthlyCents: 0, vatApplicable: true, active: true,
      } }
    }),
  ),
}

export const referenceHostedPackage: Package = {
  id: 'reference-hosted', name: 'Hosted Solution', category: 'Telephony',
  description: 'Reference call rates: local R0.35 per minute and cellular R0.75 per minute.',
  items: ([
    ['HPE', 'Hosted Extension', 'Hosted PBX', 'extension', 5, 0, 5500],
    ['HCR', 'SIP Trunk Recording', 'Hosted PBX', 'trunk', 1, 0, 45000],
    ['SIPT', 'VoIP Line Rental', 'SIP Trunk', 'channel', 1, 0, 5000],
    ['SPE', 'Setup Per Extension', 'Setup & Configuration', 'extension', 1, 25000, 0],
    ['', 'Microsoft Teams License', 'Microsoft Teams License', 'licence', 1, 0, 11000],
  ] as const).map(([sku, name, productGroup, unit, quantity, onceOff, monthly]) => {
    const id = `reference-hosted-${sku.toLowerCase() || 'teams'}`
    return { itemId: id, quantity, product: {
      id, name, sku, productGroup, category: 'Telephony', unit,
      description: sku === 'HPE' ? 'Per extension. Minimum 5 extensions.' : `Per ${unit}.`,
      minimumQuantity: sku === 'HPE' ? 5 : undefined,
      priceCents: onceOff, costCents: 0, monthlyCents: monthly, active: true, vatApplicable: true,
    } }
  }),
}

const onPremProducts = {
  PBX: [
    ['p520', 'YR-P520', 'Yeastar P520 IP PBX', 569900],
    ['p550', 'YR-P550', 'Yeastar P550 IP PBX', 1080456],
    ['p560', 'YR-P560', 'Yeastar P560 IP PBX', 1682408],
    ['p570', 'YR-P570', 'Yeastar P570 IP PBX', 3225872],
  ],
  'Linkus Licence': [
    ['lic-p520', 'LIC-P520', 'Yeastar P520 IP PBX Licence', 300872],
    ['lic-p550', 'LIC-P550', 'Yeastar P550 IP PBX Licence', 572000],
    ['lic-p560', 'LIC-P560', 'Yeastar P560 IP PBX Licence', 705120],
    ['lic-p570', 'LIC-P570', 'Yeastar P570 IP PBX Licence', 1133600],
  ],
  'P-Series Accessories': [
    ['expansion', 'YR-PSE E10', 'P Series Expansion Card', 1343264, 'Part-number suffix is cropped.'],
    ['sd-recording', 'YR-PSE E10', 'SD - Recording', 78000, 'Part-number suffix is cropped.'],
    ['hdd-recording', 'YR-PSE U10', 'HDD - Recording', 260000, 'Part-number suffix is cropped.'],
  ],
  'Desktop IP Phones': [
    ['t31g', 'T31G', 'Yealink T31G IP Phone', 114400],
    ['t34w', 'T34W', 'Yealink T34W IP Phone', 135000],
    ['t43u', 'T43U', 'Yealink T43U IP Phone', 192400],
    ['t46u', 'T46U', 'Yealink T46U IP Phone', 291200],
    ['t48u', 'T48U', 'Yealink T48U IP Phone', 395200],
    ['ex43', 'EX43', 'Expansion Module', 161200],
    ['5v', '', 'Power Supply 5V', 18900],
    ['tg200l', 'YR-TG200L', 'Yeastar TG200L 2-Port LTE Gateway', 480000],
  ],
  'Conference Phones': [
    ['cp925', 'CP925', 'Yealink CP925 HD Conference Phone', 634400],
    ['cp935w', 'CP935W', 'Yealink CP935W Conference Phone', 946400],
    ['cp965', 'CP965', 'Yealink CP965 Android 9.0 Conference Phone', 946400],
  ],
  'Cordless Phone Base Station': [
    ['w70b', 'W70B', 'W70B DECT Base Station', 114400],
    ['w73p', 'W73P', 'W70B DECT Base + W73H Handset', 205920],
  ],
  'Cordless Phone Handset': [
    ['w56h', 'W56H', 'Yealink W56H Handset', 143000],
    ['w73h', 'W73H', 'Yealink W73H Handset', 128700],
    ['ax83h', 'AX83H', 'Yealink AX83H Portable IP Phone', 240000],
  ],
  Networking: [
    ['8p', '8P', '8 Port PoE', 148148],
    ['16p', '16P', '16 Port PoE', 273988],
    ['24p', '24P', '24 Port PoE', 376948],
    ['cat6', 'Cat6', 'Cat6 Network Point', 124900],
    ['6u', '6U', '6U Network Cabinet', 205000],
    ['9u', '9U', '9U Network Cabinet', 216800],
    ['patch', '24Patch', '24 Port Patch Panel', 218400],
    ['power', '', '6 Way Power Plug', 33800],
    ['brush', 'Brush', 'Brush Panel', 12500],
  ],
  Intercom: [['intercom', '', 'Grandstream 7-inch Intercom', 265000]],
  Installation: [['inc', 'INC', 'Installation & Configuration', 65000]],
  'SIP Trunk': [['sipt', 'SIPT', 'VoIP Line Rental', 0, 'Per channel.', 5000]],
} as const

export const referenceOnPremPackage: Package = {
  id: 'reference-on-prem', name: 'On-Prem Solution & Hardware', category: 'Telephony', description: '',
  items: Object.entries(onPremProducts).flatMap(([productGroup, products]) =>
    products.map(([key, sku, name, basePrice, description = '', monthly = 0]) => {
      const id = `reference-on-prem-${key}`
      return { itemId: id, quantity: 1, product: {
        id, sku, name, description, productGroup, category: 'Telephony', unit: monthly ? 'channel' : 'each',
        costCents: basePrice, priceCents: basePrice, monthlyCents: monthly, active: true, vatApplicable: true,
      } }
    }),
  ),
}

function monoPackage(models: string[][]): Package {
  return {
    id: 'reference-ineo', name: 'Ineo Digital', category: 'Office Automation', description: '',
    items: models.map(([model, sku, description, name = `Konica Minolta ${model}`]) => {
      const id = `reference-printer-${model.toLowerCase()}`
      return { itemId: id, quantity: 1, product: {
        id, name, sku, description, category: 'Office Automation',
        productGroup: 'Mono', unit: 'each', priceCents: 0, pricingPending: true, vatApplicable: true, active: false,
      } }
    }),
  }
}

export const referenceIneoMonoPackage = monoPackage([
    ['B4000i', 'I4000I', 'Monochrome printer'],
    ['B4221i', 'I4020I', 'A4 monochrome MFP, 40 ppm'],
    ['B423', 'B423', 'Monochrome MFP, 42 ppm, A5–A3 output, 250 GB HDD'],
    ['B5020i', 'I5020I', 'A4 monochrome MFP, 50 ppm'],
    ['B4051i', 'I4051i', 'Monochrome MFP'],
])

export const referenceIneoMonoAdditionalPackage = monoPackage([
  ['B225i', 'I225i', 'Monochrome MFP, 22 ppm'],
  ['B4751i', 'I4751i', 'Monochrome MFP'],
  ['B227', 'I227', 'Monochrome MFP, 22 ppm'],
])

export const referenceIneoMonoB287B367Package = monoPackage([
  ['B287', 'I287', 'Monochrome MFP, 800,000-page engine life'],
  ['B367', 'I367', 'Monochrome MFP, 1,200,000-page engine life'],
])

export const referenceIneoMono300SeriesPackage = monoPackage([
  ['B300i', 'I300i', 'Monochrome MFP, 30 ppm', 'Ineo 300i'],
  ['B361i', 'I361i', 'Monochrome MFP, 36 ppm'],
  ['B451i', 'I451i', 'Monochrome MFP, 45 ppm'],
])

export const referenceIneoMonoB551iPackage = monoPackage([
  ['B551i', 'I551i', 'Monochrome MFP, 55 ppm, 3,000,000-page engine life'],
])

export const referenceIneoMonoHighVolumePackage = monoPackage([
  ['B651i', 'I651i', 'Monochrome MFP, 65 ppm'],
  ['B751i', 'I751i', 'Monochrome MFP, 75 ppm'],
  ['B951i', 'I951i', 'Monochrome MFP, 95 ppm'],
])

export const referencePackages: Package[] = [
  referenceLtePackage,
  referenceIctSlaPackage,
  referenceFirewallPackage,
  referenceStructuredNetworksPackage,
  {
    id: 'reference-ineo', name: 'Ineo Digital', category: 'Office Automation', description: '',
    items: printers.map(([model, sku, description]) => {
      const id = `reference-printer-${model.toLowerCase()}`
      return { itemId: id, quantity: 1, product: {
        id, name: `Konica Minolta ${model}`, sku, description, category: 'Office Automation',
        productGroup: 'Colour', unit: 'each', priceCents: 0, pricingPending: true, vatApplicable: true, active: false,
      } }
    }),
  },
  {
    id: 'reference-papercut', name: 'PaperCut', category: 'Office Automation', description: '',
    items: [{ itemId: 'reference-mf-hive', quantity: 1, product: {
      id: 'reference-mf-hive', name: 'PaperCut MF/Hive', description: '', sku: '', category: 'Office Automation',
      unit: 'each', priceCents: 0, pricingPending: true, vatApplicable: true, active: false,
    } }],
  },
  referenceHostedPackage,
  referenceOnPremPackage,
]
