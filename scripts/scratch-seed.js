// quick seeding helper used during local dev
const rows = Array.from({ length: 20 }, (_, i) => ({ id: i, name: `demo-${i}` }));
console.log(rows);
