const http = require('node:http');

const PORT = 3001;

const server = require('./server');

function run() {
  const child = server.listen(PORT, () => {
    http.get(`http://localhost:${PORT}/`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let ok = res.statusCode === 200;
        if (ok) {
          try {
            const json = JSON.parse(data);
            ok = json.estado === 'OK';
          } catch (_) {
            ok = false;
          }
        }
        child.close(() => {
          if (ok) {
            console.log('TEST SUPERADO: El servidor responde con código 200 OK.');
            process.exit(0);
          } else {
            console.log(`TEST FALLIDO: Se esperaba código 200 y se obtuvo ${res.statusCode}`);
            process.exit(1);
          }
        });
      });
    }).on('error', (err) => {
      console.log(`ERROR DE RED EN TEST: ${err.message}`);
      child.close(() => process.exit(1));
    });
  });

  child.on('error', (err) => {
    console.log(`ERROR DE RED EN TEST: ${err.message}`);
    process.exit(1);
  });
}

if (require.main === module) {
  run();
}
