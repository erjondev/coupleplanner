import express from 'express';
// Doit être importé juste après 'express' et avant la déclaration des routes :
// patche Express 4 pour transmettre les rejets de promesses des handlers async
// au middleware d'erreur ci-dessous (sans ça, une erreur async non catchée
// — ex: la base de données injoignable — fait planter tout le process Node,
// pas seulement la requête en cours).
import 'express-async-errors';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import tasksRoutes from './routes/tasks.routes';
import calendarRoutes from './routes/calendar.routes';
import notificationsRoutes from './routes/notifications.routes';

const app = express();

// CORS_ORIGIN : liste d'origines autorisées séparées par des virgules
// (ex: "https://coupleplanner.alwaysdata.net"). Sans variable définie (dev
// local), on autorise tout car le frontend Expo tourne sur un port différent.
const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim());
app.use(cors({ origin: allowedOrigins ?? true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Déployé derrière un proxy en chemin (ex: alwaysdata, un seul sous-domaine
// partagé avec le frontend statique sur "/" et l'API sur "/api"). Selon que
// le proxy conserve ou retire le préfixe "/api" avant de transmettre la
// requête à ce process Node, on monte les routes aux deux emplacements —
// un seul des deux matchera réellement pour une requête donnée.
const apiRouter = express.Router();
apiRouter.use('/auth', authRoutes);
apiRouter.use('/tasks', tasksRoutes);
apiRouter.use('/calendar', calendarRoutes);
apiRouter.use('/notification-tokens', notificationsRoutes);

app.use('/api', apiRouter);
app.use('/', apiRouter);

// Gestion d'erreur globale
app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
);

export default app;
