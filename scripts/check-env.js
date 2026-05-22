const required = ["DATABASE_URL", "AUTH_SECRET"];
required.forEach((k) => {
  if (!process.env[k]) console.warn(`missing ${k}`);
});
