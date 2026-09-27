import app from './app.js';

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log('');
  console.log('  InternDesk — DecodeLabs Project 4');
  console.log(`  App:       http://localhost:${PORT}`);
  console.log(`  API base:  http://localhost:${PORT}/api`);
  console.log(`  Health:    http://localhost:${PORT}/api/health`);
  console.log('');
});
