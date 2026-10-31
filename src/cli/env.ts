import fs from 'node:fs';

// Carrega o .env da raiz, se existir. Variáveis já definidas no ambiente têm prioridade.
if (fs.existsSync('.env')) process.loadEnvFile('.env');
