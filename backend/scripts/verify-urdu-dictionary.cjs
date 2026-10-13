async function test() {
  const m = await import('../../frontend/src/utils/urduDictionary.js');
  const individualTests = [
    ['Sprinter', 'سپرنٹر'],
    ['Charcoal', 'چارکول'],
    ['Men', 'مین'],
    ['Women', 'وومن'],
    ['Emerald Green', 'ایمرلڈ گرین'],
    ['Wide Leg', 'وائیڈ لیگ'],
    ['Espresso Strike', 'ایسپریسو اسٹرائیک'],
    ['Navy Collar', 'نیوی کالر'],
    ['Navy', 'نیوی'],
    ['Rust', 'رسٹ'],
    ['Sky', 'اسکائی'],
    ['Purple', 'پرپل'],
    ['Steel Blue', 'اسٹیل بلیو'],
    ['Seagreen', 'سی گرین'],
    ['Wide', 'وائیڈ'],
    ['Leg', 'لیگ'],
    ['Espresso', 'ایسپریسو'],
    ['Collar', 'کالر'],
    ['Steel', 'اسٹیل'],
    ['Emerald', 'ایمرلڈ']
  ];

  console.log('--- INDIVIDUAL TESTS ---');
  let allPass = true;
  for (const [en, expected] of individualTests) {
    const res = m.toUrduName(en);
    const pass = res === expected;
    if (!pass) allPass = false;
    console.log((pass ? '✅' : '❌'), en, '=>', res, (pass ? '' : `(Expected: ${expected})`));
  }

  const productTests = [
    ['Sprinter Charcoal - Men', 'سپرنٹر چارکول - مین'],
    ['Sprinter Charcoal - Women', 'سپرنٹر چارکول - وومن'],
    ['Sprinter Emerald Green - Wide Leg Men', 'سپرنٹر ایمرلڈ گرین - وائیڈ لیگ مین'],
    ['Sprinter Emerald Green - Women', 'سپرنٹر ایمرلڈ گرین - وومن'],
    ['Sprinter Espresso Strike - Men', 'سپرنٹر ایسپریسو اسٹرائیک - مین'],
    ['Sprinter Espresso Strike Wide Leg - Women', 'سپرنٹر ایسپریسو اسٹرائیک وائیڈ لیگ - وومن'],
    ['Sprinter Navy Collar - Men', 'سپرنٹر نیوی کالر - مین'],
    ['Sprinter Navy - Women', 'سپرنٹر نیوی - وومن'],
    ['Sprinter Rust - Men', 'سپرنٹر رسٹ - مین'],
    ['Sprinter Rust - Women', 'سپرنٹر رسٹ - وومن'],
    ['Sprinter Sky - Men', 'سپرنٹر اسکائی - مین'],
    ['Sprinter Sky - Women', 'سپرنٹر اسکائی - وومن'],
    ['Sprinter Purple - Women', 'سپرنٹر پرپل - وومن'],
    ['Sprinter Steel Blue - Men', 'سپرنٹر اسٹیل بلیو - مین'],
    ['Sprinter Seagreen - Men', 'سپرنٹر سی گرین - مین'],
    ['Sprinter Seagreen - Women', 'سپرنٹر سی گرین - وومن']
  ];

  console.log('\n--- PRODUCT TESTS ---');
  for (const [en, expected] of productTests) {
    const res = m.toUrduName(en);
    const pass = res === expected;
    if (!pass) allPass = false;
    console.log((pass ? '✅' : '❌'), en, '=>', res, (pass ? '' : `(Expected: ${expected})`));
  }

  console.log('\nOverall Result:', allPass ? 'ALL TESTS PASSED 100%' : 'SOME TESTS FAILED');
  process.exit(allPass ? 0 : 1);
}

test();
