const t0 = process.hrtime.bigint();
for (let i = 0; i < 1e6; i++) {}
console.log(Number(process.hrtime.bigint() - t0) / 1e6, "ms");
