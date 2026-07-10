import express from 'express';
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

app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/notification-tokens', notificationsRoutes);

// Gestion d'erreur globale
app.use(
  (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
);

export default app;
