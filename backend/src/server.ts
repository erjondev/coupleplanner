import 'dotenv/config';
import app from './app';

const PORT = Number(process.env.PORT ?? 3000);
// alwaysdata (et hébergeurs similaires) imposent l'IP d'écoute via cette variable.
const HOST = process.env.IP;

if (HOST) {
  app.listen(PORT, HOST, () => {
    console.log(`🚀 API CouplePlanner démarrée sur http://${HOST}:${PORT}`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`🚀 API CouplePlanner démarrée sur http://localhost:${PORT}`);
  });
}
